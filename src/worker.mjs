// The Cloudflare Worker in front of the built site. It runs for catalog requests
// (`run_worker_first` in wrangler.jsonc) and for anything no file matches; everything
// else is a plain static file.
//
// - Catalogs: Cloudflare serves a static file at its canonical path, each segment
//   encoded like encodeURIComponent ("genre%3DSydney.json"), and redirects any other
//   spelling there (307). Stremio asks for "genre=Sydney.json", so every catalog request
//   would take a redirect first. This fetches the file at its canonical path.
// - A configured install, whose URLs start with its settings
//   (/countries=au,nz/manifest.json, see parseSettings): the manifest trimmed to them,
//   the install page for Stremio's Configure button, and the same files as everyone else.
import { configureManifest, parseSettings } from "./lib.mjs";

/** The path Cloudflare serves a file at: each segment decoded, then encoded. */
export const canonicalPath = (path) => path.split("/").map((segment) => {
  try { return encodeURIComponent(decodeURIComponent(segment)); } catch { return segment; }
}).join("/");

// Stremio's Configure button opens <install URL>/configure.
const CONFIGURE = /^\/configure(\.html)?\/?$/;
const file = (env, base, path) => env.ASSETS.fetch(new URL(canonicalPath(path), base));
const json = (data) => new Response(JSON.stringify(data), {
  headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep it as sent */ }
    const [, first, rest] = path.match(/^\/([^/]+)(\/.*)$/) ?? [];
    const settings = first && parseSettings(first);
    if (settings) {
      if (rest === "/manifest.json") return json(configureManifest(await (await file(env, url, "/manifest.json")).json(), settings));
      return file(env, url, CONFIGURE.test(rest) ? "/" : rest);
    }
    return file(env, url, CONFIGURE.test(path) ? "/" : url.pathname);
  },
};
