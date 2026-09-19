/**
 * Google OAuth 2.0 (Authorization Code flow) - minimal, no SDK.
 *
 * Env needed (put real values in .env, placeholders in .env.example):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *
 * Redirect URI registered in Google Cloud Console:
 *   http://localhost:3000/api/auth/google/callback   (dev)
 *   https://yourdomain.com/api/auth/google/callback  (prod)
 *
 * If credentials are missing, Google sign-in is hidden and the API
 * returns 503 - email/password keeps working everywhere.
 */

import { createHmac } from "node:crypto";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Deterministic redirect URI. Google matches it EXACTLY against the
 * Authorized redirect URIs list, so we pin the origin instead of trusting
 * request headers. Priority:
 *   APP_URL (explicit) > Vercel production domain > request origin.
 * Vercel vars carry no protocol, so add https:// when missing.
 */
export function googleRedirectUri(origin: string): string {
  const raw =
    process.env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    origin;
  const base = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  const url = new URL(base);
  /* Google only allows http on localhost - production MUST be https,
   * even if APP_URL was misconfigured with an http:// prefix. */
  if (!/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
    url.protocol = "https:";
  }
  return `${url.origin}/api/auth/google/callback`;
}

/** Build the consent-screen URL with a CSRF state parameter. */
export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

/** Exchange the authorization code for tokens, then fetch the profile. */
export async function exchangeCodeForProfile(
  code: string,
  origin: string,
): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`token exchange failed (${tokenRes.status})`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("no access_token");

  const profileRes = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`userinfo failed (${profileRes.status})`);
  }
  const profile = (await profileRes.json()) as GoogleProfile;
  if (!profile.email) throw new Error("profile has no email");
  return profile;
}

/** Sign the state value so a forged callback is rejected. */
export function signState(state: string): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET ?? "dev-fallback";
  return Buffer.from(`${state}.${hash(state, secret)}`).toString("base64url");
}

export function verifyState(signed: string): string | null {
  try {
    const decoded = Buffer.from(signed, "base64url").toString("utf8");
    const idx = decoded.lastIndexOf(".");
    const state = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    const secret = process.env.GOOGLE_CLIENT_SECRET ?? "dev-fallback";
    return hash(state, secret) === sig ? state : null;
  } catch {
    return null;
  }
}

function hash(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
