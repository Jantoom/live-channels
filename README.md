# Live Channels

A Stremio addon of free live TV channels, organised by country. It's hosted as static files on GitHub Pages and rebuilt every 6 hours by GitHub Actions, so there's no server to run.

In Stremio: **Discover → channels**, then pick a country from the catalog dropdown and use the genre dropdown to narrow it down.

**Australia** is organised by city:

- **City** (the default): every channel. Each capital's own feeds are named after the city, e.g. "ABC TV (Brisbane)", so you can see which version you're watching. A feed shared by two cities is named after the bigger one: Canberra gets "Seven (Sydney)", Hobart gets "7two (Melbourne)".
- **Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin** (most to least populous): the channels that city receives, one of each, in channel-number order, followed by the free streaming-only channels (Home and Away Classics, Bondi Vet, 9Crime, Sky News Now, etc.).
- **Other:** regional feeds outside the capitals, e.g. Seven Cairns and Channel 9 (Gold Coast).

**The other countries** are organised by genre. **Genre** (the default) lists every channel, followed by the service's own groups in its guide order (Movies, Comedy, News + Opinion…, in the country's language). They're listed from most to least populous:

| Country | Channels from | About |
|---|---|---|
| United States | Pluto TV, then The Roku Channel (its own option in the dropdown) | 660 |
| Brazil, Mexico, Germany, United Kingdom, France, Italy, Spain, Argentina, Canada, Sweden, Denmark, Norway | Pluto TV | 130–275 each |
| New Zealand | i.mjh.nz's free-to-air list, by network (TVNZ, Sky, Māori…) | 43 |

To set it up, follow [SETUP.md](SETUP.md).

## Where the channels come from

Everything comes from [i.mjh.nz](https://i.mjh.nz/):

- **Australia and New Zealand:** the broadcasters' free streams (7plus, 9Now, 10, ABC iview, SBS On Demand, TVNZ, Sky, and similar), from `https://i.mjh.nz/au/<city>/tv.json` and `https://i.mjh.nz/nz/tv.json`. Stream links point at i.mjh.nz, which forwards each request to the broadcaster and gets a fresh stream link on the spot. That's why links written into static files keep working. There are no pay-TV channels.
- **Free streaming services:** the channel lists i.mjh.nz publishes for Pluto TV and The Roku Channel (`.channels.json`). Their stream links go through jmp2.uk, i.mjh.nz's redirector, which gets a fresh link from the service for the country asked for. Channels with DRM are left out, because Stremio can't play them. A channel the US gets from both services is only listed from Pluto TV.

Left out on purpose:

- **Samsung TV Plus:** about half its channels refuse viewers outside their own country.
- **Chile:** i.mjh.nz's Pluto TV Chile lineup is currently a copy of Canada's.

## What each channel shows

- **Poster:** the channel's logo, redrawn centred on a transparent square so Stremio doesn't crop wide logos. Rendered posters are cached between builds (`.cache/posters`).
- **Channel number** where it has one, e.g. "Channel 10".
- **Description:** the source's own description where it has one; otherwise a one-sentence description of the channel from `src/descriptions.mjs`, followed by **"Recently aired:"** with up to 10 shows from the past week. Shows aired on more days come first, so a regular series beats a one-off movie. Episode-slot titles ("Season 7 Episode 11") and the channel's own name are left out, so a single-show channel like Bondi Vet may have no list at all.

The schedules in i.mjh.nz's data only cover about the last 4 and next 9 hours. So the build runs every 6 hours and keeps a rolling 7-day history in `history.json`, which it publishes with the site and reads back on the next run. The "Recently aired" lists fill out over a few days.

## Limits

- **Geo-blocking.** Australian and New Zealand channels only play from a connection in that country (not overseas or through a foreign VPN). Pluto TV and The Roku Channel play from Australia too, because jmp2.uk asks the service for the right country's stream.
- **One source.** If i.mjh.nz is down or a service changes its app, those channels stop playing until it's fixed upstream. The build only republishes the lists. It can't test playback, because GitHub's build servers are in the US.
- **10's channels don't play in Stremio's desktop app.** They do play on a Samsung TV (tested on an S90D), whose app hands streams to the TV's own player. 10's streams are encrypted, and 10's key server answers "not found" to the desktop app's built-in mpv player (it identifies itself as "Lavf"), so the stream loads endlessly or plays a few seconds and quits. The desktop app doesn't read an mpv config file, so that can't be changed on your side either. The player headers i.mjh.nz publishes (`headers` in its `tv.json`) do get the key, but an addon can only make Stremio send headers through its streaming-server proxy (`proxyHeaders`). That proxy (v4.22.3) appends "null" to rewritten URLs without a query string, which breaks 10's playlists. So the streams are left as plain links.
- **Stremio Web.** Some hosts don't allow playback inside a web page, so Stremio Web shows "Video is not supported" for them: every Pluto TV and Roku channel (jmp2.uk's redirects don't send the header browsers need), and in Australia 10, Bloomberg, GOOD., First Nations TV and Tourism TV. The desktop app and TVs don't have this restriction.
- **No "now playing".** The addon is static files, so it can't show the programme on right now.
- **The filter is required.** Stremio only shows catalogs with a required filter in Discover, not as home-screen rows, which also keeps 15 countries off your home screen. Without it, older Stremio versions show a "None" option. "City" and "Genre" fill that role.
- **The type shows as "channels", in lowercase.** Stremio only has display names for its own types (movie, series, tv, channel), so it shows other types exactly as written.

## Customising

Edit `channels.config.mjs` and push; the workflow rebuilds automatically.

- **Countries:** each entry in `countries` is one catalog, in that order. City-based countries use `source` and `regions`; the rest list `sources`, each a service's lineup for a region (`{ service: "PlutoTV", region: "gb" }`), a whole single-region service under one dropdown option (`{ service: "Roku", group: "The Roku Channel" }`), or a single i.mjh.nz `tv.json` grouped by network (`{ tv: "…" }`). The services and their stream links are defined in `services`. Pluto TV also has `cl` (see above); Samsung TV Plus would need adding to `services`.
- **Filter names:** `filterLabels` sets the names of the all-channels options (City, Genre) and of Other. A country can use its own all-channels name with `filterLabel` (New Zealand's is "Network").
- **Hide channels:** add the channel's id to `exclude`: the part of the addon's id after `livetv-<country>-`, e.g. `mjh-sbs-sbs-radio-4` or `plu-5ba3fb9c4b078e0f37ad34e8`.
- **Channel descriptions:** add or edit lines in `src/descriptions.mjs`. Channels missing from it, and without a description of their own, get a generic sentence, e.g. "A free streaming channel from 9Now."

After each build, `report.json` on the site lists how many channels each city and source got.

## Local testing

```
npm install          # once, for the image library that draws the posters
npm test             # unit tests and a full build against fake data
npm run build        # real build into ./dist (needs internet; about a minute when posters aren't cached)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in Stremio on the same machine.
