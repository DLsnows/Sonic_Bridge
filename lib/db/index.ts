import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

let _db: ReturnType<typeof drizzle> | undefined;
let _configError: Error | null = null;

function getDb() {
  if (_db) return _db;
  if (_configError) throw _configError;
  if (!process.env.DATABASE_URL) {
    _configError = new Error(
      "DATABASE_URL is not configured. Add it in Vercel dashboard → Settings → Environment Variables and scope to Preview/Production environments.",
    );
    throw _configError;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(pool);
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop);
  },
});
