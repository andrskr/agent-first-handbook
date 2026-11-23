/** The slug that is served at "/" instead of "/introduction". */
const home = "introduction";

/** Entry slug to public path: "--" separates path segments. */
export function slugToPath(slug: string): string {
  return slug === home ? "/" : `/${slug.replaceAll("--", "/")}`;
}

export function pathToSlug(path: string): string {
  return path === "/" ? home : path.replace(/^\//, "").replaceAll("/", "--");
}

export function markdownPath(path: string): string {
  return path === "/" ? `/${home}.md` : `${path}.md`;
}

/**
 * Reads a request path into the chapter path it addresses and whether it asked
 * for the Markdown version. Trailing slashes are ignored. Returns null for a
 * path that cannot be decoded.
 */
export function parseRequest(
  pathname: string,
): { path: string; markdown: boolean } | null {
  let decoded: string;
  try {
    decoded = decodeURI(pathname);
  } catch {
    return null;
  }
  const trimmed = decoded.replace(/\/+$/, "") || "/";
  const markdown = trimmed.endsWith(".md");
  const path = (markdown ? trimmed.slice(0, -3) : trimmed) || "/";
  return { path, markdown };
}

/**
 * Points links to known chapters at their Markdown versions, so an agent that
 * reads one chapter as Markdown stays in Markdown.
 */
export function markdownLinks(markdown: string, paths: Set<string>): string {
  return markdown.replace(/\]\((\/[^)\s#]*)/g, (link, target: string) => {
    const path = target.replace(/\/+$/, "") || "/";
    return paths.has(path) ? `](${markdownPath(path)}` : link;
  });
}
