import { bindings, defineConfig, triggers } from "cf/config";

// Previews never touch production data: each gets its own D1 database and R2 bucket.
export default defineConfig(({ isPreview }) => {
  const suffix = isPreview ? "-preview" : "";
  return {
    worker: {
      name: "agent-first-handbook",
      entrypoint: "./src/worker.ts",
      compatibilityDate: "2026-02-24",
      compatibilityFlags: ["nodejs_compat"],
      observability: { enabled: true },
      triggers: [triggers.scheduled({ schedule: "* * * * *" })],
      env: {
        DB: bindings.d1({ name: `agent-first-handbook${suffix}` }),
        MEDIA: bindings.r2({ name: `agent-first-handbook-media${suffix}` }),
      },
    },
  };
});
