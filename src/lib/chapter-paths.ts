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
 * Makes root-relative links absolute against the site origin, and points links
 * to known chapters at their Markdown versions, so an agent that reads one
 * chapter as Markdown can fetch every link as written and stay in Markdown.
 */
export function markdownLinks(
  markdown: string,
  paths: Set<string>,
  origin: string,
): string {
  return markdown.replace(/\]\((\/(?!\/)[^)\s#]*)/g, (_, target: string) => {
    const path = target.replace(/\/+$/, "") || "/";
    return `](${origin}${paths.has(path) ? markdownPath(path) : target}`;
  });
}

/** A chapter as a Markdown document: its title as the h1, then its body. */
export function chapterMarkdown(
  chapter: { title: string; markdown: string },
  paths: Set<string>,
  origin: string,
): string {
  return `# ${chapter.title}\n\n${markdownLinks(chapter.markdown, paths, origin)}`;
}

/**
 * Whether an Accept header asks for Markdown ahead of HTML. A wildcard alone
 * keeps HTML, so browsers and generic clients get the page.
 */
export function prefersMarkdown(accept: string | null): boolean {
  const quality = (type: string) => {
    for (const range of (accept ?? "").split(",")) {
      const [name, ...parameters] = range.split(";").map((part) => part.trim());
      if (name?.toLowerCase() !== type) continue;
      const q = parameters.find((parameter) => /^q=/i.test(parameter));
      return q ? Number(q.slice(2)) || 0 : 1;
    }
    return 0;
  };
  const markdown = quality("text/markdown");
  return markdown > 0 && markdown >= quality("text/html");
}
