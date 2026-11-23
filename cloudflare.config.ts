import { bindings, defineConfig, triggers } from "cf/config";

// Previews never touch production data: each gets its own D1 database and R2 bucket.
// Previews cannot carry cron triggers, and the EmDash schedule only runs in production.
// Preview uploads need the D1 database ID. Production finds its database by name.
const previewDatabaseId = "5443a67d-c9ed-4e0b-b213-6a32c770b0ed";

export default defineConfig(({ isPreview }) => {
  const suffix = isPreview ? "-preview" : "";
  return {
    worker: {
      name: "agent-first-handbook",
      entrypoint: "./src/worker.ts",
      compatibilityDate: "2026-02-24",
      compatibilityFlags: ["nodejs_compat"],
      observability: { enabled: true },
      ...(isPreview ? {} : { triggers: [triggers.scheduled({ schedule: "* * * * *" })] }),
      env: {
        DB: bindings.d1({
          name: `agent-first-handbook${suffix}`,
          ...(isPreview ? { id: previewDatabaseId } : {}),
        }),
        MEDIA: bindings.r2({ name: `agent-first-handbook-media${suffix}` }),
      },
    },
  };
});
