import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      // True when the signed-in user's email is in the ADMIN_EMAILS
      // allowlist (see lib/auth.ts). Gates /admin/*, the room-management
      // API, and booking approval.
      isAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
  }
}
