import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

let _db: ReturnType<typeof drizzle> | undefined;
let _initError: Error | null = null;

function getDb() {
  if (_initError) throw _initError;
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      _initError = new Error(
        "DATABASE_URL is not configured. Add it in Vercel dashboard → Settings → Environment Variables and scope to Preview/Production environments.",
      );
      throw _initError;
    }
    try {
      const sql = neon(process.env.DATABASE_URL);
      _db = drizzle({ client: sql });
    } catch (err) {
      _initError = err instanceof Error ? err : new Error(String(err));
      throw _initError;
    }
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop);
  },
});
