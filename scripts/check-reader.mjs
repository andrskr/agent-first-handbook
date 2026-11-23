import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Parser } from "htmlparser2";
import { chapterMarkdown, markdownPath, slugToPath } from "../src/lib/chapter-paths.ts";
import { renderMarkdown } from "../src/lib/markdown.ts";
import { groupBySection, sortChapters } from "../src/lib/order.ts";
import { searchIndex } from "../src/lib/search-index.ts";

const base = new URL(process.argv[2] ?? "http://localhost:4321");
assert(
  ["http:", "https:"].includes(base.protocol),
  "Expected an HTTP reader URL",
);
const readJson = async (file) =>
  JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const seed = await readJson("../seed/handbook.json");
const siteName = "Agent-first Operating Model";

const seedPages = sortChapters(
  seed.content.pages
    .filter((page) => page.status === "published")
    .map(({ slug, data }) => ({ ...data, slug, path: slugToPath(slug) })),
);
assert(seedPages.length > 0, "The seed has no published pages");
const expected = new Map(seedPages.map((page) => [page.path, page]));
const paths = new Set(expected.keys());

function parsePage(html) {
  const page = {
    ids: new Set(),
    duplicateIds: [],
    links: [],
    assets: [],
    sidebar: [],
    toc: [],
    pager: [],
    markdownLink: undefined,
    alternate: undefined,
    titles: [],
    documentTitle: "",
    canonical: undefined,
    noindex: false,
    handlers: [],
  };
  let navigation;
  let heading;
  let inTitle = false;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (attributes.id) {
        if (page.ids.has(attributes.id)) page.duplicateIds.push(attributes.id);
        page.ids.add(attributes.id);
      }
      for (const attribute of Object.keys(attributes))
        if (/^on/i.test(attribute)) page.handlers.push(`${name} ${attribute}`);
      if (name === "title") inTitle = true;
      if (name === "img" && attributes.src) page.assets.push(attributes.src);
      if (name === "link" && attributes.rel === "canonical")
        page.canonical = attributes.href;
      if (name === "link" && attributes.type === "text/markdown")
        page.alternate = attributes.href;
      if (name === "meta" && attributes.name === "robots")
        page.noindex = /noindex/i.test(attributes.content ?? "");
      if (name === "nav") navigation = attributes["aria-label"];
      if (name === "h1") heading = "";
      if (name === "a" && attributes.href) {
        page.links.push(attributes.href);
        if (navigation === "Handbook pages") page.sidebar.push(attributes.href);
        if (navigation === "On this page") page.toc.push(attributes.href);
        if (navigation === "Previous and next pages")
          page.pager.push(attributes.href);
        if (attributes.class === "markdown-link")
          page.markdownLink = attributes.href;
      }
    },
    ontext(text) {
      if (heading !== undefined) heading += text;
      if (inTitle) page.documentTitle += text;
    },
    onclosetag(name) {
      if (name === "nav") navigation = undefined;
      if (name === "title") inTitle = false;
      if (name === "h1" && heading !== undefined) {
        page.titles.push(heading.trim());
        heading = undefined;
      }
    },
  });
  parser.end(html);
  return page;
}

const documents = new Map();
async function load(url) {
  const key = `${url.origin}${url.pathname}${url.search}`;
  if (documents.has(key)) return documents.get(key);
  assert(documents.size < 2000, "Reader crawl exceeded 2000 URLs");
  const response = await fetch(key, { signal: AbortSignal.timeout(15000) });
  assert(response.ok, `${key} returned HTTP ${response.status}`);
  assert.equal(
    new URL(response.url).origin,
    base.origin,
    `${key} left the reader`,
  );
  const html = response.headers.get("content-type")?.includes("text/html");
  const body = html ? await response.text() : "";
  const document = {
    page: html ? parsePage(body) : null,
    body,
    url: new URL(response.url),
  };
  documents.set(key, document);
  return document;
}

