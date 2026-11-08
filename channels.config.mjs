// Everything you'd normally change lives here. Push a change and the workflow rebuilds.
//
// Each country is one catalog in Stremio's Discover (channels → <country name>),
// in the order listed. There are two kinds:
//
// - City-based (Australia): `source` and `regions`. i.mjh.nz publishes
//   <source>/<region>/tv.json per city. The dropdown lists:
//     - filterLabels.city: every channel. It's first, so it's what Stremio opens
//       on and what clients that send no filter get. City feeds are named after
//       their city ("Seven (Sydney)") so you can tell which version you're watching.
//     - each region: the channels that region receives.
//     - filterLabels.other: regional feeds outside the capitals ("Seven Cairns").
//
// - Service-based (everywhere else): `sources`, each one of
//     { service, region }  a free streaming service's lineup for one country
//     { service, group }   a single-region service, all filed under one option
//     { tv }               a single i.mjh.nz tv.json, grouped by network
//   The dropdown lists filterLabels.genre (or the country's own `filterLabel`)
//   for every channel, then the services' own groups. A channel two sources
//   share by name is only listed from the first.

export const countries = [
  {
    id: "au",
    name: "Australia",
    // Listed from most to least populous; a feed shared by two cities is named
    // after the first one ("Seven (Sydney)" also serves Canberra).
    source: "https://i.mjh.nz/au",
    regions: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Hobart", "Darwin"],
  },
  // The rest, from most to least populous.
  { id: "us", name: "United States", sources: [{ service: "PlutoTV", region: "us" }, { service: "Roku", group: "The Roku Channel" }] },
  { id: "br", name: "Brazil", sources: [{ service: "PlutoTV", region: "br" }] },
  { id: "mx", name: "Mexico", sources: [{ service: "PlutoTV", region: "mx" }] },
  { id: "de", name: "Germany", sources: [{ service: "PlutoTV", region: "de" }] },
  { id: "gb", name: "United Kingdom", sources: [{ service: "PlutoTV", region: "gb" }] },
  { id: "fr", name: "France", sources: [{ service: "PlutoTV", region: "fr" }] },
  { id: "it", name: "Italy", sources: [{ service: "PlutoTV", region: "it" }] },
  { id: "es", name: "Spain", sources: [{ service: "PlutoTV", region: "es" }] },
  { id: "ar", name: "Argentina", sources: [{ service: "PlutoTV", region: "ar" }] },
  { id: "ca", name: "Canada", sources: [{ service: "PlutoTV", region: "ca" }] },
  // No Chile: i.mjh.nz's Pluto TV "cl" lineup is currently a copy of Canada's.
  { id: "se", name: "Sweden", sources: [{ service: "PlutoTV", region: "se" }] },
  { id: "dk", name: "Denmark", sources: [{ service: "PlutoTV", region: "dk" }] },
  { id: "no", name: "Norway", sources: [{ service: "PlutoTV", region: "no" }] },
  { id: "nz", name: "New Zealand", filterLabel: "Network", sources: [{ tv: "https://i.mjh.nz/nz/tv.json" }] },
];

// Free streaming services i.mjh.nz lists channels for. Keys are what `service`
// refers to above; `prefix` starts each channel's id. Samsung TV Plus is left
// out: about half its channels refuse viewers outside their own country.
export const services = {
  PlutoTV: { name: "Pluto TV", prefix: "plu", channels: "https://i.mjh.nz/PlutoTV/.channels.json", stream: "https://jmp2.uk/plu-{id}.m3u8" },
  Roku: { name: "The Roku Channel", prefix: "rok", channels: "https://i.mjh.nz/Roku/.channels.json", stream: "https://jmp2.uk/rok-{id}.m3u8" },
};

export const config = {
  filterLabels: { city: "City", genre: "Genre", other: "Other" },
  // Channels to hide, by id: the part of the addon's id after "livetv-<country>-",
  // e.g. "mjh-sbs-sbs-radio-4" or "plu-5ba3fb9c4b078e0f37ad34e8".
  exclude: [],
  // A city or source with fewer channels than this fails the build, so a bad
  // fetch can't replace the last good deployment with a near-empty list.
  minChannelsPerRegion: 20,
};
