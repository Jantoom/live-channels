# Live Channels

A Stremio addon of free live TV channels, organised by country and city. It's hosted as static files on GitHub Pages and rebuilt daily by GitHub Actions, so there's no server to run.

In Stremio: **Discover → Channels → Australia**, then pick your city from the genre dropdown (Brisbane, Adelaide, Canberra, Darwin, Hobart, Melbourne, Perth, Sydney). Each city shows its local Seven, Nine, 10, ABC and SBS feeds in channel-number order, followed by the free streaming-only channels (Home and Away Classics, Bondi Vet, 9Crime, Sky News Now, etc.).

To set it up, follow [SETUP.md](SETUP.md).

## Where the channels come from

Everything comes from [i.mjh.nz](https://i.mjh.nz/), which publishes the broadcasters' free streams (7plus, 9Now, 10, ABC iview, SBS On Demand, Sky News, and similar) as playlists per city. The build reads `https://i.mjh.nz/au/<city>/tv.json` for each city in `channels.config.mjs`. There are no pay-TV channels.

The stream links point at i.mjh.nz, which forwards each request to the broadcaster and gets a fresh stream link on the spot. That's why links written into static files keep working.

## What each channel shows

- **Poster:** the channel's logo, redrawn centred on a transparent square so Stremio doesn't crop wide logos. Rendered posters are cached between builds (`.cache/posters`).
- **Channel number** where it has one, e.g. "Channel 10".
- **Description:** i.mjh.nz's own description where it has one; otherwise a one-sentence description of the channel from `src/descriptions.mjs`, followed by **"Recently aired:"** with up to 10 shows from the past week. Shows aired on more days come first, so a regular series beats a one-off movie. Episode-slot titles ("Season 7 Episode 11") and the channel's own name are left out, so a single-show channel like Bondi Vet may have no list at all.

The schedule in i.mjh.nz's data only covers about the last 4 and next 9 hours. So the build runs every 6 hours and keeps a rolling 7-day history in `history.json`, which it publishes with the site and reads back on the next run. After the first deploy, the "Recently aired" lists fill out over a few days.

## Limits

- **Australia only.** The broadcasters geo-block their streams, so channels only play from an Australian connection (not overseas or through a foreign VPN).
- **One source.** If i.mjh.nz is down or a broadcaster changes its app, those channels stop playing until it's fixed upstream. The build only republishes the list. It can't test playback, because GitHub's build servers are outside Australia.
- **Stremio Web and 10's channels.** 10's streams and a few others (listed in `notWebReadyHosts` in `channels.config.mjs`) come from hosts that don't reliably allow playback inside a web page. The build marks those streams so Stremio Web plays them through Stremio's streaming server, which you need running on your computer. The desktop and mobile apps play everything directly. `report.json` lists the marked channels under `notWebReady`.
- **No "now playing".** The addon is static files, so it can't show the programme on right now.
- **The city filter is required.** Stremio only shows catalogs with a required filter in Discover, not as a home-screen row. That's deliberate: without it, older Stremio versions show a "None" option that would mix every city's local channels together.

## Customising

Edit `channels.config.mjs` and push; the workflow rebuilds automatically.

- **Default city:** the first entry in `regions` is what Discover opens on. Move your city to the front.
- **Hide channels:** add the channel's key to `exclude`. Keys are the part of the addon's id after `livetv-au-`, e.g. `mjh-sbs-sbs-radio-4`. They're also the top-level keys in i.mjh.nz's `tv.json`.
- **Channel descriptions:** add or edit lines in `src/descriptions.mjs`. Channels missing from it get a generic sentence, e.g. "A free streaming channel from 9Now."
- **Another country:** add an entry to `countries`. It becomes its own catalog under Channels. The source has to publish `tv.json` files in the same format.

After each build, `report.json` on the site lists how many channels each city got.

## Local testing

```
npm install          # once, for the image library that draws the posters
npm test             # unit tests and a full build against fake data
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in Stremio on the same machine.
