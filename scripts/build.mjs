#!/usr/bin/env node
// Builds the static Stremio addon into ./dist from i.mjh.nz channel lists.
//   node scripts/build.mjs
// Optional env: SITE_URL (public base URL, used on the install page), OUT_DIR.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { countries as defaultCountries, config as defaultConfig } from "../channels.config.mjs";
import { ADDON_NAME, TYPE, buildManifest, catalogPaths, metaId, regionChannels, toMeta, toStream } from "../src/lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function build({
  fetchImpl = globalThis.fetch,
  countries = defaultCountries,
  config = defaultConfig,
  outDir = process.env.OUT_DIR || join(root, "dist"),
  siteUrl = process.env.SITE_URL || "",
  log = console.log,
} = {}) {
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
  // channels: id -> { meta, ch, countryId, regions[] }, so a national channel that
  // appears in every city gets one meta and one stream file.
  const channels = new Map();
  const catalogs = [];
  const report = { builtAt: new Date().toISOString(), countries: {} };

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
        if (!channels.has(id)) channels.set(id, { ch, meta: toMeta(country.id, ch), country, regions: [] });
        channels.get(id).regions.push(region);
      }
      catalogs.push({ country, region, ids: list.map((ch) => metaId(country.id, ch.key)) });
      report.countries[country.name][region] = list.length;
      log(`${country.name} / ${region}: ${list.length} channels`);
    }
  }

  // ---- 2. Write the static addon --------------------------------------------
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const writeJson = async (rel, data) => {
    const file = join(outDir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  };

  let files = 0;
  for (const { country, region, ids } of catalogs) {
    const metas = ids.map((id) => channels.get(id).meta);
    for (const rel of catalogPaths(country.id, region, region === country.regions[0])) {
      await writeJson(rel, { metas }); files++;
    }
  }
  for (const [id, { ch, meta, country, regions }] of channels) {
    await writeJson(`meta/${TYPE}/${id}.json`, { meta });
    await writeJson(`stream/${TYPE}/${id}.json`, { streams: [toStream(ch, regions, country.regions)] });
    files += 2;
  }

  await writeJson("manifest.json", buildManifest(countries));
  await writeFile(join(outDir, ".nojekyll"), "");
  await writeFile(join(outDir, "index.html"), installPage(siteUrl));
  report.channels = channels.size;
  await writeJson("report.json", report);
  log(`Done: ${channels.size} channels, ${files} files.`);
  return report;
}

function installPage(siteUrl) {
  const base = siteUrl.replace(/\/$/, "");
  const manifest = base ? `${base}/manifest.json` : "manifest.json";
  const stremio = base ? manifest.replace(/^https?:\/\//, "stremio://") : "#";
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
