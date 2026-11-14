// Pure helpers: turning i.mjh.nz channel data into Stremio objects and file paths.
import { baseName, describe } from "./descriptions.mjs";

// Lowercase like Stremio's own types (movie, series). Not its built-in "channel",
// which expects YouTube-style channels with a list of videos.
export const TYPE = "channels";
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
    .map(([key, ch]) => ({ key, ...ch, url: ch.mjh_master }))
    .sort(byNumber);
}

const byNumber = (a, b) => (a.chno ?? Infinity) - (b.chno ?? Infinity) || a.name.localeCompare(b.name);

/**
 * Channels from a free streaming service's .channels.json on i.mjh.nz (Pluto TV,
 * The Roku Channel), for one of its regions or, for single-region services, all
 * of them. DRM channels (license_url) are dropped: Stremio can't play them.
 * Streams go through i.mjh.nz's jmp2.uk redirector, which gets a fresh session
 * link from the service for the region asked for. The services' own numbers
 * aren't ones anyone knows, so they only set the order and aren't kept.
 */
export function serviceChannels(json, source, service, exclude = []) {
  const skip = new Set(exclude);
  const list = source.region ? json.regions?.[source.region]?.channels : json.channels;
  const channels = Object.entries(list || {})
    .map(([id, ch]) => ({ id, key: `${service.prefix}-${id}`, ch }))
    .filter(({ key, ch }) => !skip.has(key) && !ch.license_url && ch.name)
    .sort((a, b) => byNumber(a.ch, b.ch))
    .map(({ id, key, ch }) => {
      const group = ch.group ?? ch.groups?.[0];
      return {
        key,
        name: ch.name.trim(),
        logo: ch.logo,
        description: ch.description,
        programs: ch.programs,
        network: service.name,
        group: cleanGroup(source.group ?? source.rename?.[group] ?? group),
        url: service.stream.replace("{id}", id),
      };
    });
  // Pluto lists some local stations in both News and Local News; keep the local copy.
  const isLocal = (ch) => /^local\b/i.test(ch.group);
  const local = new Set(channels.filter(isLocal).map((ch) => ch.name));
  return channels.filter((ch) => isLocal(ch) || !local.has(ch.name));
}

// "News" in the services' groups, across their countries' languages.
const NEWS_GROUP = /^(news|noticias|notícias|nachrichten|nyheter)\b/i;

/**
 * Where a channel goes in a service-based country's full list: numbered channels
 * and news first, then channels with a mix of shows, then 24/7 single-show ones.
 */
export function listTier(ch) {
  if (ch.chno != null || NEWS_GROUP.test(ch.group)) return 0;
  return ch.programs?.length >= 2 && topShowShare(ch.programs) >= 0.8 ? 2 : 1;
}

/** Channels from a single tv.json (New Zealand), grouped by network. */
export const tvChannels = (tvJson, exclude) =>
  regionChannels(tvJson, exclude).map((ch) => ({ ...ch, group: cleanGroup(ch.network) }));

/**
 * Group names become file names, so characters that paths or Windows can't hold
 * are replaced. An empty group means "Other".
 */
export const cleanGroup = (group) => String(group ?? "").replace(/[\\/:*?"<>|#%]+/g, " ").replace(/\s+/g, " ").trim();

// ---- Grouping across regions ------------------------------------------------

/** A city-based country's dropdown: everything, then each city, then regional feeds. */
export const filterOptions = (country, labels) => [labels.all, ...country.regions, labels.other];

/**
 * A service-based country's dropdown: everything, then each group in the order
 * the channels first use it (the services list channels in guide order), then
 * Other for channels with no group.
 */
export function groupOptions(channels, allLabel, otherLabel) {
  const groups = [...new Set(channels.map((ch) => ch.group).filter((g) => !isOther(g, otherLabel)))];
  return [allLabel, ...groups, ...(channels.some((ch) => isOther(ch.group, otherLabel)) ? [otherLabel] : [])];
}

export const isOther = (group, otherLabel) => !group || group === otherLabel;

/**
 * Where a channel belongs, given the regions (in population order) whose lists
 * include it:
 *   national: in every region (streaming channels, SBS, ABC Kids…)
 *   city:     a capital's own feed, numbered (Seven, ABC TV); named after the most
 *             populous city it serves
 *   other:    an unnumbered feed for a regional area (Seven Cairns)
 */
export function placeChannel(ch, regions, allRegions) {
  if (regions.length === allRegions.length) return { kind: "national", name: ch.name };
  if (ch.chno == null) return { kind: "other", name: ch.name };
  return { kind: "city", name: `${ch.name} (${regions[0]})` };
}

/**
 * A regional feed with no number of its own takes the number of the broadcast
 * it carries ("Seven Cairns" gets Seven's 71). numberOf: channel name -> number.
 */
export const withSharedNumber = (ch, numberOf) => ({ ...ch, chno: ch.chno ?? numberOf(baseName(ch.name)) });

/**
 * Catalog order: numbered channels by number (a broadcast's city feeds in
 * population order, then its regional feeds), then unnumbered national channels
 * by name, then any regional feeds still without a number.
 */
export function catalogOrder(a, b) {
  const isOther = (c) => c.place.kind === "other";
  const group = (c) => (c.ch.chno != null ? 0 : isOther(c) ? 2 : 1);
  return group(a) - group(b)
    || (a.ch.chno ?? 0) - (b.ch.chno ?? 0)
    || isOther(a) - isOther(b)
    || a.home - b.home
    || a.place.name.localeCompare(b.place.name);
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

// ---- Programme guide (Stremio's native EPG) ---------------------------------
// i.mjh.nz publishes an XMLTV guide per Australian city (<region>/epg.xml.gz):
// about a week ahead for the broadcast channels and most streaming ones. Stremio
// shows it as a day-by-day grid in Discover when the catalog declares a `date`
// extra and the manifest sets behaviorHints.epgProvider. See
// https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/epg.md

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] !== "#" ? XML_ENTITIES[e] ?? m : String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))));

