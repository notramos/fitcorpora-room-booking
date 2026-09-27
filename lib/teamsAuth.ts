import { createRemoteJWKSet, jwtVerify } from "jose";

export interface TeamsIdentity {
  oid: string;
  name: string;
  preferredUsername: string;
  tid: string;
  roles: string[];
}

const TENANT_ID = process.env.AZURE_AD_TENANT_ID!;
// Teams requests the token for the Application ID URI, but Entra v2 access
// tokens put the API's client ID in `aud`. Validate against that claim value.
const API_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID!;

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
    audience: API_CLIENT_ID,
  });

  // Defense-in-depth on top of the issuer check above.
  if (payload.tid !== TENANT_ID) {
    throw new Error("Token tenant (tid) does not match expected tenant.");
  }

  const oid = payload.oid;
  const name = payload.name;
  const preferredUsername =
    payload.preferred_username ?? payload.upn ?? payload.email;
  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((role): role is string => typeof role === "string")
    : [];

  if (typeof oid !== "string" || typeof name !== "string" || typeof preferredUsername !== "string") {
    throw new Error("Teams SSO token is missing required claims.");
  }

  return { oid, name, preferredUsername, tid: payload.tid, roles };
}
