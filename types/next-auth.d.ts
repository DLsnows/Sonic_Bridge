import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    username?: string | null;
    picture?: string | null;
  }
}
