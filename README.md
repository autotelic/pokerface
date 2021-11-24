# ♠️♥️ Pokerface ♣️♦️
### A planning poker bot for Slack, on a Cloudflare Worker with Durable Objects

## Getting started

- Clone https://github.com/autotelic/pokerface
- Run `miniflare -w -d -b SLACK_TOKEN=<VALUE OF SLACK_TOKEN>`
- Run `ngrok http --region=us --hostname=pokerface.ngrok.io 8787`

## How to use

- Create a group DM in Slack with the planning poker group & PokerfaceDev
- Go ahead and use the bot with `/pokerface-dev [task to estimate]`

## Development

### Note: You must use [wrangler](https://developers.cloudflare.com/workers/cli-wrangler/install-update) 1.19.3

### Please read the [Durable Object documentation](https://developers.cloudflare.com/workers/learning/using-durable-objects) before using this template.

Created with a template for kick starting a Cloudflare Workers project using:

- Durable Objects
- Modules (ES Modules to be specific)
- Rollup
- Wrangler

Worker code is in `src/`. The Durable Object `Counter` class is in `src/counter.mjs`, and the eyeball script is in `index.mjs`.

Rollup is configured to output a bundled ES Module to `dist/index.mjs`.
