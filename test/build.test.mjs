// End-to-end build against a fake i.mjh.nz. No network needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../scripts/build.mjs";

const countries = [{ id: "au", name: "Australia", source: "https://fake.test/au", regions: ["Brisbane", "Sydney"] }];
const config = { exclude: [], minChannelsPerRegion: 2 };

const national = { "mjh-abc": { name: "ABC TV", network: "ABC", chno: 2, mjh_master: "https://i.mjh.nz/.r/abc.m3u8" } };
const data = {
  Brisbane: { ...national, "mjh-seven-bne": { name: "Seven", network: "Seven", chno: 71, mjh_master: "https://i.mjh.nz/.r/seven-bne.m3u8" } },
  Sydney: { ...national, "mjh-seven-syd": { name: "Seven", network: "Seven", chno: 71, mjh_master: "https://i.mjh.nz/.r/seven-syd.m3u8" } },
};

const fakeFetch = (overrides = {}) => async (url) => {
  const region = url.match(/au\/([^/]+)\/tv\.json$/)?.[1];
  const body = region in overrides ? overrides[region] : data[region];
  return body ? { ok: true, json: async () => body } : { ok: false, status: 404 };
};

const read = async (dir, rel) => JSON.parse(await readFile(join(dir, rel), "utf8"));

test("builds catalogs per region, one meta and stream per channel", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "live-channels-"));
  const report = await build({ fetchImpl: fakeFetch(), countries, config, outDir, log: () => {} });
  assert.equal(report.channels, 3);

  const bne = await read(outDir, "catalog/channel/au/genre=Brisbane.json");
  assert.deepEqual(bne.metas.map((m) => m.id), ["livetv-au-mjh-abc", "livetv-au-mjh-seven-bne"]);
  assert.deepEqual(await read(outDir, "catalog/channel/au.json"), bne, "no region falls back to the first one");

  const abc = await read(outDir, "stream/channel/livetv-au-mjh-abc.json");
  assert.equal(abc.streams[0].title, "ABC TV\nAll regions");
  const syd = await read(outDir, "stream/channel/livetv-au-mjh-seven-syd.json");
  assert.equal(syd.streams[0].title, "Seven\nSydney");
  assert.equal(syd.streams[0].url, "https://i.mjh.nz/.r/seven-syd.m3u8");

  assert.equal((await read(outDir, "meta/channel/livetv-au-mjh-abc.json")).meta.name, "ABC TV");
  assert.equal((await read(outDir, "manifest.json")).catalogs[0].name, "Australia");
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("refuses to publish when a region comes back short", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "live-channels-"));
  await assert.rejects(
    build({ fetchImpl: fakeFetch({ Sydney: national }), countries, config, outDir, log: () => {} }),
    /Sydney has only 1 channels/,
  );
});
