# Agent-first Product Operating Model

A handbook for building and operating products with agents. Agents are the main audience, and people come second. Start with the [introduction](http://localhost:4321/), then use the sidebar or search.

## Run locally

Use Node.js 24 LTS and pnpm. Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm exec emdash secrets generate --write .env
pnpm dev
```

Open the **Dev bypass** URL printed by EmDash on first setup. This creates a local admin session and loads the published edition into the local D1 emulator. The reader and editor share the address printed by Astro, normally [localhost:4321](http://localhost:4321/). Keep the development server on loopback.

## Edit and save an edition

Use **Content**, then **Chapters**, in the [local editor](http://localhost:4321/_emdash/admin). Edit the title, section, order or Markdown body, save, inspect **Preview draft**, and publish. Visit the public page to verify the result. A page's address comes from its EmDash slug, where `--` stands for `/` and `introduction` is the home page.

When scripting the CLI, note two behaviors. `emdash content get` returns pending draft fields, and `emdash content update` publishes what it is given unless you pass `--draft`, so check `draftRevisionId` first. With no usable `--url`, the CLI targets the main reader on port 4321, so on a second copy pass `--url` and the address as two separate arguments. A copy has its own database only for commands that actually reach it.

EmDash owns editorial content. To save the **published edition** in Git, run `pnpm content:export` against the local D1 database, inspect the diff in `seed/handbook.json`, and run `pnpm content:check` against the live server. A new checkout restores that seed on first setup. Restarting with an existing database preserves edits.

For **full local recovery**, stop the server and back up `.cloudflare/state/` and the private `.env` together. This retains revisions, drafts, uploads and local configuration. For a portable EmDash transfer, use `pnpm exec emdash site export --url http://localhost:4321 --output <private-path>.emdash`. Import the package into a separate empty instance using `emdash site import --analyze` and review its plan. Keep full backups outside version control.

## Repository map

| Location | Responsibility |
| --- | --- |
| `src/pages/`, `src/layouts/Docs.astro`, `src/styles/` | Page routes, agent-readable endpoints (`.md`, `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/search.json`), and the three-column docs layout. |
| `src/scripts/search.ts` | Client-side search. It loads `/search.json` on first focus. |
| `src/lib/` | Live CMS queries, slug-to-path mapping, section order, and safe Markdown rendering. |
| `seed/handbook.json` | Portable published pages and collection schema (title, section, order, Markdown) for initial setup. |
| `scripts/` | Export the edition, and compare the running reader with the seed, including its sidebar order, links, anchors, Markdown routes and search index. |
| `tests/` | Unit tests for rendering, paths, ordering and the search index, plus seed checks and the punctuation rules for prose. |
| `astro.config.mjs`, `src/live.config.ts` | EmDash integration, live loader and Cloudflare adapter. |
| `cloudflare.config.ts`, `src/worker.ts` | Worker entrypoint, D1 and R2 bindings, and scheduled maintenance. |
| `AGENTS.md`, `.agents/skills/` | Editorial conventions, project instructions and official EmDash skills. |

The starter's docs-server configurations are included for Claude Code, Cursor and VS Code. For other clients, connect the read-only docs server at `https://docs.emdashcms.com/mcp` using that client's MCP settings. EmDash exposes a separate authenticated site management server at `/_emdash/api/mcp`.

## For agents

The reader serves `/llms.txt` (grouped by section), `/llms-full.txt`, and every page as Markdown at its address plus `.md`. The introduction is `/introduction.md`. Links between pages in that Markdown point to their Markdown versions.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm content:check
```

The reader check expects the local site to be running. Pass its URL as an argument if Astro chose another port. The build creates local Worker output. Deployment is a separate operation.

## Deploy

The site runs as the Cloudflare Worker `agent-first-handbook` at [agent-first-handbook.askre.workers.dev](https://agent-first-handbook.askre.workers.dev), with the `agent-first-handbook` D1 database and the `agent-first-handbook-media` R2 bucket. Workers Builds deploys every push to `main` with `npx cf build` and `npx cf deploy --prebuilt`. Other branches do not build. Check changes locally before you push.

Content edited in production lives in production D1, not in Git. A new, empty database shows the EmDash setup wizard, and the first person to finish it becomes the administrator. Finish setup on a new deployment at once.

To check the live site, pass its URL to the reader check: `node scripts/check-reader.mjs https://agent-first-handbook.askre.workers.dev`.

## Credits

This handbook draws on ideas from the Amp [blog](https://ampcode.com/chronicle) and [YouTube channel](https://www.youtube.com/@AmpCodeInc).

## License

[MIT](LICENSE), for the handbook text and the reader code. The Source Serif 4 fonts keep the [SIL Open Font License](public/fonts/licenses/source-serif.txt). The EmDash skills in `.agents/skills` keep their own license from the EmDash project.