/** "20261113230000 +0000" → unix seconds. */
export function xmltvTime(value) {
  const m = String(value).match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*([+-])?(\d\d)?(\d\d)?/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s = "0", sign = "+", oh = "0", om = "0"] = m;
  const offset = (sign === "-" ? -1 : 1) * (Number(oh) * 3600 + Number(om) * 60);
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) / 1000 - offset;
}

/**
 * Programmes from an XMLTV document, by channel id (the same keys as tv.json):
 * channel -> [{ start, stop, title, subTitle, desc, categories, icon }], by start.
 */
export function parseXmltv(xml) {
  const guide = new Map();
  for (const [, attrs, body] of String(xml).matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const attr = (name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const text = (tag) => { const m = body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? unescapeXml(m[1]).trim() : undefined; };
    const channel = attr("channel"), start = xmltvTime(attr("start")), stop = xmltvTime(attr("stop")), title = text("title");
    if (!channel || !title || !(stop > start)) continue;
    const categories = [...body.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/g)].map((c) => unescapeXml(c[1]).trim()).filter(Boolean);
    const icon = body.match(/<icon\b[^>]*\bsrc="([^"]*)"/)?.[1];
    if (!guide.has(channel)) guide.set(channel, []);
    guide.get(channel).push({ start, stop, title, subTitle: text("sub-title"), desc: text("desc"), categories, icon: icon && unescapeXml(icon) });
  }
  for (const list of guide.values()) list.sort((a, b) => a.start - b.start);
  return guide;
}

// Sub-titles that only number the episode ("Episode 43 of Season 26") add nothing.
const isEpisodeNumber = (s) => /^(?:episode|ep\.?)\s*\d+(?:\s+of\s+(?:season|series)\s*\d+)?$/i.test(s);

const iso = (t) => new Date(t * 1000).toISOString();

/** A guide programme as a Stremio video. Playback stays on the channel's own id. */
export function toProgramme(channelId, p) {
  const sub = p.subTitle && !isEpisodeNumber(p.subTitle) && p.subTitle !== p.title ? p.subTitle : "";
  const startTime = iso(p.start);
  return {
    id: `${channelId}:epg:${startTime}`,
    title: p.title,
    released: startTime,
    startTime,
    endTime: iso(p.stop),
    overview: [sub, p.desc].filter(Boolean).join("\n") || undefined,
    thumbnail: p.icon || undefined,
    runtime: `${Math.round((p.stop - p.start) / 60)} min`,
    genres: p.categories?.length ? p.categories : undefined,
  };
}

/** Programmes overlapping [from, to) (unix seconds). */
export const programmesBetween = (programmes = [], from, to) => programmes.filter((p) => p.stop > from && p.start < to);

/** "YYYY-MM-DD" UTC days from `past` days before now's to `ahead` days after it. */
export function guideDates(now, { past, ahead }) {
  const today = Math.floor(now / DAY) * DAY;
  return Array.from({ length: past + ahead + 1 }, (_, i) => iso(today + (i - past) * DAY).slice(0, 10));
}

/** The UTC window [start, end) of a "YYYY-MM-DD" day, in unix seconds. */
export const dayWindow = (date) => { const start = Date.parse(`${date}T00:00:00Z`) / 1000; return [start, start + DAY]; };

/**
 * A channel's row in a guide page: a lean preview (no description, which the
 * grid doesn't show) with that UTC day's programmes.
 */
export function guideRow(meta, programmes, date) {
  const [from, to] = dayWindow(date);
  const { id, type, name, poster, posterShape, logo, releaseInfo } = meta;
  return {
    id, type, name, poster, posterShape, logo, releaseInfo,
    behaviorHints: { isLive: true, hasScheduledVideos: true },
    videos: programmesBetween(programmes, from, to).map((p) => toProgramme(id, p)),
  };
}

