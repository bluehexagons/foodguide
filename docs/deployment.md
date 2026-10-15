# Deployment

Deploy the complete `html/` directory after compiling the modules and generating sprites.
The compiler output and `html/img/sprites/` are ignored by Git and must be created for
each checkout.

```bash
npm ci --ignore-scripts --include=dev
npm run generate-sprites
```

`generate-sprites` compiles the TypeScript modules before generating the artwork.
Use Node.js 24 or newer and include development dependencies; Sharp is required to generate
the sprite assets. Serve `index.html` as the directory index so the guide opens
without a filename, for example `https://foodguide.bluehexagons.com/#discovery?game=together`.
Keep `index.htm` and `entry-redirect.js` available for legacy links; the redirect
preserves query strings and fragments. Relative URLs also support subpaths such as
`/foodguide/` on GitHub Pages and the portfolio domain.

## Basaltwater

`basaltwater.json` builds the complete site once and serves that output at both
the supplied deployment domain and `bluehexagons.com/foodguide/`. Deploy it with
the portfolio repository in the same setup command so Nginx retains both routes:

```bash
basaltw setup server_web SERVER_IP deploy --cloudflare \
    --deploy bluehexagons.com https://github.com/bluehexagons/bluehexagons.git \
    --deploy foodguide.bluehexagons.com https://github.com/bluehexagons/foodguide.git
```

The checked-in `.nvmrc` selects Node 24 for the isolated build account. The
manifest installs development dependencies with lifecycle scripts disabled;
`generate-sprites` also compiles the TypeScript modules. No separate webhook
receiver is required for setup or `basaltw patch` deployments. After initial
setup, run `sudo setup-cloudflare-tunnel` on the server and configure both
hostnames in Cloudflare DNS. `/foodguide` redirects to `/foodguide/` so relative
module and image URLs work.

## GitHub Pages

`.github/workflows/deploy.yml` runs on pushes to `main` and manual dispatch. It
runs formatting, lint, types, unit tests, dependency auditing, and a small Chromium
smoke suite. Full browser/accessibility audits are developer-run. It then compiles
modules, generates sprites in a fresh checkout, uploads `html/`, and deploys to the `github-pages` environment. Configure the repository's Pages
source as **GitHub Actions**. Deployment jobs receive only their required token
permissions. New commits cancel obsolete shared checks; the Pages concurrency group
serializes only publication, so an older check run cannot block new checks.

## Optional server webhook

The same workflow can notify a server after the checks pass. Configure:

- Repository variable `DEPLOY_WEBHOOK_URL`: the HTTPS endpoint ending in
  `/hooks/deploy-foodguide`.
- Repository secret `DEPLOY_WEBHOOK_SECRET`: the value expected in the
  `X-Webhook-Secret` header.
- Server environment `WEBHOOK_SECRET`: the same nonempty value.

The notification job is skipped when the URL variable is absent. It rejects an
HTTP URL or an empty secret.

The server needs Git, Bash, Node/npm, `flock`, `rsync`, and
[adnanh/webhook](https://github.com/adnanh/webhook). Give the service account a
dedicated clone at `/opt/foodguide/repo`, permission to update it, and write access
to the serving directory. Install `scripts/server/deploy.sh` at
`/opt/foodguide/deploy.sh` and `scripts/server/hooks.json` at
`/opt/foodguide/hooks.json`. Keep the installed script in sync with the repository.

With `WEBHOOK_SECRET` supplied by the service environment, run the receiver behind
an HTTPS reverse proxy:

```bash
webhook -ip 127.0.0.1 -port 9000 -template -hooks /opt/foodguide/hooks.json
```

The [`-template` option](https://github.com/adnanh/webhook/blob/master/docs/Webhook-Parameters.md)
is required to expand `getenv` in the hook configuration. Configure the reverse
proxy to preserve `X-Webhook-Secret`.

The template uses a Go raw string for the environment-variable name and pipes
the result through `js`, preserving valid JSON even when the secret contains
quotes or backslashes.

`deploy.sh` defaults to `/opt/foodguide/repo` and `/var/www/foodguide`. Override
`REPO_DIR` and `SERVE_DIR` in the service environment when using different paths;
also update the hook's executable and working directory if the installation path
changes.

Each invocation locks the deployment checkout, fetches `origin/main`, resets the
checkout to that revision, installs the lockfile with lifecycle scripts disabled
and development dependencies included even when `NODE_ENV=production`,
compiles modules, generates sprites, and copies `html/` with `rsync --delete`. Local changes in the
deployment checkout are discarded. A dependency installation or sprite build
failure stops before copying files to the serving directory. The final rsync
updates files in place and does not provide an atomic directory swap.

The hook deploys the latest `origin/main` when it runs; the notification payload's
SHA is informational. Webhook acceptance does not confirm deployment completion.
Inspect the server logs and verify the served page and sprite manifest after a
deployment.
