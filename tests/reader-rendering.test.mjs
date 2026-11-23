import assert from "node:assert/strict";
import test from "node:test";
import { parseDocument, DomUtils } from "htmlparser2";
import { renderMarkdown } from "../src/lib/markdown.ts";

function render(text) {
  const rendered = renderMarkdown(text);
  return { ...rendered, document: parseDocument(rendered.html) };
}

test("Inline text and repeated headings have readable TOC entries and stable fragment targets", () => {
  const { document, headings } = render(
    "## *Plan* & review\n\n## *Plan* & review",
  );
  const elements = DomUtils.getElementsByTagName("h2", document.children);
  assert.deepEqual(
    headings.map((heading) => heading.id),
    ["plan-amp-review", "plan-amp-review-1"],
  );
  assert.deepEqual(
    elements.map((element) => element.attribs.id),
    headings.map((heading) => heading.id),
  );
  assert.deepEqual(
    headings.map((heading) => heading.text),
    ["Plan & review", "Plan & review"],
  );
});

test("The table of contents lists h2 and h3 with their level, and the page title stays the only h1", () => {
  const { document, headings } = render(
    "# Top\n\n## Second\n\n### Third\n\n#### Fourth\n\n##### Fifth\n",
  );
  assert.deepEqual(
    headings.map(({ id, level }) => [id, level]),
    [
      ["top", 2],
      ["second", 2],
      ["third", 3],
    ],
  );
  assert.equal(DomUtils.getElementsByTagName("h1", document.children).length, 0);
  assert.equal(DomUtils.getElementsByTagName("h4", document.children).length, 1);
});

test("Links to other pages keep absolute paths and anchors", () => {
  const { html } = render(
    "[a](/authority) [b](/playbooks/fix-a-bug#reproduce-first) [c](https://example.test/x) [d](#here)",
  );
  assert.match(html, /<a href="\/authority">a<\/a>/);
  assert.match(html, /<a href="\/playbooks\/fix-a-bug#reproduce-first">b<\/a>/);
  assert.match(html, /<a href="https:\/\/example\.test\/x">c<\/a>/);
  assert.match(html, /<a href="#here">d<\/a>/);
});

test("Tables, code and task lists render as the reader's markup", () => {
  const { html } = render(
    "```text\n<b>code</b>\n```\n\n- [ ] task\n\n| A | B |\n| - | -: |\n| 1 | 2 |\n",
  );
  assert.match(html, /<pre><code class="language-text">&lt;b&gt;code&lt;\/b&gt;/);
  assert.match(html, /<input[^>]*disabled/);
  assert.match(html, /<th scope="col">A<\/th>/);
  assert.match(html, /<th scope="col" class="align-right">B<\/th>/);
  assert.match(html, /<div class="table-scroll" role="region" tabindex="0"/);
});

test("A mermaid block is ordinary code, not a trusted diagram", () => {
  const { html } = render("```mermaid\nA --> B\n```\n");
  assert.match(html, /<pre><code class="language-mermaid">A --&gt; B/);
  assert.doesNotMatch(html, /<figure|<svg/);
});

test("The description is the first paragraph, shortened, even after a table", () => {
  assert.equal(
    render("| A | B |\n| - | - |\n| 1 | 2 |\n\nBody text follows.\n").description,
    "Body text follows.",
  );
  const long = render(`${"word ".repeat(80)}\n`).description;
  assert(long.length <= 161, "A description stays short");
  assert.equal(render("## Only a heading\n").description, "");
});

test("Plain text keeps words in separate blocks apart", () => {
  const { text } = render("## Head\n\nOne.\n\n| A | B |\n| - | - |\n| x | y |\n");
  assert.equal(text, "Head One. A B x y");
});

test("Hostile text cannot reach the page as markup", () => {
  const attack =
    '<img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)">x</a><svg onload=alert(1)>';
  const { html, headings } = render(
    `## ${attack}\n\n${attack}\n\n[y](javascript:alert(1))\n\n![z](javascript:alert(1))\n\n[q](<http://x/a"b>)\n\n| ${attack} |\n| - |\n| ${attack} |\n\n\`\`\`${attack}\n${attack}\n\`\`\`\n`,
  );
  const elements = DomUtils.findAll(() => true, parseDocument(html).children);
  assert.deepEqual(
    elements.filter(({ name }) => ["script", "svg"].includes(name)),
    [],
  );
  for (const { name, attribs } of elements)
    for (const [attribute, value] of Object.entries(attribs)) {
      assert.doesNotMatch(attribute, /^on/i, `${name} has ${attribute}`);
      assert.doesNotMatch(value, /^\s*javascript:/i, `${name} ${attribute} runs script`);
    }
  assert.match(html, /href="http:\/\/x\/a&quot;b"/);
  for (const { text } of headings) assert.doesNotMatch(text, /<script/);
});

test("Unsafe attributes and styles are stripped", () => {
  const { html } = render('<p style="color:red" onclick="x()">styled</p>\n');
  assert.doesNotMatch(html, /style=|onclick=/);
});