// ---- Stremio objects --------------------------------------------------------

/**
 * Stremio meta for a channel. i.mjh.nz's own description is kept where it has
 * one; otherwise a one-line description of the channel. Either way it's followed
 * by what the channel has been airing.
 */
export function toMeta(countryId, ch, { name = ch.name, poster, recent = [], videos } = {}) {
  const id = metaId(countryId, ch.key);
  const about = ch.description?.trim() || describe(ch.name, ch.network, { singleShowShare: topShowShare(ch.programs) });
  const aired = recent.length ? `Recently aired: ${recent.join(", ")}` : "";
  return {
    id,
    type: TYPE,
    name,
    poster: poster || ch.logo || undefined,
    posterShape: "square",
    logo: ch.logo || undefined,
    releaseInfo: ch.chno ? `Channel ${ch.chno}` : undefined,
    genres: ch.network ? [ch.network] : undefined,
    description: [about, aired].filter(Boolean).join("\n\n"),
    // Play straight away instead of looking for a list of episodes. With a guide
    // (`videos`), the channel is marked live: Stremio then shows the programmes
    // as a schedule and still plays the channel's own id.
    behaviorHints: videos ? { defaultVideoId: id, isLive: true, hasScheduledVideos: true } : { defaultVideoId: id },
    videos,
  };
}

/** Where an Australian channel is available: "Sydney", or "All regions" for national ones. */
export function availability(regions, allRegions) {
  return regions.length === allRegions.length ? "All regions" : regions.join(", ");
}

/**
 * A plain stream link with no behaviorHints. Both kinds were tried and dropped:
 * - proxyHeaders (to send i.mjh.nz's player headers, which 10's key server
 *   needs): Stremio's streaming-server proxy (v4.22.3) appends "null" to
 *   rewritten URLs that have no query string, which breaks 10's playlists and
 *   several other channels.
 * - notWebReady: apps without a streaming server, like Samsung's, may then
 *   refuse streams their own player can play.
 */
export function toStream(ch, note) {
  return { name: "Live", title: `${ch.name}\n${note}`, url: ch.url };
}

/**
 * Static files can't parse query strings, so each request path must exist as a
 * file. Clients encode extra values differently and hosts may or may not decode
 * the path, so write every spelling ("Gold Coast" as Gold%20Coast and Gold+Coast).
 */
export function valueSpellings(value) {
  // Form encoding (Stremio's own) also escapes ! ~ ' ( ), which encodeURIComponent keeps.
  const form = encodeURIComponent(value).replace(/[!~'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return [...new Set([
    value,
    value.replace(/ /g, "+"),
    encodeURIComponent(value),
    encodeURIComponent(value).replace(/%20/g, "+"),
    form,
    form.replace(/%20/g, "+"),
  ])];
}

export function catalogPaths(countryId, option, isDefault) {
  const dir = `catalog/${TYPE}/${countryId}`;
  const paths = valueSpellings(option).map((v) => `${dir}/genre=${v}.json`);
  // Stremio's own apps always send a filter (it's required), but other clients may not.
  if (isDefault) paths.push(`${dir}.json`);
  return paths;
}

/**
 * A guide page's files. Stremio puts the date first ("date=2026-11-14&genre=Sydney"):
 * stremio-core's ExtraExt::extend_one prepends the extra it adds.
 */
export function guidePaths(countryId, option, date) {
  return valueSpellings(option).map((v) => `catalog/${TYPE}/${countryId}/date=${date}&genre=${v}.json`);
}

// Bump when the manifest changes so installed copies refresh.
// catalogs: [{ id, name, options, guide }], one per country; `guide` catalogs
// also take a `date` (optional, so Discover can still list channels without one).
export function buildManifest(catalogs, version = "2.2.0") {
  return {
    id: "community.live-channels",
    version,
    name: ADDON_NAME,
    description: "Free live TV channels by country, from broadcasters' and free streaming services' own streams (via i.mjh.nz). Find them under Discover → channels.",
    // Plain resource names with types and idPrefixes at the top level: the form
    // every Stremio client and the account sync understand.
    resources: ["catalog", "meta", "stream"],
    types: [TYPE],
    idPrefixes: [ID_PREFIX],
    catalogs: catalogs.map((c) => ({
      type: TYPE,
      id: c.id,
      name: c.name,
      extra: [{ name: "genre", options: c.options, isRequired: true }, ...(c.guide ? [{ name: "date" }] : [])],
      // Older clients (Stremio desktop v4) read these instead of `extra`; without
      // extraRequired they show "None" and send requests with no filter.
      genres: c.options,
      extraSupported: ["genre"],
      extraRequired: ["genre"],
    })),
    behaviorHints: { configurable: false, configurationRequired: false, ...(catalogs.some((c) => c.guide) ? { epgProvider: true } : {}) },
  };
}
