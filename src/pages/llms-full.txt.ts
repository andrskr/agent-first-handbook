import type { APIRoute } from "astro";
import { markdownLinks } from "../lib/chapter-paths";
import { listChapters } from "../lib/chapters";

export const GET: APIRoute = async ({ url }) => {
  const chapters = await listChapters();
  const paths = new Set(chapters.map(({ path }) => path));
  const body = chapters
    .map(
      ({ title, path, markdown }) =>
        `<!-- ${new URL(path, url).href} -->\n\n# ${title}\n\n${markdownLinks(markdown, paths, url.origin).trim()}\n`,
    )
    .join("\n---\n\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
