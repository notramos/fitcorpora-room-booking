import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { verifyTeamsToken } from "@/lib/teamsAuth";

const MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches next-auth's default

function sessionCookieName(): string {
  const useSecureCookie = (process.env.NEXTAUTH_URL ?? "").startsWith(
    "https://"
  );
  return useSecureCookie
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  if (!body.token) {
    return NextResponse.json(
      { error: "Field 'token' wajib diisi." },
      { status: 400 }
    );
  }

  let identity;
  try {
    identity = await verifyTeamsToken(body.token);
  } catch {
    return NextResponse.json(
      { error: "Verifikasi token Teams gagal." },
      { status: 401 }
    );
  }

  const sessionToken = await encode({
    token: {
      sub: identity.oid,
      name: identity.name,
      email: identity.preferredUsername,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: MAX_AGE,
  });

  const response = NextResponse.json({ ok: true });
  // SameSite=None + Secure (rather than next-auth's own default of Lax) since
  // this cookie is being set from inside the Teams iframe context.
  response.cookies.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });

  return response;
}
