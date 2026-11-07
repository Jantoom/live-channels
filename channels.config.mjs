// Everything you'd normally change lives here. Push a change and the workflow rebuilds.
//
// Each country is one catalog in Stremio's Discover (Channels → <country name>), and
// its regions are the genre dropdown. The first region is the default: Stremio
// opens the catalog on it, and clients that send no region get it too.

export const countries = [
  {
    id: "au",
    name: "Australia",
    // i.mjh.nz publishes <source>/<region>/tv.json for each region below.
    source: "https://i.mjh.nz/au",
    regions: ["Brisbane", "Adelaide", "Canberra", "Darwin", "Hobart", "Melbourne", "Perth", "Sydney"],
  },
];

export const config = {
  // Channels i.mjh.nz lists by key that you want hidden, e.g. ["mjh-sbs-sbs-radio-4"].
  exclude: [],
  // A region with fewer channels than this fails the build, so a bad fetch can't
  // replace the last good deployment with a near-empty list.
  minChannelsPerRegion: 20,
  // Check each stream's host for browser playback and mark the ones Stremio Web
  // has to play through the streaming server (see toStream in src/lib.mjs).
  probeWebPlayback: true,
  // Hosts that only sometimes allow browser playback, so a single check can't be
  // trusted. Streams that pass through them always use the streaming server on
  // Stremio Web. Google's ad insertion (10's channels) drops the header on some requests.
  notWebReadyHosts: ["dai.google.com"],
};
