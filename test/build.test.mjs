// End-to-end build against a fake i.mjh.nz. No network needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { build } from "../scripts/build.mjs";

const NOW = 2_000_000_000;
const countries = [
  { id: "au", name: "Australia", source: "https://fake.test/au", regions: ["Brisbane", "Sydney"], guide: "epg.xml.gz" },
  { id: "us", name: "United States", sources: [{ service: "Fast", region: "us" }, { service: "Mono", group: "Mono TV" }] },
];
const services = {
  Fast: { name: "Fast TV", prefix: "f", channels: "https://fake.test/fast.json", stream: "https://jmp.test/f-{id}.m3u8" },
  Mono: { name: "Mono", prefix: "m", channels: "https://fake.test/mono.json", stream: "https://jmp.test/m-{id}.m3u8" },
};
const fast = { regions: { us: { channels: {
  a: { name: "News Now", chno: 2, group: "News", programs: [[NOW - 600, "Headlines"]] },
  b: { name: "Movies 1", chno: 1, group: "Movies" },
  c: { name: "Locked", chno: 4, group: "Movies", license_url: "https://drm.test" },
  d: { name: "Odd", chno: 3, group: "", programs: [[NOW - 7200, "Odd Show"], [NOW - 3600, "Odd Show"]] },
} } } };
const mono = { channels: { m1: { name: "News Now", groups: ["News"] }, m2: { name: "Mono Show", chno: 9, groups: ["Drama"] } } };
const config = {
  exclude: [], minChannelsPerRegion: 2,
  filterLabels: { all: "All", other: "Other" },
  guideDays: { past: 1, ahead: 1 },
  guideMetaHours: { past: 6, ahead: 48 },
};

const national = {
  "mjh-abc": {
    name: "ABC TV", network: "ABC", chno: 2, logo: "https://logos.test/abc.png", mjh_master: "https://i.mjh.nz/.r/abc.m3u8",
    programs: [[NOW - 3600, "Gardening Australia"], [NOW + 3600, "Later Show"]],
  },
};
const data = {
  Brisbane: {
    ...national,
    "mjh-10-qld": { name: "10", network: "Ten", chno: 10, logo: "https://logos.test/broken.png", mjh_master: "https://i.mjh.nz/.r/10-qld.m3u8" },
  },
  Sydney: {
    ...national,
    "mjh-seven-syd": { name: "Seven", network: "Seven", chno: 71, mjh_master: "https://i.mjh.nz/.r/seven-syd.m3u8" },
    "mjh-flaky": { name: "Flaky", network: "Ten", mjh_master: "https://i.mjh.nz/.r/flaky.m3u8" },
    "mjh-seven-cns": { name: "Seven Cairns", network: "Seven", mjh_master: "https://i.mjh.nz/.r/seven-cns.m3u8" },
  },
};
// NOW is 2033-05-18T03:33:20Z. Brisbane has a guide; Sydney's is missing.
const xt = (t) => new Date(t * 1000).toISOString().replace(/[-:T]/g, "").slice(0, 14) + " +0000";
const epg = gzipSync(`<tv>
  <programme start="${xt(NOW - 1800)}" stop="${xt(NOW + 1800)}" channel="mjh-abc"><title>Gardening Australia</title><desc>Tips.</desc></programme>
  <programme start="${xt(NOW + 1800)}" stop="${xt(NOW + 5400)}" channel="mjh-abc"><title>Later Show</title></programme>
  <programme start="${xt(NOW + 3 * 86400)}" stop="${xt(NOW + 3 * 86400 + 600)}" channel="mjh-abc"><title>Too Far</title></programme>
</tv>`);
const previousHistory = { "livetv-au-mjh-abc": [[NOW - 2 * 86400, "Gardening Australia"]] };

const wideLogo = await sharp({ create: { width: 300, height: 100, channels: 4, background: "#ff0000" } }).png().toBuffer();
const headers = (h = {}) => ({ get: (k) => h[k.toLowerCase()] ?? null });
const json = (body) => ({ ok: true, status: 200, headers: headers(), json: async () => body });
const notFound = { ok: false, status: 404, headers: headers() };

const fakeFetch = ({ regions = {}, history = previousHistory } = {}) => async (input) => {
  const url = String(input);
  const region = url.match(/au\/([^/]+)\/tv\.json$/)?.[1];
  if (region) { const body = region in regions ? regions[region] : data[region]; return body ? json(body) : notFound; }
  if (url === services.Fast.channels) return json(fast);
  if (url === services.Mono.channels) return json(mono);
  if (url === "https://fake.test/au/Brisbane/epg.xml.gz") return { ok: true, status: 200, headers: headers(), arrayBuffer: async () => epg };
  if (url.endsWith("/history.json")) return history ? json(history) : notFound;
  if (url === "https://logos.test/abc.png") return { ok: true, status: 200, headers: headers(), arrayBuffer: async () => wideLogo };
  if (url.startsWith("https://logos.test/")) return notFound;
  return notFound;
};

