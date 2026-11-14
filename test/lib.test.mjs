import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availability, buildManifest, catalogOrder, catalogPaths, cleanGroup, filterOptions, groupOptions, guideDates, guidePaths, guideRow,
  isGenericTitle, parseXmltv, programmesBetween, toProgramme, xmltvTime,
  listTier, mergeHistory, placeChannel, recentlyAired, regionChannels, serviceChannels, showTitle, toMeta, toStream, tvChannels,
  valueSpellings, withSharedNumber,
} from "../src/lib.mjs";
import { describe } from "../src/descriptions.mjs";

const tv = {
  "mjh-fast-b": { name: "Bondi Vet", network: "Seven", logo: "l", mjh_master: "https://i.mjh.nz/.r/b.m3u8" },
  "mjh-seven": { name: "Seven", network: "Seven", chno: 71, logo: "l", mjh_master: "https://i.mjh.nz/.r/seven.m3u8" },
  "mjh-abc": { name: "ABC TV", network: "ABC", chno: 2, logo: "l", mjh_master: "https://i.mjh.nz/.r/abc.m3u8", description: "Aunty." },
  "mjh-fast-a": { name: "All Saints", network: "Seven", logo: "l", mjh_master: "https://i.mjh.nz/.r/a.m3u8" },
  "mjh-clip": { name: "News in 90 Seconds", network: "ABC", hls: false, mjh_master: "https://c.mjh.nz/x" },
  "mjh-radio": { name: "Radio 4", network: "SBS", chno: 304, mjh_master: "https://i.mjh.nz/.r/r.m3u8" },
};

test("regionChannels sorts by channel number, then unnumbered by name, and drops clips and excludes", () => {
  const list = regionChannels(tv, ["mjh-radio"]);
  assert.deepEqual(list.map((c) => c.key), ["mjh-abc", "mjh-seven", "mjh-fast-a", "mjh-fast-b"]);
  assert.equal(list[0].url, "https://i.mjh.nz/.r/abc.m3u8");
  assert.deepEqual(tvChannels(tv, ["mjh-radio"]).map((c) => c.group), ["ABC", "Seven", "Seven", "Seven"]);
});

test("serviceChannels reads one region, drops DRM and excludes, and links through the redirector", () => {
  const service = { name: "Pluto TV", prefix: "plu", stream: "https://jmp2.uk/plu-{id}.m3u8" };
  const json = { regions: { us: { channels: {
    x: { name: "Movies ", chno: 5, group: "Movies", logo: "l", description: "d" },
    y: { name: "Locked", chno: 1, group: "Movies", license_url: "u" },
    z: { name: "News", chno: 2, group: "News: Live" },
    w: { name: "Gone", chno: 3, group: "News" },
  } } } };
  const list = serviceChannels(json, { service: "PlutoTV", region: "us" }, service, ["plu-w"]);
  assert.deepEqual(list.map((c) => [c.key, c.name, c.group, c.url]), [
    ["plu-z", "News", "News Live", "https://jmp2.uk/plu-z.m3u8"],
    ["plu-x", "Movies", "Movies", "https://jmp2.uk/plu-x.m3u8"],
  ]);
  assert.equal(list[1].network, "Pluto TV");
  const rokuJson = { channels: { r: { name: "R", groups: ["News", "Talk"] } } };
  const roku = { prefix: "rok", stream: "{id}" };
  assert.equal(serviceChannels(rokuJson, {}, roku)[0].group, "News");
  assert.equal(serviceChannels(rokuJson, { group: "Roku" }, roku)[0].group, "Roku");
  assert.deepEqual(serviceChannels({ regions: {} }, { region: "xx" }, service), []);
  assert.equal(list[0].chno, undefined, "service numbers only set the order");
  const renamed = serviceChannels({ channels: { s: { name: "S", group: "Sport" } } }, { rename: { Sport: "Sports" } }, roku);
  assert.equal(renamed[0].group, "Sports");
  const twice = { channels: {
    a: { name: "CBS News Boston", chno: 1, group: "News + Opinion" },
    b: { name: "CBS News Boston", chno: 2, group: "Local News" },
  } };
  assert.deepEqual(serviceChannels(twice, {}, roku).map((c) => c.key), ["rok-b"], "keeps the local copy");
});

