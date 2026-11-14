# Live Channels

A Stremio addon of free live TV channels, organised by country. It's hosted as static files on GitHub Pages and rebuilt every 6 hours by GitHub Actions, so there's no server to run.

In Stremio: **Discover → channels**, then pick a country from the catalog dropdown and use the genre dropdown to narrow it down.

**Australia** is organised by city:

- **All** (the default): every channel. Each capital's own feeds are named after the city, e.g. "ABC TV (Brisbane)", so you can see which version you're watching. A feed shared by two cities is named after the bigger one: Canberra gets "Seven (Sydney)", Hobart gets "7two (Melbourne)".
- **Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin** (most to least populous): the channels that city receives, one of each, in channel-number order, followed by the free streaming-only channels (Home and Away Classics, Bondi Vet, 9Crime, Sky News Now, etc.).
- **Other:** regional feeds outside the capitals, e.g. Seven Cairns and Channel 9 (Gold Coast). Most have no channel number in the source, so they take the number of the broadcast they carry (Seven Cairns is Channel 71) and appear in **All** right after that broadcast's city feeds.

**The other countries** are organised by genre. **All** (the default) lists every channel: news first, then channels with a mix of shows, then 24/7 channels showing a single show. After it come the service's own groups in its guide order (Movies, Comedy, News + Opinion…, in the country's language). Countries are listed from most to least populous:

| Country | Channels from | About |
|---|---|---|
| United States | Pluto TV, then The Roku Channel (its own option in the dropdown) | 660 |
| United Kingdom | Samsung TV Plus, then Pluto TV | 390 |
| Brazil, Mexico, Germany, France, Italy, Spain, Argentina, Canada, Sweden, Denmark, Norway | Pluto TV | 130–275 each |
| New Zealand | i.mjh.nz's free-to-air list, by network (TVNZ, Sky, Māori…) | 43 |

To set it up, follow [SETUP.md](SETUP.md).

## TV guide

In Stremio's newer apps (Stremio Web and desktop since [tech update #85](https://blog.stremio.com/stremio-tech-update-85-stremio-desktop-and-stremio-web-update/)), every country opens as a programme guide: a day-by-day grid of what's on, with a day picker, filtered by the same city or genre dropdown. Each channel's page also shows its schedule for the next day. Older apps and TVs ignore the guide and show the usual list.

How far ahead it goes depends on the source:

| Source | Guide file | Ahead | Channels with programmes |
|---|---|---|---|
| Australia | `https://i.mjh.nz/au/<city>/epg.xml.gz` | about a week | about 125 per city; the rest (e.g. BBC News, Sky News Now, the SBS language channels) get an empty row |
| Pluto TV | `https://i.mjh.nz/PlutoTV/<country>.xml.gz` | about a day | all of them |
| The Roku Channel | `https://i.mjh.nz/Roku/all.xml.gz` | about 3 days | all of them |
| Samsung TV Plus (UK) | `https://i.mjh.nz/SamsungTVPlus/gb.xml.gz` | about 18 hours | all but one |
| New Zealand | `https://i.mjh.nz/nz/epg.xml.gz` | weeks (the build uses 10 days) | 33 of 41 |

How it works:

