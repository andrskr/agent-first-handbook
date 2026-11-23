import type { APIRoute } from "astro";
import { chapterMarkdown } from "../lib/chapter-paths";
import { listChapters, locate } from "../lib/chapters";

export const GET: APIRoute = async ({ redirect, url }) => {
  const found = await locate(url.pathname);
  if ("redirect" in found) return redirect(`${found.redirect}${url.search}`, 308);
  if (!found.chapter) return new Response("Page not found.\n", { status: 404 });
  const paths = new Set((await listChapters()).map(({ path }) => path));
  return new Response(chapterMarkdown(found.chapter, paths, url.origin), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
