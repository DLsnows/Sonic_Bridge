import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

let _db: ReturnType<typeof drizzle> | undefined;

function getDb() {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle({ client: sql });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop);
  },
});
