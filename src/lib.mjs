// Pure helpers: turning i.mjh.nz channel data into Stremio objects and file paths.
import { describe } from "./descriptions.mjs";

export const TYPE = "channel";       // shows as "Channels" in Stremio's Discover
export const ID_PREFIX = "livetv-";
export const ADDON_NAME = "Live Channels";

export const metaId = (countryId, key) => `${ID_PREFIX}${countryId}-${key}`;

/**
 * Channels from one region's tv.json, in channel-number order. Numbered channels
 * (the broadcast ones) come first; the streaming-only channels have no number and
 * follow by name. Entries that aren't live streams (hls: false, e.g. ABC's
 * "News in 90 Seconds" clips) and excluded keys are dropped.
 */
export function regionChannels(tvJson, exclude = []) {
  const skip = new Set(exclude);
  return Object.entries(tvJson)
    .filter(([key, ch]) => !skip.has(key) && ch.hls !== false && ch.mjh_master && ch.name)
    .map(([key, ch]) => ({ key, ...ch }))
    .sort((a, b) => {
      const na = a.chno ?? Infinity, nb = b.chno ?? Infinity;
      return na - nb || a.name.localeCompare(b.name);
    });
}

// ---- Schedule history -------------------------------------------------------
// tv.json only covers roughly the last 4 and next 9 hours, so each build merges
// it into a 7-day history (published as history.json and read back next build).

const DAY = 86400, WEEK = 7 * DAY;
const AEST = 10 * 3600; // days are counted in Brisbane time so a late show isn't split across two

/** "Daria S3 Ep. 310" → "Daria", "Water Rats - S6 E16 - Lazarus" → "Water Rats". */
export function showTitle(raw) {
  return String(raw)
    .replace(/^\(\d{4}\)\s*/, "")                                     // "(1996) Wedding - …"
    .replace(/^S\d+\s*E\d+\s*-\s*/i, "")                              // "S8 E62 - Sophie - Part 4"
    .replace(/\s*-?\s*\bS\d+\s*(?:E|Ep\.?|Episode)\s*\d+\b.*$/i, "")  // "All Saints S5 Episode 30"
    .trim();
}

/** Titles that name an episode slot rather than a show ("Season 7 Episode 11"). */
export const isGenericTitle = (title) => !title || /^(?:season|series|episode|ep\.?)\s*\d+/i.test(title);

/**
 * Adds the programs in each channel's tv.json entry to the history and drops
 * anything older than a week. history: key -> [[startUnix, title], …].
 */
export function mergeHistory(history, programsByKey, now) {
  const merged = {};
  for (const key of new Set([...Object.keys(history), ...Object.keys(programsByKey)])) {
    const byStart = new Map((history[key] || []).map(([t, title]) => [t, title]));
    for (const [t, raw] of programsByKey[key] || []) {
      const title = showTitle(raw);
      if (!isGenericTitle(title)) byStart.set(t, title);
    }
    const entries = [...byStart].filter(([t]) => t >= now - WEEK).sort((a, b) => a[0] - b[0]);
    if (entries.length) merged[key] = entries;
  }
  return merged;
}

/**
 * Up to `max` shows that aired (started) in the past week. Shows aired on more
 * days come first, so a weekly or daily series beats a one-off movie; ties go to
 * the show aired more often, then the most recent. The channel's own name is
 * left out (a "Bondi Vet" channel only ever airs Bondi Vet).
 */
export function recentlyAired(entries = [], now, channelName = "", max = 10) {
  const self = channelName.toLowerCase();
  const shows = new Map();
  for (const [t, title] of entries) {
    if (t > now || t < now - WEEK || title.toLowerCase() === self) continue;
    const s = shows.get(title) || { title, days: new Set(), airings: 0, last: 0 };
    s.days.add(Math.floor((t + AEST) / DAY));
    s.airings++;
    s.last = Math.max(s.last, t);
    shows.set(title, s);
  }
  return [...shows.values()]
    .sort((a, b) => b.days.size - a.days.size || b.airings - a.airings || b.last - a.last)
    .slice(0, max)
    .map((s) => s.title);
}

