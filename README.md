# Live Channels

A Stremio addon of free live TV channels, organised by country and city. It's hosted as static files on GitHub Pages and rebuilt daily by GitHub Actions, so there's no server to run.

In Stremio: **Discover → Channels → Australia**, then pick your city from the genre dropdown (Brisbane, Adelaide, Canberra, Darwin, Hobart, Melbourne, Perth, Sydney). Each city shows its local Seven, Nine, 10, ABC and SBS feeds in channel-number order, followed by the free streaming-only channels (Home and Away Classics, Bondi Vet, 9Crime, Sky News Now, etc.).

To set it up, follow [SETUP.md](SETUP.md).

## Where the channels come from

Everything comes from [i.mjh.nz](https://i.mjh.nz/), which publishes the broadcasters' free streams (7plus, 9Now, 10, ABC iview, SBS On Demand, Sky News, and similar) as playlists per city. The build reads `https://i.mjh.nz/au/<city>/tv.json` for each city in `channels.config.mjs`. There are no pay-TV channels.

The stream links point at i.mjh.nz, which forwards each request to the broadcaster and gets a fresh stream link on the spot. That's why links written once a day keep working.

## Limits

- **Australia only.** The broadcasters geo-block their streams, so channels only play from an Australian connection (not overseas or through a foreign VPN).
- **One source.** If i.mjh.nz is down or a broadcaster changes its app, those channels stop playing until it's fixed upstream. The daily build only republishes the list. It can't test playback, because GitHub's build servers are outside Australia and would see every stream as blocked.
- **No "now playing".** The addon is rebuilt once a day, so it doesn't show the current programme.
- **The city filter is required.** Stremio only shows catalogs with a required filter in Discover, not as a home-screen row. That's deliberate: without it, older Stremio versions show a "None" option that would mix every city's local channels together.

## Customising

Edit `channels.config.mjs` and push; the workflow rebuilds automatically.

- **Default city:** the first entry in `regions` is what Discover opens on. Move your city to the front.
- **Hide channels:** add the channel's key to `exclude`. Keys are the part of the addon's id after `livetv-au-`, e.g. `mjh-sbs-sbs-radio-4`. They're also the top-level keys in i.mjh.nz's `tv.json`.
- **Another country:** add an entry to `countries`. It becomes its own catalog under Channels. The source has to publish `tv.json` files in the same format.

After each build, `report.json` on the site lists how many channels each city got.

## Local testing

```
npm test             # unit tests and a full build against fake data
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in Stremio on the same machine.
