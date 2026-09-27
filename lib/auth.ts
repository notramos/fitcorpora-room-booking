import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

// Microsoft Entra emits assigned application roles in the `roles` token claim.
// Both Office Management and IT Support are assigned the shared `Admin` role.
export function isAdminRoleClaim(roles: unknown): boolean {
  return Array.isArray(roles) && roles.some((role) => role === "Admin");
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
    // AD doesn't always populate `email`, so fall back to the UPN claims.
    // Admin access comes from the Entra application role claim.
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as {
          email?: string;
          preferred_username?: string;
          upn?: string;
          roles?: unknown;
        };
        const email =
          (token.email as string | undefined) ??
          p.email ??
          p.preferred_username ??
          p.upn;
        if (email) token.email = email;
        token.isAdmin = isAdminRoleClaim(p.roles);
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