const home = await load(new URL("/", base));
assert(home.page, "The reader home did not return HTML");
assert.deepEqual(
  home.page.sidebar,
  seedPages.map(({ path }) => path),
  "The sidebar must list every seed page in section and order",
);

const queue = [...paths].map((path) => new URL(path, base));
const checked = new Set();
let links = 0;
let anchors = 0;
for (const requested of queue) {
  const key = `${requested.origin}${requested.pathname}${requested.search}`;
  if (checked.has(key)) continue;
  checked.add(key);
  const { page, body, url } = await load(requested);
  assert(page, `${requested.pathname} did not return an HTML page`);
  assert.equal(
    url.pathname,
    requested.pathname,
    `${requested.pathname} redirected to ${url.pathname}`,
  );
  const source = expected.get(url.pathname);
  assert(source, `${url.pathname} is not a published seed page`);
  assert.deepEqual(
    page.titles.map((title) => title.replace(/\s+/g, " ")),
    [source.title],
    `${url.pathname} must have exactly one H1, its title`,
  );
  assert.equal(
    page.documentTitle,
    `${source.title} | ${siteName}`,
    `${url.pathname} has the wrong document title`,
  );
  const rendered = renderMarkdown(source.markdown);
  assert(
    body.includes(rendered.html),
    `${url.pathname} does not render its seed body`,
  );
  assert.deepEqual(
    page.toc,
    rendered.headings.map(({ id }) => `#${id}`),
    `${url.pathname} has the wrong "On this page" list`,
  );
  assert.equal(
    page.markdownLink,
    markdownPath(source.path),
    `${url.pathname} has the wrong Markdown link`,
  );
  assert.equal(page.alternate, markdownPath(source.path));
  const position = seedPages.indexOf(source);
  assert.deepEqual(
    page.pager,
    [seedPages[position - 1], seedPages[position + 1]]
      .filter(Boolean)
      .map(({ path }) => path),
    `${url.pathname} has the wrong previous and next pages`,
  );
  assert.equal(
    page.canonical,
    `${base.origin}${url.pathname}`,
    `${url.pathname} has the wrong canonical URL`,
  );
  assert(!page.noindex, `${url.pathname} is marked noindex`);
  assert.deepEqual(page.duplicateIds, [], `${url.pathname} repeats an id`);
  assert.deepEqual(page.handlers, [], `${url.pathname} has an event handler`);
  for (const asset of page.assets) await load(new URL(asset, url));
  for (const href of page.links) {
    const target = new URL(href, url);
    if (target.origin !== base.origin) continue;
    links++;
    const destination = await load(target);
    if (target.hash) {
      assert(
        destination.page,
        `${url.pathname} links to an anchor in non-HTML ${href}`,
      );
      assert(
        destination.page.ids.has(decodeURIComponent(target.hash.slice(1))),
        `${url.pathname} links to missing anchor ${href}`,
      );
      anchors++;
    }
    if (destination.page) queue.push(new URL(destination.url));
  }
}

async function expectRedirect(path, location) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(response.status, 308, `${path} returned HTTP ${response.status}`);
  assert.equal(
    new URL(response.headers.get("location"), base).pathname,
    location,
    `${path} redirected to the wrong address`,
  );
}
const nested = seedPages.find(({ slug }) => slug.includes("--"));
for (const [path, location] of [
  ["/introduction", "/"],
  ...(nested
    ? [
        [`/${nested.slug}`, nested.path],
        [`${nested.path}/`, nested.path],
        [`/${nested.slug}.md`, markdownPath(nested.path)],
        [`${markdownPath(nested.path)}/`, markdownPath(nested.path)],
      ]
    : []),
])
  await expectRedirect(path, location);
for (const path of ["/not-a-page", "/not-a-page.md", "/a/b/c"]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 404, `${path} returned HTTP ${response.status}`);
}
const missing = parsePage(await (await fetch(new URL("/not-a-page", base))).text());
assert(missing.noindex, "The not-found page must be noindex");
assert.equal(missing.canonical, undefined, "The not-found page has a canonical URL");

