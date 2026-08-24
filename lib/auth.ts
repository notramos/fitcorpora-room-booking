import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

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
    // Runs on initial sign-in with the raw decoded id_token claims in
    // `profile` — this is where Azure AD's "roles" claim (populated once an
    // App Role is defined + assigned to the user in Azure Portal) shows up.
    async jwt({ token, profile }) {
      if (profile) {
        const roles = (profile as { roles?: unknown }).roles;
        token.isAdmin =
          Array.isArray(roles) && roles.includes("Admin");
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
