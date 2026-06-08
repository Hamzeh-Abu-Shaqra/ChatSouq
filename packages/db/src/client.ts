import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres-js creates connections lazily — the pool is safe to create without a
// live server. Queries will fail at runtime with a clear network error.
// This lets the app boot on Vercel without DATABASE_URL so general Q&A works
// immediately; add DATABASE_URL env var to unlock product and place search.
const url = process.env.DATABASE_URL ?? "postgresql://localhost:5432/chatsouq";

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL is not set — product and place search will return errors until configured.");
}

const queryClient = postgres(url, { max: 10 });
export const db = drizzle(queryClient, { schema });
export { schema };
export type DB = typeof db;
