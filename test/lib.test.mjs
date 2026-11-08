import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availability, buildManifest, catalogOrder, catalogPaths, filterOptions, isGenericTitle, mergeHistory, placeChannel,
  recentlyAired, regionChannels, showTitle, toMeta, toStream, valueSpellings,
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
  const keys = regionChannels(tv, ["mjh-radio"]).map((c) => c.key);
  assert.deepEqual(keys, ["mjh-abc", "mjh-seven", "mjh-fast-a", "mjh-fast-b"]);
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
  assert.equal(meta.type, "Channels");
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
  const ch = { name: "10", mjh_master: "https://i.mjh.nz/.r/10.m3u8", headers: { "user-agent": "otg/1.5.1" } };
  assert.deepEqual(toStream(ch, ["Sydney"], all), { name: "Live", title: "10\nSydney", url: "https://i.mjh.nz/.r/10.m3u8" });
});

test("catalogPaths covers encodings and the no-region default", () => {
  assert.deepEqual(valueSpellings("Sydney"), ["Sydney"]);
  assert.deepEqual(valueSpellings("Gold Coast"), ["Gold Coast", "Gold+Coast", "Gold%20Coast"]);
  assert.deepEqual(catalogPaths("au", "Sydney", false), ["catalog/Channels/au/genre=Sydney.json"]);
  assert.deepEqual(catalogPaths("au", "Brisbane", true), ["catalog/Channels/au/genre=Brisbane.json", "catalog/Channels/au.json"]);
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

test("manifest has one catalog per country with a required filter: all, regions, other", () => {
  const country = { id: "au", name: "Australia", regions: ["Sydney", "Brisbane"] };
  const labels = { all: "City", other: "Other" };
  assert.deepEqual(filterOptions(country, labels), ["City", "Sydney", "Brisbane", "Other"]);
  const m = buildManifest([country], labels);
  assert.deepEqual(m.types, ["Channels"]);
  assert.deepEqual(m.resources, ["catalog", "meta", "stream"]);
  assert.deepEqual(m.idPrefixes, ["livetv-"]);
  assert.equal(m.catalogs.length, 1);
  const [c] = m.catalogs;
  assert.equal(c.name, "Australia");
  assert.deepEqual(c.extra, [{ name: "genre", options: ["City", "Sydney", "Brisbane", "Other"], isRequired: true }]);
  assert.deepEqual(c.genres, c.extra[0].options);
  assert.deepEqual(c.extraRequired, ["genre"]);
});
