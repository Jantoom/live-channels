#!/usr/bin/env node
// Builds the static Stremio addon into ./dist from i.mjh.nz channel lists.
//   node scripts/build.mjs
// Optional env: SITE_URL (public base URL; posters and the install page link to it,
// and the previous build's history.json is read from it), OUT_DIR, CACHE_DIR.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { countries as defaultCountries, config as defaultConfig, services as defaultServices } from "../channels.config.mjs";
import {
  TYPE, availability, buildManifest, catalogOrder, catalogPaths, filterOptions, groupOptions, isOther,
  mergeHistory, metaId, placeChannel, recentlyAired, regionChannels, serviceChannels, toMeta, toStream, tvChannels,
} from "../src/lib.mjs";
import { makePoster } from "../src/posters.mjs";
import { installPage } from "../src/install-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function build({
  fetchImpl = globalThis.fetch,
  countries = defaultCountries,
  services = defaultServices,
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

  // A service's .channels.json covers all its countries; fetch it once.
  const fetched = new Map();
  const getShared = (url) => {
    if (!fetched.has(url)) fetched.set(url, getJson(url));
    return fetched.get(url);
  };

  // Failing stops the workflow from replacing the last good deployment.
  const checkSize = (label, list) => {
    if (list.length < config.minChannelsPerRegion) {
      throw new Error(`${label} has only ${list.length} channels (minimum ${config.minChannelsPerRegion}); not publishing.`);
    }
  };

  // ---- 1. Fetch every region and source ---------------------------------------
  // channels: id -> { ch, country, regions[] }, so a national channel that
  // appears in every city gets one meta and one stream file.
  const channels = new Map();
  const report = { builtAt: new Date(now * 1000).toISOString(), countries: {} };

  for (const country of countries) {
    const counts = report.countries[country.name] = {};
    if (country.regions) {
      for (const region of country.regions) {
        const list = regionChannels(await getJson(`${country.source}/${region}/tv.json`), config.exclude);
        checkSize(`${country.name} / ${region}`, list);
        for (const ch of list) {
          const id = metaId(country.id, ch.key);
          if (!channels.has(id)) channels.set(id, { ch, country, regions: [] });
          channels.get(id).regions.push(region);
        }
        counts[region] = list.length;
        log(`${country.name} / ${region}: ${list.length} channels`);
      }
      continue;
    }
    const names = new Set();
    for (const source of country.sources) {
      let list, label;
      if (source.tv) {
        list = tvChannels(await getJson(source.tv), config.exclude);
        label = "i.mjh.nz";
      } else {
        const service = services[source.service];
        if (!service) throw new Error(`${country.name}: unknown service "${source.service}".`);
        list = serviceChannels(await getShared(service.channels), source, service, config.exclude);
        label = service.name;
      }
      checkSize(`${country.name} / ${label}`, list);
      const added = list.filter((ch) => !names.has(ch.name.toLowerCase()));
      for (const ch of added) {
        names.add(ch.name.toLowerCase());
        channels.set(metaId(country.id, ch.key), { ch, country, regions: [] });
      }
      counts[label] = added.length;
      log(`${country.name} / ${label}: ${added.length} channels`);
    }
  }
  const all = [...channels.values()];

  // ---- 2. Schedule history --------------------------------------------------
  // Keyed by addon id: the services use the same channel ids in several countries.
  let previous = {};
  try {
    previous = await getJson(`${base}/history.json`);
  } catch (err) {
    warn(`No previous schedule history (${err.message}); "Recently aired" starts from today's schedule.`);
  }
  const programs = Object.fromEntries([...channels].map(([id, { ch }]) => [id, ch.programs || []]));
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

  // ---- 4. Write the static addon --------------------------------------------
  const writeJson = async (rel, data) => {
    const file = join(outDir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  };

  const entries = [];
  let files = posters.size;
  for (const [id, { ch, country, regions }] of channels) {
    // Service-based countries have no cities: names stay as they are.
    const place = country.regions ? placeChannel(ch, regions, country.regions) : { kind: "service", name: ch.name };
    const meta = toMeta(country.id, ch, {
      name: place.name,
      poster: posters.get(ch.logo),
      recent: recentlyAired(history[id], now, ch.name),
    });
    entries.push({ ch, country, regions, place, meta, home: country.regions?.indexOf(regions[0]) });
    await writeJson(`meta/${TYPE}/${id}.json`, { meta });
    await writeJson(`stream/${TYPE}/${id}.json`, {
      streams: [toStream(ch, country.regions ? availability(regions, country.regions) : ch.network)],
    });
    files += 2;
  }

  const labels = config.filterLabels;
  const catalogs = [];
  for (const country of countries) {
    let options, lists;
    if (country.regions) {
      const mine = entries.filter((e) => e.country === country).sort(catalogOrder);
      options = filterOptions(country, labels);
      lists = {
        [labels.city]: mine,
        [labels.other]: mine.filter((e) => e.place.kind === "other"),
        ...Object.fromEntries(country.regions.map((region) =>
          [region, mine.filter((e) => e.place.kind !== "other" && e.regions.includes(region))])),
      };
    } else {
      // Already in source order, each source in channel-number order.
      const mine = entries.filter((e) => e.country === country);
      options = groupOptions(mine.map((e) => e.ch), country.filterLabel || labels.genre, labels.other);
      lists = {
        [options[0]]: mine,
        [labels.other]: mine.filter((e) => isOther(e.ch.group, labels.other)),
        ...Object.fromEntries(options.slice(1).filter((g) => g !== labels.other)
          .map((group) => [group, mine.filter((e) => e.ch.group === group)])),
      };
    }
    for (const option of options) {
      const metas = lists[option].map((e) => e.meta);
      for (const rel of catalogPaths(country.id, option, option === options[0])) {
        await writeJson(rel, { metas }); files++;
      }
    }
    if (lists[labels.other].length) report.countries[country.name][labels.other] = lists[labels.other].length;
    catalogs.push({ id: country.id, name: country.name, options });
  }

  const manifest = buildManifest(catalogs);
  await writeJson("manifest.json", manifest);
  await writeJson("history.json", history);
  await writeFile(join(outDir, ".nojekyll"), "");
  const perCountry = countries.map((c) => ({ country: c, count: entries.filter((e) => e.country === c).length }));
  await writeFile(join(outDir, "index.html"), sitePage(base, manifest, perCountry, channels.size));
  Object.assign(report, {
    channels: channels.size,
    posters: posters.size,
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

function sitePage(base, manifest, perCountry, total) {
  return installPage({
    name: manifest.name,
    version: manifest.version,
    icon: "tv",
    tagline: "Free live TV channels for Stremio, by country.",
    manifestUrl: `${base}/manifest.json`,
    stats: [
      { value: perCountry.length, label: "countries" },
      { value: total, label: "channels" },
    ],
    groups: [{
      title: "Countries",
      detail: `${total.toLocaleString("en-US")} channels`,
      layout: "grid",
      choices: perCountry.map(({ country, count }) => ({ badge: country.id.toUpperCase(), label: country.name, detail: count.toLocaleString("en-US") })),
    }],
    about: `<p>Find them under <b>Discover</b>: set the type to <b>channels</b>, pick a country from the catalog dropdown, then a city or genre. Australia opens on every channel, and you can narrow it to your city.</p>
<p>Streams come from broadcasters' and free streaming services' own apps via <a href="https://i.mjh.nz/">i.mjh.nz</a>. Australian and New Zealand broadcasters' channels only play from inside that country.</p>`,
    links: [{ label: "Build report", href: "report.json" }],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error(`\nBuild failed: ${err.message}`); process.exit(1); });
}