const read = async (dir, rel) => JSON.parse(await readFile(join(dir, rel), "utf8"));
const run = async (opts = {}) => {
  const outDir = await mkdtemp(join(tmpdir(), "live-channels-"));
  const cacheDir = await mkdtemp(join(tmpdir(), "live-channels-cache-"));
  const report = await build({ fetchImpl: fakeFetch(opts), countries, services, config, outDir, cacheDir, siteUrl: "https://site.test/", now: NOW, log: () => {} });
  return { outDir, report };
};

test("builds catalogs per region, one meta and stream per channel", async () => {
  const { outDir, report } = await run();
  assert.equal(report.channels, 9);

  const names = async (option) => (await read(outDir, `catalog/channels/au/genre=${option}.json`)).metas.map((m) => m.name);
  assert.deepEqual(await names("Brisbane"), ["ABC TV", "10 (Brisbane)"]);
  assert.deepEqual(await names("Sydney"), ["ABC TV", "Seven (Sydney)"], "regional feeds stay out of city lists");
  assert.deepEqual(await names("Other"), ["Seven Cairns", "Flaky"], "regional feeds with a shared number come first");
  assert.deepEqual(await names("All"), ["ABC TV", "10 (Brisbane)", "Seven (Sydney)", "Seven Cairns", "Flaky"]);
  assert.equal((await read(outDir, "meta/channels/livetv-au-mjh-seven-cns.json")).meta.releaseInfo, "Channel 71");
  assert.equal((await read(outDir, "meta/channels/livetv-au-mjh-flaky.json")).meta.releaseInfo, undefined);
  assert.deepEqual(await read(outDir, "catalog/channels/au.json"), await read(outDir, "catalog/channels/au/genre=All.json"),
    "no filter falls back to the all-channels list");
  assert.deepEqual((await read(outDir, "manifest.json")).catalogs[0].extra[0].options, ["All", "Brisbane", "Sydney", "Other"]);
  assert.equal((await read(outDir, "manifest.json")).catalogs[0].type, "channels");

  const abc = await read(outDir, "stream/channels/livetv-au-mjh-abc.json");
  assert.equal(abc.streams[0].title, "ABC TV\nAll regions");
  const syd = await read(outDir, "stream/channels/livetv-au-mjh-seven-syd.json");
  assert.equal(syd.streams[0].title, "Seven\nSydney");
  assert.equal(syd.streams[0].url, "https://i.mjh.nz/.r/seven-syd.m3u8");
  assert.equal((await read(outDir, "manifest.json")).catalogs[0].name, "Australia");
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("service countries list each source's channels by group, minus DRM and duplicates", async () => {
  const { outDir, report } = await run();
  const manifest = await read(outDir, "manifest.json");
  assert.deepEqual(manifest.catalogs.map((c) => c.name), ["Australia", "United States"]);
  assert.deepEqual(manifest.catalogs[1].extra[0].options, ["All", "Movies", "News", "Mono TV", "Other"]);
  const names = async (option) => (await read(outDir, `catalog/channels/us/genre=${option}.json`)).metas.map((m) => m.name);
  assert.deepEqual(await names("All"), ["News Now", "Movies 1", "Mono Show", "Odd"], "news first, single-show channels last");
  assert.equal((await read(outDir, "meta/channels/livetv-us-f-a.json")).meta.releaseInfo, undefined, "service numbers stay hidden");
  assert.deepEqual(await names("News"), ["News Now"]);
  assert.deepEqual(await names("Mono%20TV"), ["Mono Show"]);
  assert.deepEqual(await names("Other"), ["Odd"]);
  const stream = (await read(outDir, "stream/channels/livetv-us-f-a.json")).streams[0];
  assert.deepEqual(stream, { name: "Live", title: "News Now\nFast TV", url: "https://jmp.test/f-a.m3u8" });
  assert.match((await read(outDir, "meta/channels/livetv-us-f-a.json")).meta.description, /Recently aired: Headlines$/);
  assert.deepEqual(report.countries["United States"], { "Fast TV": 3, Mono: 1, Other: 1 });
});

test("logos become square posters with the whole logo inside; failures fall back to the logo", async () => {
  const { outDir, report } = await run();
  const abc = (await read(outDir, "meta/channels/livetv-au-mjh-abc.json")).meta;
  assert.match(abc.poster, /^https:\/\/site\.test\/posters\/[0-9a-f]{16}\.png$/);
  const png = join(outDir, "posters", abc.poster.split("/").pop());
  const { width, height } = await sharp(png).metadata();
  assert.deepEqual([width, height], [400, 400]);
  const ten = (await read(outDir, "meta/channels/livetv-au-mjh-10-qld.json")).meta;
  assert.equal(ten.poster, "https://logos.test/broken.png");
  assert.equal(report.posters, 1);
  assert.ok(report.warnings.some((w) => w.includes("broken.png")));
});

test("descriptions carry recently aired shows from the merged history", async () => {
  const { outDir } = await run();
  const abc = (await read(outDir, "meta/channels/livetv-au-mjh-abc.json")).meta;
  assert.equal(abc.releaseInfo, "Channel 2");
  assert.match(abc.description, /\n\nRecently aired: Gardening Australia$/);
  const history = await read(outDir, "history.json");
  assert.deepEqual(history["livetv-au-mjh-abc"].map(([, t]) => t), ["Gardening Australia", "Gardening Australia", "Later Show"]);
});

test("a missing history only warns", async () => {
  const { outDir, report } = await run({ history: null });
  assert.ok(report.warnings.some((w) => w.startsWith("No previous schedule history")));
  assert.match((await read(outDir, "meta/channels/livetv-au-mjh-abc.json")).meta.description, /Recently aired: Gardening Australia/);
});

test("refuses to publish when a region comes back short", async () => {
  await assert.rejects(run({ regions: { Sydney: national } }), /Sydney has only 1 channels/);
});

test("Australia gets a programme guide: EPG manifest, live metas, and date pages per city", async () => {
  const { outDir, report } = await run();
  const manifest = await read(outDir, "manifest.json");
  assert.equal(manifest.behaviorHints.epgProvider, true);
  assert.deepEqual(manifest.catalogs[0].extra.map((e) => e.name), ["genre", "date"]);
  assert.equal(manifest.catalogs[1].extra.length, 1, "only guide countries take a date");
  assert.ok(report.warnings.some((w) => w.startsWith("Australia / Sydney: no programme guide")), "a missing guide only warns");
  assert.equal(report.guideChannels, 1);

  const abc = (await read(outDir, "meta/channels/livetv-au-mjh-abc.json")).meta;
  assert.equal(abc.behaviorHints.isLive, true);
  assert.deepEqual(abc.videos.map((v) => v.title), ["Gardening Australia", "Later Show"], "the meta carries the next 48 hours");
  assert.equal(abc.videos[0].id, `livetv-au-mjh-abc:epg:${new Date((NOW - 1800) * 1000).toISOString()}`);
  const seven = (await read(outDir, "meta/channels/livetv-au-mjh-seven-syd.json")).meta;
  assert.deepEqual(seven.videos, [], "no guide data: live, with an empty schedule");
  assert.equal((await read(outDir, "meta/channels/livetv-us-f-a.json")).meta.videos, undefined, "other countries unchanged");

  const list = await read(outDir, "catalog/channels/au/genre=Brisbane.json");
  assert.equal(list.metas[0].videos, undefined, "the plain list leaves the schedule out");
  const page = await read(outDir, "catalog/channels/au/date=2033-05-18&genre=Brisbane.json");
  assert.deepEqual(page.metasDetailed.map((m) => m.name), ["ABC TV", "10 (Brisbane)"], "same channels as the city's list");
  assert.deepEqual(page.metasDetailed[0].videos.map((v) => v.title), ["Gardening Australia", "Later Show"]);
  assert.deepEqual(page.metasDetailed[1].videos, []);
  const sydney = await read(outDir, "catalog/channels/au/date=2033-05-17&genre=Sydney.json");
  assert.deepEqual(sydney.metasDetailed.map((m) => m.name), ["ABC TV", "Seven (Sydney)"]);
  assert.deepEqual(sydney.metasDetailed[0].videos, [], "a day without programmes still lists the channels");
  for (const date of ["2033-05-17", "2033-05-18", "2033-05-19"]) {
    for (const option of ["All", "Brisbane", "Sydney", "Other"]) {
      assert.ok(existsSync(join(outDir, `catalog/channels/au/date=${date}&genre=${option}.json`)), `${date} ${option}`);
    }
  }
  assert.ok(!existsSync(join(outDir, "catalog/channels/au/date=2033-05-20&genre=All.json")));
  assert.ok(!existsSync(join(outDir, "catalog/channels/us/date=2033-05-18&genre=All.json")));
});
