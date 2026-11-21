import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { canonicalPath } from "../src/worker.mjs";

test("catalog paths become the encoded form Cloudflare serves files at", () => {
  assert.equal(canonicalPath("/catalog/channels/au/genre=Sydney.json"), "/catalog/channels/au/genre%3DSydney.json");
  assert.equal(canonicalPath("/catalog/channels/ar/genre=Pel%C3%ADculas.json"), "/catalog/channels/ar/genre%3DPel%C3%ADculas.json");
  assert.equal(canonicalPath("/catalog/channels/us/genre=Season's+Greetings.json"), "/catalog/channels/us/genre%3DSeason's%2BGreetings.json", "+ stays a +");
  assert.equal(canonicalPath("/catalog/channels/us/date=2026-11-21&genre=News%20%2B%20Opinion.json"), "/catalog/channels/us/date%3D2026-11-21%26genre%3DNews%20%2B%20Opinion.json");
  assert.equal(canonicalPath("/catalog/channels/bad%E0.json"), "/catalog/channels/bad%E0.json", "a malformed segment is left alone");
});

test("the Worker fetches the file at its canonical path", async () => {
  let asked;
  const env = { ASSETS: { fetch: async (req) => { asked = new URL(req.url).pathname; return new Response("{}"); } } };
  await worker.fetch(new Request("https://addon.test/catalog/channels/au/genre=Sydney.json"), env);
  assert.equal(asked, "/catalog/channels/au/genre%3DSydney.json");
});
