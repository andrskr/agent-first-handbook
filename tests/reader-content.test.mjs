import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  markdownLinks,
  markdownPath,
  parseRequest,
  pathToSlug,
  slugToPath,
} from "../src/lib/chapter-paths.ts";
import { groupBySection, sections, sortChapters } from "../src/lib/order.ts";
import { renderMarkdown } from "../src/lib/markdown.ts";
import { searchIndex } from "../src/lib/search-index.ts";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const seed = JSON.parse(read("../seed/handbook.json"));

// Tests whose name starts with "Seed:" read seed/handbook.json and depend on the edition.

test("A slug maps to its path, and the introduction is served at the root", () => {
  for (const [slug, path] of [
    ["introduction", "/"],
    ["quickstart", "/quickstart"],
    ["playbooks--fix-a-bug", "/playbooks/fix-a-bug"],
    ["reference--glossary", "/reference/glossary"],
  ]) {
    assert.equal(slugToPath(slug), path, slug);
    assert.equal(pathToSlug(path), slug, path);
  }
  assert.equal(markdownPath("/"), "/introduction.md");
  assert.equal(markdownPath("/playbooks/fix-a-bug"), "/playbooks/fix-a-bug.md");
});

test("A request is read into a path and a Markdown flag", () => {
  for (const [address, path, markdown] of [
    ["/", "/", false],
    ["/introduction.md", "/introduction", true],
    ["/playbooks/fix-a-bug", "/playbooks/fix-a-bug", false],
    ["/playbooks/fix-a-bug/", "/playbooks/fix-a-bug", false],
    ["/playbooks/fix-a-bug.md", "/playbooks/fix-a-bug", true],
    ["/playbooks/fix-a-bug.md/", "/playbooks/fix-a-bug", true],
    ["/a%20b", "/a b", false],
    ["/.md", "/", true],
  ]) {
    assert.deepEqual(parseRequest(address), { path, markdown }, address);
  }
  assert.equal(parseRequest("/%E0%A4%A"), null);
});

test("Markdown links point to the Markdown version of known pages only", () => {
  const paths = new Set(["/", "/authority", "/playbooks/fix-a-bug"]);
  assert.equal(
    markdownLinks(
      "[a](/authority) [b](/playbooks/fix-a-bug#reproduce-first) [c](/) [d](/llms.txt) [e](//evil.test/authority) [f](https://e.test/authority) [g](#x) [h](/missing)",
      paths,
    ),
    "[a](/authority.md) [b](/playbooks/fix-a-bug.md#reproduce-first) [c](/introduction.md) [d](/llms.txt) [e](//evil.test/authority) [f](https://e.test/authority) [g](#x) [h](/missing)",
  );
});

test("Sections sort Guide, Playbooks, Reference, then any other name, with pages by order", () => {
  const page = (title, section, order) => ({ title, section, order });
  const sorted = sortChapters([
    page("Zed", "Reference", 1),
    page("Odd", "Appendix", 1),
    page("B", "Guide", 2),
    page("Run", "Playbooks", 1),
    page("A", "Guide", 1),
    page("Tie b", "Guide", 3),
    page("Tie a", "Guide", 3),
    page("Late", "Guide", Number.MAX_SAFE_INTEGER),
    page("Other", "Another", 5),
  ]);
  assert.deepEqual(
    sorted.map(({ title }) => title),
    ["A", "B", "Tie a", "Tie b", "Late", "Run", "Zed", "Other", "Odd"],
  );
  assert.deepEqual(
    groupBySection(sorted).map(({ section }) => section),
    [...sections, "Another", "Appendix"],
  );
});

test("The search index lists every page with its title, path, section, headings and text", () => {
  const index = searchIndex([
    {
      title: "Fix a bug",
      path: "/playbooks/fix-a-bug",
      section: "Playbooks",
      markdown: "Open.\n\n## Reproduce first\n\n### Narrow it\n\nBisect `by` commit.\n",
    },
  ]);
  assert.deepEqual(index, [
    {
      title: "Fix a bug",
      path: "/playbooks/fix-a-bug",
      section: "Playbooks",
      headings: ["Reproduce first", "Narrow it"],
      text: "Open. Reproduce first Narrow it Bisect by commit.",
    },
  ]);
});

// Seed: everything below reads seed/handbook.json and depends on the edition.

const pages = seed.content.pages.filter(({ status }) => status === "published");
const byPath = new Map(
  pages.map(({ slug, data }) => [slugToPath(slug), { slug, ...data }]),
);

test("Seed: the pages collection declares title, section, order and markdown", () => {
  const collection = seed.collections.find(({ slug }) => slug === "pages");
  const fields = Object.fromEntries(
    collection.fields.map(({ slug, type, required }) => [slug, { type, required }]),
  );
  assert.deepEqual(fields, {
    title: { type: "string", required: true },
    section: { type: "string", required: true },
    order: { type: "integer", required: true },
    markdown: { type: "text", required: true },
  });
});

test("Seed: every page has a title, a known section, an order and an h1-free body", () => {
  assert(pages.length > 0, "The seed has no published pages");
  assert(byPath.has("/"), "The introduction must be served at /");
  assert.equal(byPath.size, pages.length, "Two slugs map to one path");
  for (const [path, page] of byPath) {
    assert(page.title.trim(), `${path} has no title`);
    assert(sections.includes(page.section), `${path} is in unknown section ${page.section}`);
    assert(Number.isInteger(page.order), `${path} has no integer order`);
    assert.doesNotMatch(page.markdown, /^# /m, `${path} has an h1 in its body`);
    assert(renderMarkdown(page.markdown).description, `${path} has no opening paragraph`);
  }
});

test("Seed: every link to another page lands on an existing page and heading", () => {
  for (const [path, page] of byPath)
    for (const [, target, hash] of page.markdown.matchAll(/\]\((\/[^)\s#]*)(?:#([^)\s]*))?\)/g)) {
      const page = target.replace(/\/+$/, "") || "/";
      const to = page === "/introduction.md" ? "/" : page.replace(/\.md$/, "");
      if (/^\/(?:llms|sitemap|search)/.test(to)) continue;
      assert(byPath.has(to), `${path} links to missing page ${target}`);
      if (hash)
        assert(
          renderMarkdown(byPath.get(to).markdown).headings.some(({ id }) => id === hash),
          `${path} links to missing heading ${target}#${hash}`,
        );
    }
});

test("Seed: pages describe the model, not how to run this website", () => {
  const upkeep =
    /\bEmDash\b|\bpnpm\b|\bcontent:(?:check|export)\b|\bAGENTS file\b|\breader check\b|\bthis (?:site|website)\b|maintain(?:ing)? the handbook/i;
  for (const { slug, data } of pages) {
    const found = `${data.title}\n${data.markdown}`.match(upkeep);
    assert.equal(found, null, `${slug} mentions site upkeep: ${found?.[0]}`);
  }
});

test("Seed: the prose avoids the punctuation the writing standard forbids", () => {
  const prose = (text) =>
    text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/<[^>]+>/g, "");
  const documents = [
    ...seed.content.pages.map(({ slug, data }) => [slug, `${data.title}\n${data.markdown}`]),
    ...["../README.md", "../AGENTS.md"].map((file) => [file, read(file)]),
  ];
  for (const [name, text] of documents)
    assert.deepEqual(
      prose(text).match(/[–—‘’“”;]/g) ?? [],
      [],
      `${name} has a dash, a curly quote, or a semicolon`,
    );
});
