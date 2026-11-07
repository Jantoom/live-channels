import { test } from "node:test";
import assert from "node:assert/strict";
import { availability, buildManifest, catalogPaths, regionChannels, toMeta, toStream, valueSpellings } from "../src/lib.mjs";

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

test("toMeta builds a playable channel meta", () => {
  const meta = toMeta("au", { key: "mjh-abc", ...tv["mjh-abc"] });
  assert.equal(meta.id, "livetv-au-mjh-abc");
  assert.equal(meta.type, "channel");
  assert.equal(meta.releaseInfo, "Ch 2");
  assert.deepEqual(meta.genres, ["ABC"]);
  assert.equal(meta.description, "Aunty.\n\nABC · channel 2");
  assert.equal(meta.behaviorHints.defaultVideoId, meta.id);
});

test("toMeta leaves out what the channel doesn't have", () => {
  const meta = toMeta("au", { key: "k", name: "X", mjh_master: "u" });
  assert.equal(meta.releaseInfo, undefined);
  assert.equal(meta.genres, undefined);
  assert.equal(meta.description, undefined);
});

test("streams say which regions carry the channel", () => {
  const all = ["Brisbane", "Sydney"];
  assert.equal(availability(all, all), "All regions");
  assert.equal(availability(["Sydney"], all), "Sydney");
  const s = toStream({ name: "Seven", mjh_master: "https://i.mjh.nz/.r/seven.m3u8" }, ["Sydney"], all);
  assert.equal(s.url, "https://i.mjh.nz/.r/seven.m3u8");
  assert.equal(s.title, "Seven\nSydney");
});

test("catalogPaths covers encodings and the no-region default", () => {
  assert.deepEqual(valueSpellings("Sydney"), ["Sydney"]);
  assert.deepEqual(valueSpellings("Gold Coast"), ["Gold Coast", "Gold+Coast", "Gold%20Coast"]);
  assert.deepEqual(catalogPaths("au", "Sydney", false), ["catalog/channel/au/genre=Sydney.json"]);
  assert.deepEqual(catalogPaths("au", "Brisbane", true), ["catalog/channel/au/genre=Brisbane.json", "catalog/channel/au.json"]);
});

test("manifest has one catalog per country with a required region filter", () => {
  const m = buildManifest([{ id: "au", name: "Australia", regions: ["Brisbane", "Sydney"] }]);
  assert.deepEqual(m.types, ["channel"]);
  assert.equal(m.catalogs.length, 1);
  const [c] = m.catalogs;
  assert.equal(c.name, "Australia");
  assert.deepEqual(c.extra, [{ name: "genre", options: ["Brisbane", "Sydney"], isRequired: true }]);
  assert.deepEqual(c.extraRequired, ["genre"]);
  assert.ok(m.resources.some((r) => r.name === "stream" && r.idPrefixes[0] === "livetv-"));
});