test("listTier leads with numbered and news channels and ends with single-show ones", () => {
  const mixed = [[1, "Show A"], [2, "Show B"], [3, "Show C"]];
  const single = [[1, "Cheers S1 E1"], [2, "Cheers S1 E2"]];
  for (const group of ["News", "News + Opinion", "Noticias", "Notícias", "Nachrichten", "Nyheter", "News e mondo"]) {
    assert.equal(listTier({ group, programs: single }), 0, group);
  }
  assert.equal(listTier({ group: "Network", chno: 1, programs: single }), 0);
  assert.equal(listTier({ group: "New on Pluto TV", programs: mixed }), 1);
  assert.equal(listTier({ group: "Local News", programs: mixed }), 1);
  assert.equal(listTier({ group: "Comedy" }), 1);
  assert.equal(listTier({ group: "Comedy", programs: single }), 2);
});

test("groupOptions lists groups in first-use order with Other last", () => {
  const chs = [{ group: "Movies" }, { group: "" }, { group: "News" }, { group: "Movies" }, { group: "Other" }];
  assert.deepEqual(groupOptions(chs, "Genre", "Other"), ["Genre", "Movies", "News", "Other"]);
  assert.deepEqual(groupOptions([{ group: "A" }], "Genre", "Other"), ["Genre", "A"]);
  assert.equal(cleanGroup(" Home/Garden?  "), "Home Garden");
  assert.equal(cleanGroup(undefined), "");
});

test("showTitle strips episode markers but keeps show and episode names", () => {
  assert.equal(showTitle("Daria S3 Ep. 310"), "Daria");
  assert.equal(showTitle("All Saints S5 Episode 30"), "All Saints");
  assert.equal(showTitle("Blue Heelers S7 E18"), "Blue Heelers");
  assert.equal(showTitle("Water Rats - S6 E16 - Lazarus"), "Water Rats");
  assert.equal(showTitle("S8 E62 - Sophie - Part 4"), "Sophie - Part 4");
  assert.equal(showTitle("(1996) Wedding - Marilyn & Fisher"), "Wedding - Marilyn & Fisher");
  assert.equal(showTitle("Border Security - Australia's Front Line"), "Border Security - Australia's Front Line");
  assert.ok(isGenericTitle("Season 7 Episode 11"));
  assert.ok(isGenericTitle("Episode 000402"));
  assert.ok(!isGenericTitle("Seinfeld"));
});

test("mergeHistory adds new programs, normalises titles and drops week-old ones", () => {
  const now = 1_000_000;
  const merged = mergeHistory(
    { a: [[now - 8 * 86400, "Old"], [now - 3600, "Kept"]], gone: [[now - 9 * 86400, "Old"]] },
    { a: [[now, "Daria S1 Ep. 2"], [now + 60, "Season 1 Episode 1"]] },
    now,
  );
  assert.deepEqual(merged, { a: [[now - 3600, "Kept"], [now, "Daria"]] });
});

test("recentlyAired puts shows aired across the week first, one-offs last, max 10", () => {
  const day = 86400, now = 100 * day;
  const entries = [
    [now - 5 * day, "Frasier"], [now - 3 * day, "Frasier"], [now - day, "Frasier"],
    [now - 2 * day, "Friends"], [now - 2 * day + 1800, "Friends"], [now - 2 * day + 3600, "Friends"], [now - day, "Friends"],
    [now - 600, "Some Movie"], [now - 7200, "Another Movie"],
    [now + 600, "Not Yet Aired"], [now - 8 * day, "Too Old"], [now - 60, "10 Comedy"],
  ];
  assert.deepEqual(recentlyAired(entries, now, "10 Comedy"), ["Frasier", "Friends", "Some Movie", "Another Movie"]);
  const many = Array.from({ length: 15 }, (_, i) => [now - i * 60, `Show ${i}`]);
  assert.equal(recentlyAired(many, now).length, 10);
});

