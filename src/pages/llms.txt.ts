import type { APIRoute } from "astro";
import { markdownPath } from "../lib/chapter-paths";
import { listChapters } from "../lib/chapters";
import { renderMarkdown } from "../lib/markdown";
import { groupBySection } from "../lib/order";

export const GET: APIRoute = async ({ url }) => {
  const groups = groupBySection(await listChapters()).map(
    ({ section, chapters }) => {
      const lines = chapters.map(({ title, path, markdown }) => {
        const { description } = renderMarkdown(markdown);
        return `- [${title}](${new URL(markdownPath(path), url).href}): ${description || title}`;
      });
      return `## ${section}\n\n${lines.join("\n")}\n`;
    },
  );
  const body = `# Agent-first Operating Model

> A handbook for building and running products with agents central to the work. Detailed policies are proposed defaults until a team adopts them. Nothing here grants an agent permission to act.

Every page is available as Markdown at the links below. Links between pages point to their Markdown versions. The whole handbook is one file at ${new URL("/llms-full.txt", url).href}.

${groups.join("\n")}`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
