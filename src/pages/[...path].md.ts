import type { APIRoute } from "astro";
import { markdownLinks } from "../lib/chapter-paths";
import { listChapters, locate } from "../lib/chapters";

export const GET: APIRoute = async ({ redirect, url }) => {
  const found = await locate(url.pathname);
  if ("redirect" in found) return redirect(`${found.redirect}${url.search}`, 308);
  if (!found.chapter) return new Response("Page not found.\n", { status: 404 });
  const chapters = await listChapters();
  const body = markdownLinks(
    found.chapter.markdown,
    new Set(chapters.map(({ path }) => path)),
  );
  return new Response(`# ${found.chapter.title}\n\n${body}`, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