- The guide files are fetched with the channel lists and matched by channel id. If one fails to download, the build warns and those channels go without programmes; the build still publishes.
- The manifest sets `behaviorHints.epgProvider`, and each catalog takes an optional `date` extra. Channel metas are marked `isLive` (which is how Stremio treats them as live without switching the type to `tv`) and carry their programmes as `videos` with `startTime`/`endTime`.
- Stremio asks for a guide page per UTC day: `catalog/channels/au/date=2026-11-14&genre=Sydney.json`. The date comes first and the value is encoded like `encodeURIComponent`, as Stremio sends it, so guide pages are only written in that spelling and the decoded one (unlike the lists, which cover every client's spelling). The build writes them for 7 days back to 10 days ahead; days with no data still list the channels.
- The guide pages are most of the site: about 290 MB in all, of which a typical build's "today" pages are about 120 MB (the US "All" page is about 8 MB, much less gzipped). Programmes are kept lean (no runtime, short ids) to keep publishing quick; GitHub Pages has timed out publishing before.
- The guide is only as fresh as the last build (every 6 hours). That's fine for scheduled programmes, but late schedule changes show up at the next build.

## Where the channels come from

Everything comes from [i.mjh.nz](https://i.mjh.nz/):

- **Australia and New Zealand:** the broadcasters' free streams (7plus, 9Now, 10, ABC iview, SBS On Demand, TVNZ, Sky, and similar), from `https://i.mjh.nz/au/<city>/tv.json` and `https://i.mjh.nz/nz/tv.json`. Stream links point at i.mjh.nz, which forwards each request to the broadcaster and gets a fresh stream link on the spot. That's why links written into static files keep working. There are no pay-TV channels.
- **Free streaming services:** the channel lists i.mjh.nz publishes for Pluto TV, The Roku Channel and Samsung TV Plus (`.channels.json`). Their stream links go through jmp2.uk, i.mjh.nz's redirector, which gets a fresh link from the service for the country asked for. Channels with DRM are left out, because Stremio can't play them. A channel two services share is only listed from the first one (Pluto TV in the US, Samsung TV Plus in the UK).

What's missing is the channels people there know best. i.mjh.nz has no BBC, ITV, Channel 4 or Channel 5 (UK), and no main ABC, CBS, NBC, Fox or The CW feed (US). Its PBS stations are all DRM-protected. The US catalog does have the networks' free news channels (CBS News 24/7, NBC News NOW, ABC News Live), and the UK catalog has Sky News and GB News.

Left out on purpose:

- **Samsung TV Plus outside the UK:** in a sample, most of its US channels refused viewers in Australia, and it adds little people would recognise there.
- **Chile:** i.mjh.nz's Pluto TV Chile lineup is currently a copy of Canada's.

## What each channel shows

- **Poster:** the channel's logo, redrawn centred on a transparent square so Stremio doesn't crop wide logos. Rendered posters are cached between builds (`.cache/posters`).
- **Channel number** where the channel has a broadcast one, e.g. "Channel 10". The streaming services' own numbers aren't shown, because nobody knows them.
- **Description:** the source's own description where it has one; otherwise a one-sentence description of the channel from `src/descriptions.mjs`, followed by **"Recently aired:"** with up to 10 shows from the past week. Shows aired on more days come first, so a regular series beats a one-off movie. Episode-slot titles ("Season 7 Episode 11") and the channel's own name are left out, so a single-show channel like Bondi Vet may have no list at all.

The schedules in i.mjh.nz's data only cover about the last 4 and next 9 hours. So the build runs every 6 hours and keeps a rolling 7-day history in `history.json`, which it publishes with the site and reads back on the next run. The "Recently aired" lists fill out over a few days.

## Limits

- **Geo-blocking.** Australian and New Zealand channels only play from a connection in that country (not overseas or through a foreign VPN). Pluto TV and The Roku Channel play from Australia too, because jmp2.uk asks the service for the right country's stream. Most of Samsung TV Plus's UK channels do as well, but some only play from the UK.
- **One source.** If i.mjh.nz is down or a service changes its app, those channels stop playing until it's fixed upstream. The build only republishes the lists. It can't test playback, because GitHub's build servers are in the US.
- **10's channels don't play in Stremio's desktop app.** They do play on a Samsung TV (tested on an S90D), whose app hands streams to the TV's own player. 10's streams are encrypted, and 10's key server answers "not found" to the desktop app's built-in mpv player (it identifies itself as "Lavf"), so the stream loads endlessly or plays a few seconds and quits. The desktop app doesn't read an mpv config file, so that can't be changed on your side either. The player headers i.mjh.nz publishes (`headers` in its `tv.json`) do get the key, but an addon can only make Stremio send headers through its streaming-server proxy (`proxyHeaders`). That proxy (v4.22.3) appends "null" to rewritten URLs without a query string, which breaks 10's playlists. So the streams are left as plain links.
- **Stremio Web.** Some hosts don't allow playback inside a web page, so Stremio Web shows "Video is not supported" for them: every Pluto TV, Roku and Samsung TV Plus channel (jmp2.uk's redirects don't send the header browsers need), and in Australia 10, Bloomberg, GOOD., First Nations TV and Tourism TV. The desktop app and TVs don't have this restriction.
- **The filter is required.** Stremio only shows catalogs with a required filter in Discover, not as home-screen rows, which also keeps 15 countries off your home screen. Without it, older Stremio versions show a "None" option. "All" fills that role.
- **The type shows as "channels", in lowercase.** Stremio only has display names for its own types (movie, series, tv, channel), so it shows other types exactly as written.

## Customising

Edit `channels.config.mjs` and push; the workflow rebuilds automatically.

- **Countries:** each entry in `countries` is one catalog, in that order. City-based countries use `source` and `regions`; the rest list `sources`, each a service's lineup for a region (`{ service: "PlutoTV", region: "gb" }`), a whole single-region service under one dropdown option (`{ service: "Roku", group: "The Roku Channel" }`), or a single i.mjh.nz `tv.json` grouped by network (`{ tv: "…" }`). The services and their stream links are defined in `services`. `rename` on a source merges its group names with another's (`Sport` into `Sports`). Pluto TV also has `cl` (see above), and Samsung TV Plus has more countries.
- **TV guide:** `guide` names a source's XMLTV file: on a city-based country, the file in each region's folder; on a service, a URL with `{region}`; on a `{ tv }` source, a URL. A country without any keeps a plain channel list. `guideDays` sets which days get guide pages and `guideMetaHours` how much schedule each channel's page carries.
- **Filter names:** `filterLabels` sets the names of the all-channels option (All) and of Other.
- **Hide channels:** add the channel's id to `exclude`: the part of the addon's id after `livetv-<country>-`, e.g. `mjh-sbs-sbs-radio-4`, `plu-5ba3fb9c4b078e0f37ad34e8` or `stvp-GB3300002NF`.
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
