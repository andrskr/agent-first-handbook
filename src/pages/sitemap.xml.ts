import type { APIRoute } from "astro";
import { listChapters } from "../lib/chapters";

export const GET: APIRoute = async ({ url }) => {
  const chapters = await listChapters();
  const entries = chapters
    .map(({ path }) => `  <url><loc>${new URL(path, url).href}</loc></url>`)
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
