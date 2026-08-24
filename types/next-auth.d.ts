import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      // True when the signed-in user's Azure AD "roles" claim includes the
      // "Admin" App Role (see lib/auth.ts). Gates /admin/rooms and the
      // room-management + booking-approval API routes.
      isAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
  }
}
