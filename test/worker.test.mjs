import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { canonicalPath } from "../src/worker.mjs";
import { buildManifest, configureManifest, parseSettings } from "../src/lib.mjs";

test("catalog paths become the encoded form Cloudflare serves files at", () => {
  assert.equal(canonicalPath("/catalog/channels/au/genre=Sydney.json"), "/catalog/channels/au/genre%3DSydney.json");
  assert.equal(canonicalPath("/catalog/channels/ar/genre=Pel%C3%ADculas.json"), "/catalog/channels/ar/genre%3DPel%C3%ADculas.json");
  assert.equal(canonicalPath("/catalog/channels/us/genre=Season's+Greetings.json"), "/catalog/channels/us/genre%3DSeason's%2BGreetings.json", "+ stays a +");
  assert.equal(canonicalPath("/catalog/channels/us/date=2026-11-21&genre=News%20%2B%20Opinion.json"), "/catalog/channels/us/date%3D2026-11-21%26genre%3DNews%20%2B%20Opinion.json");
  assert.equal(canonicalPath("/catalog/channels/bad%E0.json"), "/catalog/channels/bad%E0.json", "a malformed segment is left alone");
});

test("the Worker fetches the file at its canonical path", async () => {
  let asked;
  const env = { ASSETS: { fetch: async (req) => { asked = new URL(req.url ?? req).pathname; return new Response("{}"); } } };
  await worker.fetch(new Request("https://addon.test/catalog/channels/au/genre=Sydney.json"), env);
  assert.equal(asked, "/catalog/channels/au/genre%3DSydney.json");
});

const site = (files) => {
  const asked = [];
  const env = { ASSETS: { fetch: async (req) => {
    const path = decodeURIComponent(new URL(req.url ?? req).pathname);
    asked.push(path);
    return path in files ? new Response(files[path]) : new Response("Not found", { status: 404 });
  } } };
  return { asked, get: async (p) => worker.fetch(new Request(`https://addon.test${p}`), env) };
};
const manifest = buildManifest([
  { id: "au", name: "Australia", options: ["All", "Sydney"], guide: true },
  { id: "nz", name: "New Zealand", options: ["All"], guide: false },
  { id: "us", name: "United States", options: ["All", "News + Opinion"], guide: true },
]);

test("settings pick the countries; a configured manifest has only theirs", () => {
  assert.equal(parseSettings("manifest.json"), undefined);
  assert.equal(parseSettings("catalogs=au"), undefined, "only countries");
  assert.deepEqual([...parseSettings("countries=au,us,nonsense").countries], ["au", "us"]);
  assert.equal(manifest.behaviorHints.configurable, true, "Stremio shows a Configure button");
  assert.deepEqual(configureManifest(manifest, parseSettings("countries=nz,au")).catalogs.map((c) => c.id), ["au", "nz"], "in the addon's order");
});

test("a configured install gets its trimmed manifest, the same files, and Configure opens the install page", async () => {
  const { get, asked } = site({ "/manifest.json": JSON.stringify(manifest), "/catalog/channels/au/genre=Sydney.json": "{\"metas\":[1]}", "/": "<!doctype html>" });
  const res = await get("/countries=au/manifest.json");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual((await res.json()).catalogs.map((c) => c.id), ["au"]);
  assert.deepEqual(await (await get("/countries=au/catalog/channels/au/genre=Sydney.json")).json(), { metas: [1] });
  assert.equal(asked.at(-1), "/catalog/channels/au/genre=Sydney.json");
  assert.equal(await (await get("/countries=au/configure")).text(), "<!doctype html>");
  assert.equal(await (await get("/configure")).text(), "<!doctype html>", "the plain install's Configure button too");
});
