// Everything you'd normally change lives here. Push a change and the workflow rebuilds.
//
// Each country is one catalog in Stremio's Discover (Channels → <country name>).
// Its genre dropdown lists, in order:
//   - filterLabels.all: every channel. It's first, so it's what Stremio opens on
//     and what clients that send no filter get. City feeds are named after their
//     city ("Seven (Sydney)") so you can tell which version you're watching.
//   - each region: the channels that region receives.
//   - filterLabels.other: regional feeds outside the capitals ("Seven Cairns").

export const countries = [
  {
    id: "au",
    name: "Australia",
    // i.mjh.nz publishes <source>/<region>/tv.json for each region below. Listed
    // from most to least populous; a feed shared by two cities is named after
    // the first one ("Seven (Sydney)" also serves Canberra).
    source: "https://i.mjh.nz/au",
    regions: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Hobart", "Darwin"],
  },
];

export const config = {
  filterLabels: { all: "City", other: "Other" },
  // Channels i.mjh.nz lists by key that you want hidden, e.g. ["mjh-sbs-sbs-radio-4"].
  exclude: [],
  // A region with fewer channels than this fails the build, so a bad fetch can't
  // replace the last good deployment with a near-empty list.
  minChannelsPerRegion: 20,
};
