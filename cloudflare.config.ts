import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
  worker: {
    name: "agent-first-handbook",
    entrypoint: "./src/worker.ts",
    compatibilityDate: "2026-02-24",
    compatibilityFlags: ["nodejs_compat"],
    triggers: [triggers.scheduled({ schedule: "* * * * *" })],
    env: {
      DB: bindings.d1({ name: "agent-first-handbook" }),
      MEDIA: bindings.r2({ name: "agent-first-handbook-media" }),
    },
  },
});
