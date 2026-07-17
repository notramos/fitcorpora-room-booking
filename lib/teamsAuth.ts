import { createRemoteJWKSet, jwtVerify } from "jose";

export interface TeamsIdentity {
  oid: string;
  name: string;
  preferredUsername: string;
  tid: string;
}

const TENANT_ID = process.env.AZURE_AD_TENANT_ID!;
// Not a secret (it's the public Application ID URI, e.g. "api://domain/clientId"),
// so it's shared with the client bundle via the NEXT_PUBLIC_ prefix rather than
// duplicating the same value under two env var names.
const APP_ID_URI = process.env.NEXT_PUBLIC_TEAMS_APP_ID_URI!;

// Cached across requests/module lifetime, as recommended by jose — avoids
// re-fetching the JWKS on every verification call.
const jwks = createRemoteJWKSet(
  new URL(
    `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`
  )
);

export async function verifyTeamsToken(
  rawToken: string
): Promise<TeamsIdentity> {
  const { payload } = await jwtVerify(rawToken, jwks, {
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    audience: APP_ID_URI,
  });

  // Defense-in-depth on top of the issuer check above.
  if (payload.tid !== TENANT_ID) {
    throw new Error("Token tenant (tid) does not match expected tenant.");
  }

  const oid = payload.oid;
  const name = payload.name;
  const preferredUsername =
    payload.preferred_username ?? payload.upn ?? payload.email;

  if (typeof oid !== "string" || typeof name !== "string" || typeof preferredUsername !== "string") {
    throw new Error("Teams SSO token is missing required claims.");
  }

  return { oid, name, preferredUsername, tid: payload.tid };
}
