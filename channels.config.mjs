// Everything you'd normally change lives here. Push a change and the workflow rebuilds.
//
// Each country is one catalog in Stremio's Discover (channels → <country name>),
// in the order listed. There are two kinds:
//
// The first option in every dropdown is filterLabels.all: every channel. It's
// what Stremio opens on and what clients that send no filter get.
//
// - City-based (Australia): `source` and `regions`. i.mjh.nz publishes
//   <source>/<region>/tv.json per city. After "all", the dropdown lists:
//     - each region: the channels that region receives. City feeds are named
//       after their city ("Seven (Sydney)") so you can tell which version you're
//       watching.
//     - filterLabels.other: regional feeds outside the capitals ("Seven Cairns").
//
// - Service-based (everywhere else): `sources`, each one of
//     { service, region }  a free streaming service's lineup for one country;
//                          `rename` merges its group names with another source's
//     { service, group }   a single-region service, all filed under one option
//     { tv, guide }        a single i.mjh.nz tv.json, grouped by network, and its
//                          XMLTV programme guide
//   After "all", the dropdown lists the services' own groups. A channel two
//   sources share by name is only listed from the first.

export const countries = [
  {
    id: "au",
    name: "Australia",
    // Listed from most to least populous; a feed shared by two cities is named
    // after the first one ("Seven (Sydney)" also serves Canberra).
    source: "https://i.mjh.nz/au",
    regions: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Hobart", "Darwin"],
    // Programme guide: i.mjh.nz's XMLTV file in each region's folder. Any guide
    // (here, or on a service or tv source) turns the country's catalog into
    // Stremio's TV guide grid (Discover, day by day), filtered by the same
    // dropdown. Remove them all to go back to a plain channel list.
    guide: "epg.xml.gz",
  },
  // The rest, from most to least populous.
  { id: "us", name: "United States", sources: [{ service: "PlutoTV", region: "us" }, { service: "Roku", group: "The Roku Channel" }] },
  { id: "br", name: "Brazil", sources: [{ service: "PlutoTV", region: "br" }] },
  { id: "mx", name: "Mexico", sources: [{ service: "PlutoTV", region: "mx" }] },
  { id: "de", name: "Germany", sources: [{ service: "PlutoTV", region: "de" }] },
  // Samsung first: it's the only source of Sky News, GB News and Talk.
  { id: "gb", name: "United Kingdom", sources: [{ service: "SamsungTVPlus", region: "gb", rename: { Sport: "Sports", "Music & Ambient": "Music" } }, { service: "PlutoTV", region: "gb" }] },
  { id: "fr", name: "France", sources: [{ service: "PlutoTV", region: "fr" }] },
  { id: "it", name: "Italy", sources: [{ service: "PlutoTV", region: "it" }] },
  { id: "es", name: "Spain", sources: [{ service: "PlutoTV", region: "es" }] },
  { id: "ar", name: "Argentina", sources: [{ service: "PlutoTV", region: "ar" }] },
  { id: "ca", name: "Canada", sources: [{ service: "PlutoTV", region: "ca" }] },
  // No Chile: i.mjh.nz's Pluto TV "cl" lineup is currently a copy of Canada's.
  { id: "se", name: "Sweden", sources: [{ service: "PlutoTV", region: "se" }] },
  { id: "dk", name: "Denmark", sources: [{ service: "PlutoTV", region: "dk" }] },
  { id: "no", name: "Norway", sources: [{ service: "PlutoTV", region: "no" }] },
  { id: "nz", name: "New Zealand", sources: [{ tv: "https://i.mjh.nz/nz/tv.json", guide: "https://i.mjh.nz/nz/epg.xml.gz" }] },
];

// Free streaming services i.mjh.nz lists channels for. Keys are what `service`
// refers to above; `prefix` starts each channel's id. `guide` is the service's
// XMLTV programme guide ({region} is the source's region, or "all"). Samsung TV Plus is only
// used for the UK: most of its US channels refuse viewers outside the US, and
// it adds little people would recognise there.
export const services = {
  SamsungTVPlus: { name: "Samsung TV Plus", prefix: "stvp", channels: "https://i.mjh.nz/SamsungTVPlus/.channels.json", stream: "https://jmp2.uk/stvp-{id}", guide: "https://i.mjh.nz/SamsungTVPlus/{region}.xml.gz" },
  PlutoTV: { name: "Pluto TV", prefix: "plu", channels: "https://i.mjh.nz/PlutoTV/.channels.json", stream: "https://jmp2.uk/plu-{id}.m3u8", guide: "https://i.mjh.nz/PlutoTV/{region}.xml.gz" },
  Roku: { name: "The Roku Channel", prefix: "rok", channels: "https://i.mjh.nz/Roku/.channels.json", stream: "https://jmp2.uk/rok-{id}.m3u8", guide: "https://i.mjh.nz/Roku/all.xml.gz" },
};

