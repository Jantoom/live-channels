// The Cloudflare Worker in front of the built site, for catalog requests only
// (`run_worker_first` in wrangler.jsonc); everything else is served as plain static files.
//
// Cloudflare serves a static file at its canonical path, each segment encoded like
// encodeURIComponent ("genre%3DSydney.json"), and redirects any other spelling there
// (307). Stremio asks for "genre=Sydney.json", so every catalog request would take a
// redirect first. This fetches the file at its canonical path instead.

/** The path Cloudflare serves a file at: each segment decoded, then encoded. */
export const canonicalPath = (path) => path.split("/").map((segment) => {
  try { return encodeURIComponent(decodeURIComponent(segment)); } catch { return segment; }
}).join("/");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    url.pathname = canonicalPath(url.pathname);
    return env.ASSETS.fetch(new Request(url, request));
  },
};
