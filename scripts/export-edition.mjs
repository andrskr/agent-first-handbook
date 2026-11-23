import { execFileSync } from "node:child_process";
import { glob, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const databases = [];
for await (const file of glob(".cloudflare/state/v3/d1/*/*.sqlite")) {
  if (!file.endsWith("/metadata.sqlite")) databases.push(file);
}
if (!process.argv[2] && databases.length !== 1) {
  throw new Error(
    "Start the local reader first, or pass the handbook's local D1 SQLite file explicitly.",
  );
}
const database = process.argv[2] ?? databases[0];
const output = execFileSync(
  "pnpm",
  [
    "exec",
    "emdash",
    "export-seed",
    "--database",
    database,
    "--with-content",
    "pages",
  ],
  {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  },
);
const exported = JSON.parse(output);
const collection = exported.collections.find(({ slug }) => slug === "pages");
const chapters = exported.content.pages.filter(
  ({ status }) => status === "published",
);
if (
  !collection ||
  !chapters.length ||
  chapters.some(
    ({ data, slug }) =>
      !slug ||
      typeof data.title !== "string" ||
      typeof data.section !== "string" ||
      !Number.isInteger(data.order) ||
      typeof data.markdown !== "string",
  )
) {
  throw new Error(
    "Expected published handbook pages with slugs, titles, sections, integer orders and Markdown bodies.",
  );
}

const edition = {
  $schema: exported.$schema,
  version: exported.version,
  meta: { name: "Agent-first Product Operating Model" },
  defaultLocale: exported.defaultLocale,
  settings: {
    title: exported.settings.title,
    tagline: exported.settings.tagline,
    ...(exported.settings.seo?.robotsTxt && {
      seo: { robotsTxt: exported.settings.seo.robotsTxt },
    }),
  },
  collections: [collection],
  content: {
    pages: chapters.sort((a, b) => a.slug.localeCompare(b.slug, "en")),
  },
};
const target = fileURLToPath(new URL("../seed/handbook.json", import.meta.url));
const temporary = target + "." + process.pid + ".tmp";
await writeFile(temporary, JSON.stringify(edition, null, 2) + "\n", {
  flag: "wx",
});
await rename(temporary, target);
console.log(
  `Saved ${chapters.length} published pages to seed/handbook.json.`,
);
