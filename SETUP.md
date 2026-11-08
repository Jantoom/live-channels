# Setting up GitHub Pages and Actions

About 5 minutes. No API keys or secrets are needed.

## 1. Push the code

The repo needs to be **public**, since GitHub Pages on private repos needs a paid plan. The code goes on the `main` branch.

## 2. Turn on Pages

1. Open the repo on GitHub and go to **Settings → Pages** (left sidebar, under "Code and automation").
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

You don't need to pick a branch or folder. The workflow uploads the site itself.

## 3. Run the first build

1. Go to the **Actions** tab. If GitHub asks whether to enable workflows, click the green button to enable them.
2. Click **Build and deploy channels** in the left list.
3. Click **Run workflow** (right side), keep the branch on `main`, and click the green **Run workflow** button.
4. Refresh after a few seconds and click the new run to watch it. It takes about a minute. Both jobs, **build** and **deploy**, should get a green tick.

The first push to `main` may already have started a run on its own. That's fine; if it went green, skip this step.

## 4. Install in Stremio

1. Open `https://<your-username>.github.io/<repo-name>/`. The **deploy** job also shows this link once it finishes.
2. Click **Install in Stremio**, or copy the `manifest.json` link on that page and paste it into Stremio's addon search box.
3. In Stremio, go to **Discover**, set the type dropdown to **Channels**, the catalog to **Australia**. It opens on **City** (every channel); pick your city to see just its lineup.

## Afterwards

- The workflow runs by itself every 6 hours to pick up channel changes and build up the "Recently aired" history. It also runs whenever you push a change to the config or code.
- **If a run fails** (red cross), click it, then click the failed step to see why. The usual cause is i.mjh.nz being briefly unreachable. Your installed addon keeps working because a failed build never replaces the last good one. Re-run it later with **Re-run jobs**.
- GitHub pauses scheduled workflows on a repo with no activity for 60 days and emails you first. Re-enable it from the Actions tab, or push any small change.
