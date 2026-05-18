import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

let _db: ReturnType<typeof drizzle> | undefined;

function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Configure it in .env.local for local dev or via `vercel env add` for production.",
      );
    }
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzle({ client: sql });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop);
  },
});
