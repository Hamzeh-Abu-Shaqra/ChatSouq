import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Single source of truth: the repo-root .env (cwd is this package during scripts).
config({ path: "../../.env" });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
