# Setting up Cloudflare and GitHub Actions

About 10 minutes. GitHub Actions builds the addon every 6 hours and deploys it to Cloudflare on a subdomain of your own domain, as static files with no Worker script. Static file requests are free and unlimited on Cloudflare's free plan.

You need a domain on Cloudflare (its DNS managed by Cloudflare) and the repo on GitHub, with the code on `main`. The repo can be private.

## 1. Pick the addon's address

In `wrangler.jsonc`, set `routes` to a subdomain of your domain, such as `channels.yourdomain.com`. The subdomain must not already have a DNS record: Cloudflare creates the record and its certificate on the first deploy.

## 2. Make a Cloudflare API token

1. In the Cloudflare dashboard, open **My Profile → API Tokens** and click **Create Token**.
2. Use the **Edit Cloudflare Workers** template.
3. Under **Account Resources**, pick your account. Under **Zone Resources**, pick **Specific zone** and your domain.
4. Click **Continue to summary**, then **Create Token**, and copy the token. Cloudflare only shows it once.

Also copy your **Account ID**: it's on the right of your domain's **Overview** page, or under **Workers & Pages**.

The same token works for all the addons on that domain.

## 3. Add them to GitHub

In the repo on GitHub, go to **Settings → Secrets and variables → Actions** and add two **repository secrets**:

- `CLOUDFLARE_API_TOKEN`: the token.
- `CLOUDFLARE_ACCOUNT_ID`: the account ID.

## 4. Run the first deploy

Push the change to `wrangler.jsonc`; that starts the workflow. Or go to **Actions → Build and deploy channels → Run workflow**. Its one job, **deploy**, should get a green tick. The first deploy uploads every file and takes a few minutes; later ones only upload what changed. The certificate for a new subdomain can take a few more minutes to be issued.

The build reads the last build's "Recently aired" history from the site. Until the new site has one, it reads it from `PREVIOUS_SITE_URL` in the workflow (the old GitHub Pages site), so the history carries over.

## 5. Install in Stremio

1. Open `https://<your subdomain>/`.
2. Click **Install in Stremio**, or paste the `manifest.json` link from that page into Stremio's addon search box. If you had the GitHub Pages version installed, uninstall it first.
3. In Stremio, go to **Discover**, set the type dropdown to **channels** and pick a country from the catalog dropdown. Australia opens on **All** (every channel; pick your city to see just its lineup); the other countries also open on **All**, and you pick a genre to narrow it down.

## Afterwards

- The workflow runs by itself every 6 hours to pick up channel changes and build up the "Recently aired" history. It also runs whenever you push a change to the config or code.
- **If a run fails** (red cross), click it, then click the failed step to see why. The usual cause is i.mjh.nz being briefly unreachable. Your installed addon keeps working because a failed build never replaces the last good one. Re-run it later with **Re-run jobs**.
- GitHub pauses scheduled workflows on a repo with no activity for 60 days and emails you first. Re-enable it from the Actions tab, or push any small change.
- Once the new site has its own history (after the first successful deploy), the old GitHub Pages site can be turned off in the repo's **Settings → Pages**, and `PREVIOUS_SITE_URL` removed from the workflow.
