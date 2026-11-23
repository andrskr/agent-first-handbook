import { Marked, type Tokens } from "marked";
import GithubSlugger from "github-slugger";
import { Parser } from "htmlparser2";
import sanitizeHtml from "sanitize-html";
import { escapeHtml } from "./html.ts";

export interface MarkdownHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface RenderedMarkdown {
  html: string;
  headings: MarkdownHeading[];
  /** The page's visible text, with tags removed and whitespace collapsed. */
  text: string;
  /** The first paragraph, shortened to about a sentence. */
  description: string;
}

function excerpt(text: string): string {
  const limit = 160;
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const sentence = flat.slice(0, limit).match(/^.*[.!?](?=\s)/)?.[0];
  if (sentence && sentence.length >= 60) return sentence;
  return `${flat.slice(0, flat.lastIndexOf(" ", limit))}…`;
}

function plainText(html: string): string {
  let text = "";
  const parser = new Parser({
    ontext: (part) => {
      text += part;
    },
  });
  parser.end(html);
  return text;
}

export function renderMarkdown(markdown: string): RenderedMarkdown {
  const slugger = new GithubSlugger();
  const headings: MarkdownHeading[] = [];
  const parser = new Marked({ gfm: true, breaks: false });
  parser.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = sanitizeHtml(text, {
          allowedTags: [],
          allowedAttributes: {},
        });
        const id = slugger.slug(plain);
        // The page title is the only h1, so a Markdown h1 becomes an h2.
        const level = Math.max(2, depth);
        if (level === 2 || level === 3)
          headings.push({ id, text: plainText(plain), level });
        return `<h${level} id="${escapeHtml(id)}">${text}</h${level}>`;
      },
      link({ href, title, tokens }) {
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text, title }) {
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ""}>`;
      },
      table({ header, rows, align }) {
        const cell = (
          item: Tokens.TableCell,
          index: number,
          tag: "th" | "td",
        ) =>
          `<${tag}${tag === "th" ? ' scope="col"' : ""}${align[index] ? ` class="align-${align[index]}"` : ""}>${this.parser.parseInline(item.tokens)}</${tag}>`;
        const label = header
          .map((item) => plainText(this.parser.parseInline(item.tokens)))
          .join(", ");
        return `<div class="table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(`Table: ${label}. Scroll horizontally if needed.`)}"><table><thead><tr>${header.map((item, index) => cell(item, index, "th")).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item, index) => cell(item, index, "td")).join("")}</tr>`).join("")}</tbody></table></div>\n`;
      },
      code({ text, lang }) {
        return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${escapeHtml(text)}</code></pre>`;
      },
    },
  });
  const tokens = parser.lexer(markdown);
  const first = tokens.find(
    (token): token is Tokens.Paragraph => token.type === "paragraph",
  );
  const description = first
    ? excerpt(plainText(parser.parseInline(first.text, { async: false })))
    : "";
  const html = sanitizeHtml(parser.parser(tokens), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "figure",
      "figcaption",
      "details",
      "summary",
      "input",
      "img",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["id", "class", "aria-label"],
      div: ["id", "class", "aria-label", "role", "tabindex"],
      th: ["class", "scope"],
      img: ["src", "alt", "title"],
      input: ["type", "checked", "disabled"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      input: (_tagName, attributes) => ({
        tagName: "input",
        attribs: {
          type: "checkbox",
          disabled: "",
          ...(attributes.checked !== undefined ? { checked: "" } : {}),
        },
      }),
    },
  });
  return {
    html,
    headings,
    text: plainText(html.replace(/<\/(?:t[dh]|li|p|h\d|pre)>/g, "$& "))
      .replace(/\s+/g, " ")
      .trim(),
    description,
  };
}
