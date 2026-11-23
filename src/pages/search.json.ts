import type { APIRoute } from "astro";
import { listChapters } from "../lib/chapters";
import { searchIndex } from "../lib/search-index";

export const GET: APIRoute = async () =>
  Response.json(searchIndex(await listChapters()));
