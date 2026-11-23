import { getEmDashCollection, getEmDashEntry } from "emdash";
import {
  markdownPath,
  parseRequest,
  pathToSlug,
  slugToPath,
} from "./chapter-paths.ts";
import { sortChapters } from "./order.ts";

interface ChapterData {
  title: string;
  markdown: string;
  section?: string;
  order?: number;
}

export interface Chapter {
  slug: string;
  path: string;
  title: string;
  section: string;
  order: number;
  markdown: string;
}

function toChapter(slug: string, data: ChapterData): Chapter {
  return {
    slug,
    path: slugToPath(slug),
    title: data.title,
    section: data.section?.trim() || "Other",
    order: Number.isFinite(data.order) ? Number(data.order) : Number.MAX_SAFE_INTEGER,
    markdown: data.markdown,
  };
}

/** Every published chapter, in sidebar order. */
export async function listChapters(): Promise<Chapter[]> {
  const chapters: Chapter[] = [];
  let cursor: string | undefined;
  do {
    const result = await getEmDashCollection<"pages", ChapterData>("pages", {
      status: "published",
      limit: 100,
      orderBy: { created_at: "asc" },
      ...(cursor ? { cursor } : {}),
    });
    if (result.error)
      throw new Error("The handbook could not be loaded.", {
        cause: result.error,
      });
    for (const { id, data } of result.entries) chapters.push(toChapter(id, data));
    cursor = result.nextCursor;
  } while (cursor);
  return sortChapters(chapters);
}

/** One chapter by path. An EmDash draft preview resolves here too. */
async function getChapter(path: string): Promise<Chapter | null> {
  const { entry, error } = await getEmDashEntry<"pages", ChapterData>(
    "pages",
    pathToSlug(path),
  );
  if (error)
    throw new Error("This chapter could not be loaded.", { cause: error });
  return entry ? toChapter(entry.id, entry.data) : null;
}

/**
 * Resolves a request path to its chapter, or to the canonical address to
 * redirect to. A trailing slash and a non-canonical spelling such as
 * "/introduction" redirect. A ".md" request keeps its ".md" in the redirect.
 */
export async function locate(
  pathname: string,
): Promise<{ redirect: string } | { chapter: Chapter | null }> {
  const request = parseRequest(pathname);
  if (!request) return { chapter: null };
  const chapter = await getChapter(request.path);
  if (!chapter) return { chapter: null };
  const canonical = request.markdown ? markdownPath(chapter.path) : chapter.path;
  return decodeURI(pathname) === canonical
    ? { chapter }
    : { redirect: canonical };
}
