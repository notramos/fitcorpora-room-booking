import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

// Admins are configured by email address, not by an Azure AD App Role —
// set ADMIN_EMAILS to a comma-separated list (case-insensitive). Gates
// /admin/*, the room-management API, and booking approval.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // On initial sign-in `profile` holds the decoded id_token claims. Azure
    // AD doesn't always populate `email`, so fall back to the UPN claims,
    // then stamp isAdmin from the ADMIN_EMAILS allowlist.
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as {
          email?: string;
          preferred_username?: string;
          upn?: string;
        };
        const email =
          (token.email as string | undefined) ??
          p.email ??
          p.preferred_username ??
          p.upn;
        if (email) token.email = email;
        token.isAdmin = isAdminEmail(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
};