test("describe uses the curated line, regional fallbacks and templates", () => {
  assert.match(describe("10 Comedy", "Ten"), /comedy channel/);
  assert.equal(describe("Seven Cairns", "Seven"), describe("Seven", "Seven"));
  assert.equal(describe("Channel 9 (Gold Coast)", "Nine"), describe("Channel 9", "Nine"));
  assert.equal(describe("Bondi Vet", "Seven"), "A 24/7 channel on 7plus playing Bondi Vet back to back.");
  assert.equal(describe("Hells Kitchen", "Seven"), "A 24/7 channel on 7plus playing Hell's Kitchen back to back.");
  assert.equal(describe("Brand New Show", "Ten", { singleShowShare: 0.9 }), "A 24/7 channel on 10 playing Brand New Show back to back.");
  assert.equal(describe("Brand New Mix", "Nine"), "A free streaming channel from 9Now.");
});

test("toMeta builds a playable channel meta with a fitted poster and recent shows", () => {
  const ch = { key: "mjh-10peach", name: "10 Comedy", network: "Ten", chno: 11, logo: "https://x/logo.png", mjh_master: "u" };
  const meta = toMeta("au", ch, { poster: "https://site/posters/p.png", recent: ["Frasier", "Friends"] });
  assert.equal(meta.id, "livetv-au-mjh-10peach");
  assert.equal(meta.type, "channels");
  assert.equal(meta.releaseInfo, "Channel 11");
  assert.equal(meta.poster, "https://site/posters/p.png");
  assert.equal(meta.logo, "https://x/logo.png");
  assert.deepEqual(meta.genres, ["Ten"]);
  assert.equal(meta.description, `${describe("10 Comedy", "Ten")}\n\nRecently aired: Frasier, Friends`);
  assert.equal(meta.behaviorHints.defaultVideoId, meta.id);
});

test("toMeta keeps i.mjh.nz's own description and leaves out what's missing", () => {
  const meta = toMeta("au", { key: "mjh-abc", ...tv["mjh-abc"] });
  assert.equal(meta.description, "Aunty.");
  const bare = toMeta("au", { key: "k", name: "X", mjh_master: "u" });
  assert.equal(bare.releaseInfo, undefined);
  assert.equal(bare.genres, undefined);
  assert.equal(bare.poster, undefined);
});

test("streams are plain links that say which regions carry the channel", () => {
  const all = ["Brisbane", "Sydney"];
  assert.equal(availability(all, all), "All regions");
  assert.equal(availability(["Sydney"], all), "Sydney");
  const ch = { name: "10", url: "https://i.mjh.nz/.r/10.m3u8", headers: { "user-agent": "otg/1.5.1" } };
  assert.deepEqual(toStream(ch, "Sydney"),{ name: "Live", title: "10\nSydney", url: "https://i.mjh.nz/.r/10.m3u8" });
});

test("catalogPaths covers encodings and the no-region default", () => {
  assert.deepEqual(valueSpellings("Sydney"), ["Sydney"]);
  assert.deepEqual(valueSpellings("Gold Coast"), ["Gold Coast", "Gold+Coast", "Gold%20Coast"]);
  assert.ok(valueSpellings("Season's Greetings").includes("Season%27s+Greetings"));
  assert.deepEqual(catalogPaths("au", "Sydney", false), ["catalog/channels/au/genre=Sydney.json"]);
  assert.deepEqual(catalogPaths("au", "Brisbane", true), ["catalog/channels/au/genre=Brisbane.json", "catalog/channels/au.json"]);
});

test("placeChannel tells national, city and regional feeds apart", () => {
  const all = ["Sydney", "Melbourne", "Canberra"];
  assert.deepEqual(placeChannel({ name: "SBS", chno: 30 }, all, all), { kind: "national", name: "SBS" });
  assert.deepEqual(placeChannel({ name: "Seven", chno: 71 }, ["Sydney", "Canberra"], all), { kind: "city", name: "Seven (Sydney)" });
  assert.deepEqual(placeChannel({ name: "Seven Cairns" }, ["Sydney"], all), { kind: "other", name: "Seven Cairns" });
});

test("catalogOrder: numbers first (cities by population), then national by name, then regional", () => {
  const e = (name, chno, kind, home = 0) => ({ ch: { chno }, place: { kind, name }, home });
  const list = [
    e("Seven Cairns", undefined, "other"), e("Bondi Vet", undefined, "national"), e("Seven (Melbourne)", 71, "city", 1),
    e("ABC Kids", 22, "national"), e("Seven (Sydney)", 71, "city", 0), e("All Saints", undefined, "national"),
  ];
  assert.deepEqual(list.sort(catalogOrder).map((x) => x.place.name),
    ["ABC Kids", "Seven (Sydney)", "Seven (Melbourne)", "All Saints", "Bondi Vet", "Seven Cairns"]);
});

