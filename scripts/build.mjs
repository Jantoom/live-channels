#!/usr/bin/env node
// Builds the static Stremio addon into ./dist from i.mjh.nz channel lists.
//   node scripts/build.mjs
// Optional env: SITE_URL (public base URL; posters and the install page link to it,
// and the previous build's history.json is read from it), OUT_DIR, CACHE_DIR.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { countries as defaultCountries, config as defaultConfig } from "../channels.config.mjs";
import {
  ADDON_NAME, TYPE, buildManifest, catalogPaths, mergeHistory, metaId, recentlyAired, regionChannels,
  toMeta, toStream,
} from "../src/lib.mjs";
import { makePoster } from "../src/posters.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function build({
  fetchImpl = globalThis.fetch,
  countries = defaultCountries,
  config = defaultConfig,
  outDir = process.env.OUT_DIR || join(root, "dist"),
  cacheDir = process.env.CACHE_DIR || join(root, ".cache"),
  siteUrl = process.env.SITE_URL || `http://127.0.0.1:${process.env.PORT || 7000}`,
  now = Math.floor(Date.now() / 1000),
  log = console.log,
} = {}) {
  const base = siteUrl.replace(/\/$/, "");
  const warnings = [];
  const warn = (msg) => { warnings.push(msg); log(`  warning: ${msg}`); };

  async function getJson(url) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetchImpl(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
    throw new Error(`${url}: ${lastErr.message}`);
  }

  // ---- 1. Fetch every region ------------------------------------------------
  // channels: id -> { ch, country, regions[] }, so a national channel that
  // appears in every city gets one meta and one stream file.
  const channels = new Map();
  const catalogs = [];
  const report = { builtAt: new Date(now * 1000).toISOString(), countries: {} };

  for (const country of countries) {
    report.countries[country.name] = {};
    for (const region of country.regions) {
      const list = regionChannels(await getJson(`${country.source}/${region}/tv.json`), config.exclude);
      if (list.length < config.minChannelsPerRegion) {
        // Failing stops the workflow from replacing the last good deployment.
        throw new Error(`${country.name} / ${region} has only ${list.length} channels (minimum ${config.minChannelsPerRegion}); not publishing.`);
      }
      for (const ch of list) {
        const id = metaId(country.id, ch.key);
        if (!channels.has(id)) channels.set(id, { ch, country, regions: [] });
        channels.get(id).regions.push(region);
      }
      catalogs.push({ country, region, ids: list.map((ch) => metaId(country.id, ch.key)) });
      report.countries[country.name][region] = list.length;
      log(`${country.name} / ${region}: ${list.length} channels`);
    }
  }
  const all = [...channels.values()];

  // ---- 2. Schedule history --------------------------------------------------
  let previous = {};
  try {
    previous = await getJson(`${base}/history.json`);
  } catch (err) {
    warn(`No previous schedule history (${err.message}); "Recently aired" starts from today's schedule.`);
  }
  const programs = Object.fromEntries(all.map(({ ch }) => [ch.key, ch.programs || []]));
  const history = mergeHistory(previous, programs, now);

  // ---- 3. Posters and web playback -------------------------------------------
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "posters"), { recursive: true });

  const posters = new Map();
  const logos = [...new Set(all.map(({ ch }) => ch.logo).filter(Boolean))];
  await mapLimit(logos, 8, async (url) => {
    try {
      const file = await makePoster(url, { fetchImpl, cacheDir: join(cacheDir, "posters"), outDir: join(outDir, "posters") });
      posters.set(url, `${base}/posters/${file}`);
    } catch (err) {
      warn(`Logo ${url} couldn't be made into a poster (${err.message}); using it as-is.`);
    }
  });

  // Follows the stream's redirects the way a browser on web.stremio.com would:
  // every response, redirects included, has to allow the page's origin, and
  // after the first redirect to another site that origin becomes "null".
  async function isWebReady(url) {
    try {
      let origin = "https://web.stremio.com", current = new URL(url);
      for (let hop = 0; hop < 6; hop++) {
        if (config.notWebReadyHosts?.includes(current.host)) return false;
        const res = await fetchImpl(current, { redirect: "manual", headers: { Origin: origin } });
        await res.body?.cancel?.();
        const allowed = res.headers.get("access-control-allow-origin");
        if (allowed !== "*" && allowed !== origin) return false;
        const location = res.headers.get("location");
        if (!location) return res.ok;
        const next = new URL(location, current);
        if (next.origin !== current.origin) origin = "null";
        current = next;
      }
      return false;
    } catch {
      return false;
    }
  }
  const webReady = new Map();
  if (config.probeWebPlayback) {
    await mapLimit(all, 8, async ({ ch }) => webReady.set(ch.key, await isWebReady(ch.mjh_master)));
  }

  // ---- 4. Write the static addon --------------------------------------------
  const writeJson = async (rel, data) => {
    const file = join(outDir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  };

  const metas = new Map();
  let files = posters.size;
  for (const [id, { ch, country, regions }] of channels) {
    const meta = toMeta(country.id, ch, {
      poster: posters.get(ch.logo),
      recent: recentlyAired(history[ch.key], now, ch.name),
    });
    metas.set(id, meta);
    await writeJson(`meta/${TYPE}/${id}.json`, { meta });
    await writeJson(`stream/${TYPE}/${id}.json`, {
      streams: [toStream(ch, regions, country.regions, { webReady: webReady.get(ch.key) ?? true })],
    });
    files += 2;
  }
  for (const { country, region, ids } of catalogs) {
    const list = ids.map((id) => metas.get(id));
    for (const rel of catalogPaths(country.id, region, region === country.regions[0])) {
      await writeJson(rel, { metas: list }); files++;
    }
  }

  await writeJson("manifest.json", buildManifest(countries));
  await writeJson("history.json", history);
  await writeFile(join(outDir, ".nojekyll"), "");
  await writeFile(join(outDir, "index.html"), installPage(base));
  Object.assign(report, {
    channels: channels.size,
    posters: posters.size,
    notWebReady: config.probeWebPlayback ? [...webReady].filter(([, ok]) => !ok).map(([key]) => key) : "not checked",
    historyPrograms: Object.values(history).reduce((n, e) => n + e.length, 0),
    warnings,
  });
  await writeJson("report.json", report);
  log(`Done: ${channels.size} channels, ${posters.size} posters, ${files} files, ${warnings.length} warning(s).`);
  return report;
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  const worker = async () => { while (next < items.length) await fn(items[next++]); };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function installPage(base) {
  const manifest = `${base}/manifest.json`;
  const stremio = manifest.replace(/^https?:\/\//, "stremio://");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ADDON_NAME}</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#666;--accent:#7b5bf2}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:520px}h1{margin:0 0 8px}p{color:var(--muted)}
a.btn{display:inline-block;background:var(--accent);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-right:8px}
code{word-break:break-all;font-size:14px}</style></head><body><main>
<h1>${ADDON_NAME}</h1>
<p>Free live TV channels for Stremio, by country and city. Find them under Discover → Channels, pick a country, then pick your city.</p>
<p><a class="btn" href="${stremio}">Install in Stremio</a><a href="report.json">Build report</a></p>
<p>Or paste this into Stremio's addon search:<br><code>${manifest}</code></p>
<p>Streams come from the broadcasters' free apps via <a href="https://i.mjh.nz/">i.mjh.nz</a> and only play from inside the country.</p>
</main></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error(`\nBuild failed: ${err.message}`); process.exit(1); });
}