/** Share of a channel's programs that are its most frequent show (1 = one show only). */
export function topShowShare(programs = []) {
  const counts = {};
  for (const [, raw] of programs) { const t = showTitle(raw); counts[t] = (counts[t] || 0) + 1; }
  const top = Math.max(0, ...Object.values(counts));
  return programs.length ? top / programs.length : 0;
}

// ---- Stremio objects --------------------------------------------------------

/**
 * Stremio meta for a channel. i.mjh.nz's own description is kept where it has
 * one; otherwise a one-line description of the channel. Either way it's followed
 * by what the channel has been airing.
 */
export function toMeta(countryId, ch, { poster, recent = [] } = {}) {
  const id = metaId(countryId, ch.key);
  const about = ch.description?.trim() || describe(ch.name, ch.network, { singleShowShare: topShowShare(ch.programs) });
  const aired = recent.length ? `Recently aired: ${recent.join(", ")}` : "";
  return {
    id,
    type: TYPE,
    name: ch.name,
    poster: poster || ch.logo || undefined,
    posterShape: "square",
    logo: ch.logo || undefined,
    releaseInfo: ch.chno ? `Channel ${ch.chno}` : undefined,
    genres: ch.network ? [ch.network] : undefined,
    description: [about, aired].filter(Boolean).join("\n\n"),
    // Play straight away instead of looking for a list of episodes.
    behaviorHints: { defaultVideoId: id },
  };
}

/** Where a channel is available: "Sydney", or "All regions" for national ones. */
export function availability(regions, allRegions) {
  return regions.length === allRegions.length ? "All regions" : regions.join(", ");
}

/**
 * webReady is false when the stream's host refuses browser playback from another
 * site (10's Google ad-insertion streams). notWebReady then makes Stremio Web
 * play it through the streaming server instead of failing with "Video is not
 * supported". The desktop and mobile apps play these streams directly either way.
 */
export function toStream(ch, regions, allRegions, { webReady = true } = {}) {
  return {
    name: "Live",
    title: `${ch.name}\n${availability(regions, allRegions)}`,
    url: ch.mjh_master,
    ...(webReady ? {} : { behaviorHints: { notWebReady: true } }),
  };
}

/**
 * Static files can't parse query strings, so each request path must exist as a
 * file. Clients encode extra values differently and hosts may or may not decode
 * the path, so write every spelling ("Gold Coast" as Gold%20Coast and Gold+Coast).
 */
export function valueSpellings(value) {
  return [...new Set([
    value,
    value.replace(/ /g, "+"),
    encodeURIComponent(value),
    encodeURIComponent(value).replace(/%20/g, "+"),
  ])];
}

export function catalogPaths(countryId, region, isDefault) {
  const dir = `catalog/${TYPE}/${countryId}`;
  const paths = valueSpellings(region).map((v) => `${dir}/genre=${v}.json`);
  // Stremio's own apps always send a region (it's required), but other clients may not.
  if (isDefault) paths.push(`${dir}.json`);
  return paths;
}

// Bump when the manifest changes so installed copies refresh.
export function buildManifest(countries, version = "1.1.0") {
  return {
    id: "community.live-channels",
    version,
    name: ADDON_NAME,
    description: "Free live TV channels by country and city, from the broadcasters' own free streams (via i.mjh.nz). Find them under Discover → Channels.",
    // Plain resource names with types and idPrefixes at the top level: the form
    // every Stremio client and the account sync understand.
    resources: ["catalog", "meta", "stream"],
    types: [TYPE],
    idPrefixes: [ID_PREFIX],
    catalogs: countries.map((c) => ({
      type: TYPE,
      id: c.id,
      name: c.name,
      extra: [{ name: "genre", options: c.regions, isRequired: true }],
      // Older clients (Stremio desktop v4) read these instead of `extra`; without
      // extraRequired they show "None" and send requests with no region.
      genres: c.regions,
      extraSupported: ["genre"],
      extraRequired: ["genre"],
    })),
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}