test("regional feeds take their broadcast's number and sort after its city feeds", () => {
  const numbers = { Seven: 71, "Channel 9": 91, "7two": 72 };
  const shared = (name) => withSharedNumber({ name }, (n) => numbers[n]).chno;
  assert.equal(shared("Seven Cairns"), 71);
  assert.equal(shared("Channel 9 (Gold Coast)"), 91);
  assert.equal(shared("7two Regional"), 72);
  assert.equal(shared("Snowy Mountains Television"), undefined);
  assert.equal(withSharedNumber({ name: "Seven Cairns", chno: 5 }, () => 71).chno, 5);
  const e = (name, chno, kind, home = 0) => ({ ch: { chno }, place: { kind, name }, home });
  const list = [e("Snowy", undefined, "other"), e("Seven Cairns", 71, "other", 2), e("Seven (Melbourne)", 71, "city", 1), e("7two", 72, "city")];
  assert.deepEqual(list.sort(catalogOrder).map((x) => x.place.name), ["Seven (Melbourne)", "Seven Cairns", "7two", "Snowy"]);
});

test("manifest has one catalog per country with a required filter: all, regions, other", () => {
  const country = { id: "au", name: "Australia", regions: ["Sydney", "Brisbane"] };
  const labels = { all: "All", other: "Other" };
  assert.deepEqual(filterOptions(country, labels), ["All", "Sydney", "Brisbane", "Other"]);
  const m = buildManifest([{ id: "au", name: "Australia", options: filterOptions(country, labels) }]);
  assert.deepEqual(m.types, ["channels"]);
  assert.deepEqual(m.resources, ["catalog", "meta", "stream"]);
  assert.deepEqual(m.idPrefixes, ["livetv-"]);
  assert.equal(m.catalogs.length, 1);
  const [c] = m.catalogs;
  assert.equal(c.name, "Australia");
  assert.deepEqual(c.extra, [{ name: "genre", options: ["All", "Sydney", "Brisbane", "Other"], isRequired: true }]);
  assert.deepEqual(c.genres, c.extra[0].options);
  assert.deepEqual(c.extraRequired, ["genre"]);
});

test("manifest marks guide catalogs with an optional date and the addon as an EPG provider", () => {
  const plain = buildManifest([{ id: "us", name: "United States", options: ["All"] }]);
  assert.equal(plain.behaviorHints.epgProvider, undefined, "no guide, no EPG hint");
  const m = buildManifest([{ id: "au", name: "Australia", options: ["All", "Sydney"], guide: true }, { id: "us", name: "United States", options: ["All"] }]);
  assert.equal(m.behaviorHints.epgProvider, true);
  assert.deepEqual(m.catalogs[0].extra[1], { name: "date" });
  assert.equal(m.catalogs[1].extra.length, 1);
  assert.deepEqual(m.catalogs[0].extraRequired, ["genre"]);
});

const XMLTV = `<?xml version="1.0"?><tv>
  <programme start="20261114010000 +0000" stop="20261114060000 +0000" channel="mjh-seven-syd">
    <title>Seven&apos;s Horse Racing</title>
    <sub-title>Newcastle/Sandown</sub-title>
    <desc>Live coverage &amp; more.</desc>
    <category>Sports</category>
    <icon src="https://img.test/a?x=1&amp;y=2"/>
  </programme>
  <programme start="20261114100000 +1000" stop="20261114110000 +1000" channel="mjh-seven-syd">
    <title>The Morning Show</title>
    <sub-title>Episode 43 of Season 26</sub-title>
  </programme>
  <programme start="20261114120000 +0000" stop="20261114120000 +0000" channel="mjh-seven-syd"><title>Zero length</title></programme>
  <programme channel="mjh-abc" start="20261113230000 +0000" stop="20261114010000 +0000"><title>News</title></programme>
</tv>`;

