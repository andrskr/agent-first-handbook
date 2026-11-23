interface Entry {
  title: string;
  path: string;
  section: string;
  headings: string[];
  text: string;
}

const input = document.querySelector<HTMLInputElement>("#search-input");
const box = document.querySelector<HTMLElement>("#search-results");
const form = input?.closest<HTMLElement>(".search");

if (input && box && form) {
  let entries: Promise<Entry[]> | undefined;
  let active = -1;
  // The index loads on first focus and is kept for the page's lifetime.
  const load = () =>
    (entries ??= fetch("/search.json")
      .then((response) => (response.ok ? (response.json() as Promise<Entry[]>) : []))
      .catch(() => []));
  const rows = () => [...box.querySelectorAll<HTMLAnchorElement>("a")];

  const close = () => {
    box.hidden = true;
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const mark = (step: number) => {
    const items = rows();
    if (!items.length) return;
    active =
      active < 0 ? (step > 0 ? 0 : items.length - 1) : (active + step + items.length) % items.length;
    items.forEach((item, index) => item.setAttribute("aria-selected", String(index === active)));
    input.setAttribute("aria-activedescendant", items[active].id);
    items[active].scrollIntoView({ block: "nearest" });
  };

  // Every term must appear. Title matches rank above heading matches, then text.
  const find = (all: Entry[], query: string) => {
    const terms = query.toLowerCase().split(/\s+/);
    return all
      .map((entry) => {
        const title = entry.title.toLowerCase();
        const headings = entry.headings.map((heading) => heading.toLowerCase());
        const text = entry.text.toLowerCase();
        let score = 0;
        for (const term of terms) {
          const part = title.includes(term) ? 8 : headings.some((h) => h.includes(term)) ? 4 : text.includes(term) ? 1 : 0;
          if (!part) return { entry, score: 0, detail: "" };
          score += part;
        }
        const heading = entry.headings.find((h) => h.toLowerCase().includes(terms[0]));
        const at = text.indexOf(terms[0]);
        const detail = title.includes(terms[0])
          ? entry.section
          : (heading ?? (at < 0 ? entry.section : `…${entry.text.slice(Math.max(0, at - 40), at + 80)}…`));
        return { entry, score, detail };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  };

  const show = (hits: ReturnType<typeof find>) => {
    box.replaceChildren(
      ...hits.map(({ entry, detail }, index) => {
        const link = document.createElement("a");
        link.href = entry.path;
        link.id = `search-result-${index}`;
        link.setAttribute("role", "option");
        link.setAttribute("aria-selected", "false");
        const title = document.createElement("strong");
        title.textContent = entry.title;
        const note = document.createElement("small");
        note.textContent = detail;
        link.appendChild(title);
        link.appendChild(note);
        return link;
      }),
    );
    if (!hits.length) box.textContent = "No results";
    box.hidden = false;
    active = -1;
    input.setAttribute("aria-expanded", "true");
  };

  input.addEventListener("focus", () => void load());
  input.addEventListener("input", async () => {
    const query = input.value.trim();
    if (!query) return close();
    const hits = find(await load(), query);
    if (input.value.trim() === query) show(hits);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      mark(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") rows()[Math.max(active, 0)]?.click();
    else if (event.key === "Escape") {
      close();
      input.blur();
    }
  });
  form.addEventListener("focusout", (event) => {
    if (!form.contains(event.relatedTarget as Node | null)) close();
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    event.preventDefault();
    input.focus();
    input.select();
  });
}
