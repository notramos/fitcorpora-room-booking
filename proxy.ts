import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // `teams` must stay public for the initial iframe load. That page obtains
  // a Teams SSO token and exchanges it for the normal NextAuth session cookie.
  // `display` and `api/display` remain public for the tablet/kiosk view.
  matcher: [
    "/((?!api/auth|api/display|login|display|teams|_next/static|_next/image|favicon.ico).*)",
  ],
};
