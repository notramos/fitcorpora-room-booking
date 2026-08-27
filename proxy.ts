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
  // `display` and `api/display` are excluded so the public tablet/kiosk view
  // (and its data polling) works without login.
  matcher: [
    "/((?!api/auth|api/display|login|display|_next/static|_next/image|favicon.ico).*)",
  ],
};