for (const relative of (await readFile(
  new URL("../src/styles/fonts.css", import.meta.url),
  "utf8",
)).matchAll(/url\(["']?(\/[^"')]+)/g))
  await load(new URL(relative[1], base));

const llms = await fetch(new URL("/llms.txt", base));
assert(llms.headers.get("content-type")?.startsWith("text/plain"));
const index = await llms.text();
assert.deepEqual(
  [...index.matchAll(/^## (.+)$/gm)].map(([, section]) => section),
  groupBySection(seedPages).map(({ section }) => section),
  "/llms.txt must group pages by section in sidebar order",
);
assert.deepEqual(
  [...index.matchAll(/^- \[(.+?)\]\((.+?)\): (.+)$/gm)].map(([, , href]) => new URL(href).pathname),
  seedPages.map(({ path }) => markdownPath(path)),
  "/llms.txt must list every page once with a description, in sidebar order",
);
const full = await fetch(new URL("/llms-full.txt", base));
assert(full.headers.get("content-type")?.startsWith("text/plain"));
const whole = await full.text();
const sitemap = await (await fetch(new URL("/sitemap.xml", base))).text();
assert.deepEqual(
  [...sitemap.matchAll(/<loc>(.+?)<\/loc>/g)].map(([, loc]) => new URL(loc).pathname),
  seedPages.map(({ path }) => path),
  "/sitemap.xml must list every page",
);
const robots = await (await fetch(new URL("/robots.txt", base))).text();
const signals = seed.settings.seo?.robotsTxt?.match(/^Content-Signal: .+$/m)?.[0];
assert(signals, "The seed robots.txt must declare Content Signals");
assert(robots.includes(signals), "/robots.txt must carry the seed's Content Signals");
const search = await fetch(new URL("/search.json", base));
assert(search.headers.get("content-type")?.startsWith("application/json"));
assert.deepEqual(
  await search.json(),
  searchIndex(seedPages),
  "/search.json does not match the seed pages",
);

const markdown = new Set();
for (const source of seedPages) {
  const url = new URL(markdownPath(source.path), base);
  const response = await fetch(url);
  assert(
    response.headers.get("content-type")?.startsWith("text/markdown"),
    `${url.pathname} must be Markdown`,
  );
  const document = chapterMarkdown(source, paths, base.origin);
  assert.equal(
    await response.text(),
    document,
    `${url.pathname} does not match its seed page`,
  );
  const body = document.slice(`# ${source.title}\n\n`.length);
  assert(whole.includes(body.trim()), `/llms-full.txt is missing ${source.path}`);
  for (const [, href] of body.matchAll(/\]\((https?:\/\/[^)\s#]+\.md)/g)) {
    assert.equal(new URL(href).origin, base.origin, `${url.pathname} links off-site to ${href}`);
    markdown.add(href);
  }

  const page = new URL(source.path, base);
  const negotiated = await fetch(page, { headers: { Accept: "text/markdown" } });
  assert(
    negotiated.headers.get("content-type")?.startsWith("text/markdown"),
    `${source.path} must answer Accept: text/markdown with Markdown`,
  );
  assert.equal(await negotiated.text(), document, `${source.path} negotiated Markdown differs`);
  const html = await fetch(page);
  assert(html.headers.get("content-type")?.startsWith("text/html"), `${source.path} must default to HTML`);
  assert.match(html.headers.get("vary") ?? "", /accept/i, `${source.path} must vary on Accept`);
  assert(
    html.headers.get("link")?.includes(`<${markdownPath(source.path)}>; rel="alternate"; type="text/markdown"`),
    `${source.path} must link its Markdown version in a Link header`,
  );
  await html.body?.cancel();
}
for (const href of markdown) {
  const response = await fetch(href);
  assert(response.ok, `Markdown link ${href} returned HTTP ${response.status}`);
}
process.stdout.write(
  `Verified ${checked.size} live pages against ${expected.size} seed pages, ${links} local links, ${anchors} anchors and ${markdown.size} Markdown targets at ${base.origin}.\n`,
);
