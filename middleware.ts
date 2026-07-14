import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// TEMP: auth gating disabled for testing. Uncomment the block below and
// remove the early `return NextResponse.next()` to re-enable route protection.
export default async function middleware(request: NextRequest) {
  return NextResponse.next();

  /*
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
  */
}

export const config = {
  // `display` is excluded so the public tablet/kiosk view works without login.
  matcher: [
    "/((?!api/auth|login|display|_next/static|_next/image|favicon.ico).*)",
  ],
};
