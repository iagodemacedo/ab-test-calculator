#!/usr/bin/env bash
# Builds the production site and deploys the Worker to ab-test.iago.wtf.
# wrangler is not logged in on this machine; the cf CLI is, so its OAuth session is handed to wrangler.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  cf auth whoami >/dev/null || { echo "cf is not authenticated (run: cf auth login)" >&2; exit 1; }
  CLOUDFLARE_ACCOUNT_ID="$(cf auth whoami | python3 -c 'import json,sys; print(json.load(sys.stdin)["accounts"][0]["id"])')"
  CLOUDFLARE_API_TOKEN="$(python3 -c 'import json,os; print(json.load(open(os.path.expanduser("~/.config/cloudflare/config/default.json")))["oauth_token"])')"
  export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN
fi
npm test
npx astro build
node scripts/js-budget.mjs
npx wrangler deploy
