// Pure helpers: turning i.mjh.nz channel data into Stremio objects and file paths.

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

export function toMeta(countryId, ch) {
  const id = metaId(countryId, ch.key);
  const facts = [ch.network, ch.chno && `channel ${ch.chno}`].filter(Boolean).join(" · ");
  return {
    id,
    type: TYPE,
    name: ch.name,
    poster: ch.logo || undefined,
    posterShape: "square",
    logo: ch.logo || undefined,
    releaseInfo: ch.chno ? `Ch ${ch.chno}` : undefined,
    genres: ch.network ? [ch.network] : undefined,
    description: [ch.description, facts].filter(Boolean).join("\n\n") || undefined,
    // Play straight away instead of looking for a list of episodes.
    behaviorHints: { defaultVideoId: id },
  };
}

/** Where a channel is available: "Sydney", or "All regions" for national ones. */
export function availability(regions, allRegions) {
  return regions.length === allRegions.length ? "All regions" : regions.join(", ");
}

export function toStream(ch, regions, allRegions) {
  return {
    name: "Live",
    title: `${ch.name}\n${availability(regions, allRegions)}`,
    url: ch.mjh_master,
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
export function buildManifest(countries, version = "1.0.0") {
  return {
    id: "community.live-channels",
    version,
    name: ADDON_NAME,
    description: "Free live TV channels by country and city, from the broadcasters' own free streams (via i.mjh.nz). Find them under Discover → Channels.",
    resources: [
      "catalog",
      { name: "meta", types: [TYPE], idPrefixes: [ID_PREFIX] },
      { name: "stream", types: [TYPE], idPrefixes: [ID_PREFIX] },
    ],
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