test("parseXmltv reads programmes by channel, in start order, with times in UTC", () => {
  assert.equal(xmltvTime("20261114100000 +1000"), Date.UTC(2026, 10, 14, 0) / 1000);
  assert.equal(xmltvTime("20261114010000 +0000"), Date.UTC(2026, 10, 14, 1) / 1000);
  const g = parseXmltv(XMLTV);
  assert.deepEqual([...g.keys()], ["mjh-seven-syd", "mjh-abc"], "attribute order doesn't matter");
  const seven = g.get("mjh-seven-syd");
  assert.deepEqual(seven.map((p) => p.title), ["The Morning Show", "Seven's Horse Racing"], "sorted; zero-length dropped");
  assert.deepEqual(seven[1], {
    start: Date.UTC(2026, 10, 14, 1) / 1000, stop: Date.UTC(2026, 10, 14, 6) / 1000, title: "Seven's Horse Racing",
    subTitle: "Newcastle/Sandown", desc: "Live coverage & more.", categories: ["Sports"], icon: "https://img.test/a?x=1&y=2",
  });
});

test("programmes become Stremio videos with start and end times; episode-number sub-titles are dropped", () => {
  const [morning, racing] = parseXmltv(XMLTV).get("mjh-seven-syd");
  assert.deepEqual(toProgramme("livetv-au-mjh-seven-syd", racing), {
    id: `livetv-au-mjh-seven-syd:epg:${Date.UTC(2026, 10, 14, 1) / 1000}`,
    title: "Seven's Horse Racing",
    released: "2026-11-14T01:00:00.000Z",
    startTime: "2026-11-14T01:00:00.000Z",
    endTime: "2026-11-14T06:00:00.000Z",
    overview: "Newcastle/Sandown\nLive coverage & more.",
    thumbnail: "https://img.test/a?x=1&y=2",
    genres: ["Sports"],
  });
  assert.equal(toProgramme("x", morning).overview, undefined);
});

test("guide pages: UTC days around now, programmes overlapping the day, date-first paths", () => {
  const now = Date.UTC(2026, 10, 14, 0, 30) / 1000;
  assert.deepEqual(guideDates(now, { past: 1, ahead: 2 }), ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]);
  const g = parseXmltv(XMLTV);
  assert.deepEqual(programmesBetween(g.get("mjh-abc"), now, now + 60).map((p) => p.title), ["News"]);
  const meta = { id: "livetv-au-mjh-abc", type: "channels", name: "ABC TV", poster: "p", posterShape: "square", description: "long", behaviorHints: { defaultVideoId: "x" } };
  const day13 = guideRow(meta, g.get("mjh-abc"), "2026-11-13");
  assert.deepEqual(day13.videos.map((v) => v.title), ["News"], "a show spanning midnight is on both days");
  assert.equal(guideRow(meta, g.get("mjh-abc"), "2026-11-14").videos.length, 1);
  assert.deepEqual(guideRow(meta, g.get("mjh-abc"), "2026-11-15").videos, []);
  assert.deepEqual(guideRow(meta, undefined, "2026-11-15").videos, [], "channels without a guide still get a row");
  assert.equal(day13.description, undefined, "rows stay lean");
  assert.deepEqual(day13.behaviorHints, { isLive: true, hasScheduledVideos: true });
  assert.deepEqual(guidePaths("au", "Sydney", "2026-11-14"), ["catalog/channels/au/date=2026-11-14&genre=Sydney.json"]);
  assert.deepEqual(guidePaths("us", "News + Opinion", "2026-11-14"), [
    "catalog/channels/us/date=2026-11-14&genre=News + Opinion.json",
    "catalog/channels/us/date=2026-11-14&genre=News%20%2B%20Opinion.json",
  ]);
});

test("toMeta with a schedule marks the channel live", () => {
  const ch = { key: "mjh-abc", name: "ABC TV", network: "ABC", chno: 2 };
  const m = toMeta("au", ch, { videos: [] });
  assert.deepEqual(m.behaviorHints, { defaultVideoId: "livetv-au-mjh-abc", isLive: true, hasScheduledVideos: true });
  assert.deepEqual(m.videos, []);
  assert.deepEqual(toMeta("au", ch).behaviorHints, { defaultVideoId: "livetv-au-mjh-abc" });
});