export const config = {
  filterLabels: { all: "All", other: "Other" },
  // Channels to hide, by id: the part of the addon's id after "livetv-<country>-",
  // e.g. "mjh-sbs-sbs-radio-4" or "plu-5ba3fb9c4b078e0f37ad34e8".
  exclude: [],
  // A city or source with fewer channels than this fails the build, so a bad
  // fetch can't replace the last good deployment with a near-empty list.
  minChannelsPerRegion: 20,
  // 24/7 channels that only play one show (Bondi Vet, Judge Judy, Forensic
  // Files…) are left out: Stremio can find the show itself. A channel counts
  // when one show fills `share` of the next 24 hours of its guide, or, with
  // under `minHours` of guide, of its past week's history (at least
  // `minAirings` programmes). News, music, sport, racing, live and parliament
  // channels always stay. `names` are dropped regardless: single-show channels
  // the guide can't settle (no guide, or a spin-off mixed in). `keep` is kept
  // regardless. Both take channel names as i.mjh.nz spells them (any country,
  // any case) or ids (same form as `exclude`). report.json lists what was
  // dropped, "(listed)" for `names`. drop: false turns it all off.
  singleShow: {
    drop: true, share: 0.95, minHours: 6, minAirings: 8,
    names: [
      // Australia: no guide at all
      "Seinfeld", "The Block 24/7", "Married At First Sight", "Dance Moms 24/7", "60 Minutes Australia",
      "BBC Top Gear", "BBC Antiques Roadshow", "Taronga 24/7", "Insight", "Dateline", "The Cook Up",
      // Australia: about an hour of guide, titled by episode
      "NCIS", "Mythbusters", "Kitchen Nightmares", "Hells Kitchen", "Below Deck Vault", "Wicked Tuna",
      "Ghost Hunters", "Escape to the Country", "Botched VAULT", "Million Dollar Listing VAULT",
      "The Real Housewives VAULT", "Winners & Losers", "Antiques Road Trip", "A Country Practice",
      "Hardcore Pawn", "Home and Away Classics", "The Yorkshire Vet", "24 Hours in A&E",
      "CSI Crime Scene Investigation", "Trucking Hell",
      // One show plus its spin-offs or specials
      "Undercover Boss", "Heartland", "Warner Bros TV House Hunters", "Baywatch", "Leave it to Bryan",
      "Top Gear", "Unsolved Mysteries", "Geordie Shore", "COPS", "Mayday: Air Disaster", "Tiny House Nation",
      "48 Hours", "PBS Nature", "Ghosts", "Bad Girls Club", "Garfield and Friends", "Cold Case Files by A&E",
      "Matched Married Meet by Lifetime", "Highway Thru Hell", "Pitufo TV", "Go Go Gadget!",
      "Profiling Paris", "Täterjagd", "Dating Naked UK", "The L Word – Wenn Frauen lieben",
      "Die Sieben-Millionen-Dollar-Frau", "Saving Hope", "MTV Ridiculousness", "Germany Shore", "Red Shoe Diaries",
      "MTV Jerseys", "Archivos Forenses", "Faites entrer l'accusé", "Beyblade", "Rugrats", "Captain Tsubasa",
      "Hunter x Hunter", "MasterChef Colombia", "MTV Shore", "As Tartarugas Ninja", "Dora, A Aventureira",
      "Caçadores de Óvnis", "Popeye", "Mais MasterChef Brasil", "Beavis and Butt-Head", "Jakt är Jakt", "Avatar",
    ],
    // A network feed whose guide titles every slot with its own name.
    keep: ["TV Cultura", "Azteca UNO -1 hora"],
  },
  // Guide pages are written for these UTC days around the build. The XMLTV data
  // runs about a week ahead and a few hours back; days outside it still list
  // the channels, just without programmes, rather than showing an error.
  guideDays: { past: 7, ahead: 10 },
  // How much of the guide each channel's own page carries, in hours from the build.
  guideMetaHours: { past: 3, ahead: 24 },
};
