import { renderMarkdown } from "./markdown.ts";

export interface SearchEntry {
  title: string;
  path: string;
  section: string;
  headings: string[];
  text: string;
}

export function searchIndex(
  chapters: { title: string; path: string; section: string; markdown: string }[],
): SearchEntry[] {
  return chapters.map(({ title, path, section, markdown }) => {
    const { headings, text } = renderMarkdown(markdown);
    return { title, path, section, headings: headings.map((h) => h.text), text };
  });
}
