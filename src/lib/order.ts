/** Sidebar sections in reading order. Any other section name sorts after them. */
export const sections = ["Guide", "Playbooks", "Reference"];

interface Ordered {
  title: string;
  section: string;
  order: number;
}

function rank(section: string): number {
  const index = sections.indexOf(section);
  return index < 0 ? sections.length : index;
}

export function sortChapters<T extends Ordered>(chapters: T[]): T[] {
  return [...chapters].sort(
    (a, b) =>
      rank(a.section) - rank(b.section) ||
      a.section.localeCompare(b.section) ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  );
}

/** Groups chapters that are already sorted, keeping the sort order. */
export function groupBySection<T extends Ordered>(
  sorted: T[],
): { section: string; chapters: T[] }[] {
  const groups: { section: string; chapters: T[] }[] = [];
  for (const chapter of sorted) {
    const last = groups.at(-1);
    if (last?.section === chapter.section) last.chapters.push(chapter);
    else groups.push({ section: chapter.section, chapters: [chapter] });
  }
  return groups;
}
