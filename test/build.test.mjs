// End-to-end build against a fake i.mjh.nz. No network needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { build } from "../scripts/build.mjs";

const NOW = 2_000_000_000;
const countries = [{ id: "au", name: "Australia", source: "https://fake.test/au", regions: ["Brisbane", "Sydney"] }];
const config = { exclude: [], minChannelsPerRegion: 2, probeWebPlayback: true, notWebReadyHosts: ["flaky.test"] };

const national = {
  "mjh-abc": {
    name: "ABC TV", network: "ABC", chno: 2, logo: "https://logos.test/abc.png", mjh_master: "https://i.mjh.nz/.r/abc.m3u8",
    programs: [[NOW - 3600, "Gardening Australia"], [NOW + 3600, "Later Show"]],
  },
};
const data = {
  Brisbane: { ...national, "mjh-10-qld": { name: "10", network: "Ten", chno: 10, logo: "https://logos.test/broken.png", mjh_master: "https://i.mjh.nz/.r/10-qld.m3u8" } },
  Sydney: {
    ...national,
    "mjh-seven-syd": { name: "Seven", network: "Seven", chno: 71, mjh_master: "https://i.mjh.nz/.r/seven-syd.m3u8" },
    "mjh-flaky": { name: "Flaky", network: "Ten", mjh_master: "https://i.mjh.nz/.r/flaky.m3u8" },
  },
};
const previousHistory = { "mjh-abc": [[NOW - 2 * 86400, "Gardening Australia"]] };

const wideLogo = await sharp({ create: { width: 300, height: 100, channels: 4, background: "#ff0000" } }).png().toBuffer();
const headers = (h = {}) => ({ get: (k) => h[k.toLowerCase()] ?? null });
const json = (body) => ({ ok: true, status: 200, headers: headers(), json: async () => body });
const notFound = { ok: false, status: 404, headers: headers() };

const fakeFetch = ({ regions = {}, history = previousHistory } = {}) => async (input) => {
  const url = String(input);
  const region = url.match(/au\/([^/]+)\/tv\.json$/)?.[1];
  if (region) { const body = region in regions ? regions[region] : data[region]; return body ? json(body) : notFound; }
  if (url.endsWith("/history.json")) return history ? json(history) : notFound;
  if (url === "https://logos.test/abc.png") return { ok: true, status: 200, headers: headers(), arrayBuffer: async () => wideLogo };
  if (url.startsWith("https://logos.test/")) return notFound;
  // Streams: 10 redirects to an ad server whose own redirect leaves out the CORS
  // header (its final playlist allows the null origin, which isn't enough); the
  // rest allow any origin.
  const redirect = (location, h = {}) => ({ ok: false, status: 302, headers: headers({ location, ...h }) });
  if (url === "https://i.mjh.nz/.r/10-qld.m3u8") return redirect("https://dai.test/master.m3u8", { "access-control-allow-origin": "*" });
  if (url === "https://dai.test/master.m3u8") return redirect("/stream.m3u8");
  if (url === "https://dai.test/stream.m3u8") return { ok: true, status: 200, headers: headers({ "access-control-allow-origin": "null" }) };
  // Passes when checked, but its host is listed as unreliable.
  if (url === "https://i.mjh.nz/.r/flaky.m3u8") return redirect("https://flaky.test/master.m3u8", { "access-control-allow-origin": "*" });
  if (url.startsWith("https://flaky.test/")) return { ok: true, status: 200, headers: headers({ "access-control-allow-origin": "*" }) };
  if (url.startsWith("https://i.mjh.nz/.r/")) return { ok: true, status: 200, headers: headers({ "access-control-allow-origin": "*" }) };
  return notFound;
};

const read = async (dir, rel) => JSON.parse(await readFile(join(dir, rel), "utf8"));
const run = async (opts = {}) => {
  const outDir = await mkdtemp(join(tmpdir(), "live-channels-"));
  const cacheDir = await mkdtemp(join(tmpdir(), "live-channels-cache-"));
  const report = await build({ fetchImpl: fakeFetch(opts), countries, config, outDir, cacheDir, siteUrl: "https://site.test/", now: NOW, log: () => {} });
  return { outDir, report };
};

test("builds catalogs per region, one meta and stream per channel", async () => {
  const { outDir, report } = await run();
  assert.equal(report.channels, 4);

  const bne = await read(outDir, "catalog/channel/au/genre=Brisbane.json");
  assert.deepEqual(bne.metas.map((m) => m.id), ["livetv-au-mjh-abc", "livetv-au-mjh-10-qld"]);
  assert.deepEqual(await read(outDir, "catalog/channel/au.json"), bne, "no region falls back to the first one");

  const abc = await read(outDir, "stream/channel/livetv-au-mjh-abc.json");
  assert.equal(abc.streams[0].title, "ABC TV\nAll regions");
  const syd = await read(outDir, "stream/channel/livetv-au-mjh-seven-syd.json");
  assert.equal(syd.streams[0].title, "Seven\nSydney");
  assert.equal(syd.streams[0].url, "https://i.mjh.nz/.r/seven-syd.m3u8");
  assert.equal((await read(outDir, "manifest.json")).catalogs[0].name, "Australia");
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("logos become square posters with the whole logo inside; failures fall back to the logo", async () => {
  const { outDir, report } = await run();
  const abc = (await read(outDir, "meta/channel/livetv-au-mjh-abc.json")).meta;
  assert.match(abc.poster, /^https:\/\/site\.test\/posters\/[0-9a-f]{16}\.png$/);
  const png = join(outDir, "posters", abc.poster.split("/").pop());
  const { width, height } = await sharp(png).metadata();
  assert.deepEqual([width, height], [400, 400]);
  const ten = (await read(outDir, "meta/channel/livetv-au-mjh-10-qld.json")).meta;
  assert.equal(ten.poster, "https://logos.test/broken.png");
  assert.equal(report.posters, 1);
  assert.ok(report.warnings.some((w) => w.includes("broken.png")));
});

test("descriptions carry recently aired shows from the merged history", async () => {
  const { outDir } = await run();
  const abc = (await read(outDir, "meta/channel/livetv-au-mjh-abc.json")).meta;
  assert.equal(abc.releaseInfo, "Channel 2");
  assert.match(abc.description, /\n\nRecently aired: Gardening Australia$/);
  const history = await read(outDir, "history.json");
  assert.deepEqual(history["mjh-abc"].map(([, t]) => t), ["Gardening Australia", "Gardening Australia", "Later Show"]);
});

test("a missing history only warns", async () => {
  const { outDir, report } = await run({ history: null });
  assert.ok(report.warnings.some((w) => w.startsWith("No previous schedule history")));
  assert.match((await read(outDir, "meta/channel/livetv-au-mjh-abc.json")).meta.description, /Recently aired: Gardening Australia/);
});

test("streams whose host refuses other sites are marked for the streaming server", async () => {
  const { outDir, report } = await run();
  assert.deepEqual((await read(outDir, "stream/channel/livetv-au-mjh-10-qld.json")).streams[0].behaviorHints, { notWebReady: true });
  assert.equal((await read(outDir, "stream/channel/livetv-au-mjh-abc.json")).streams[0].behaviorHints, undefined);
  assert.deepEqual(report.notWebReady.sort(), ["mjh-10-qld", "mjh-flaky"]);
});

test("refuses to publish when a region comes back short", async () => {
  await assert.rejects(run({ regions: { Sydney: national } }), /Sydney has only 1 channels/);
});
