/**
 * NG Academy — أكاديمية الجيل الجديد
 * Minimal HS256 JWT signer/verifier (node:crypto only, no extra dependency).
 * The role travels both as `role` and as a WorkAdventure tag (`ng-<role>`),
 * which is what the WA pusher consumes through /api/room/access.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NgRole } from "../config.js";

export interface NgJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: NgRole;
  tags: string[];
  iat: number;
  exp: number;
}

const b64url = (buf: Buffer): string => buf.toString("base64url");

export function roleTags(role: NgRole): string[] {
  return [`ng-${role}`];
}

export function signJwt(
  payload: Omit<NgJwtPayload, "iat" | "exp" | "tags">,
  secret: string,
  ttlMs: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: NgJwtPayload = {
    ...payload,
    tags: roleTags(payload.role),
    iat: now,
    exp: now + Math.floor(ttlMs / 1000),
  };
  const head = b64url(
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf-8"),
  );
  const claims = b64url(Buffer.from(JSON.stringify(body), "utf-8"));
  const sig = createHmac("sha256", secret).update(`${head}.${claims}`).digest();
  return `${head}.${claims}.${b64url(sig)}`;
}

export function verifyJwt(
  token: string,
  secret: string,
): NgJwtPayload | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [head, claims, sig] = parts as [string, string, string];
  const expected = createHmac("sha256", secret)
    .update(`${head}.${claims}`)
    .digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(claims, "base64url").toString("utf-8"),
    ) as NgJwtPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now())
      return undefined;
    return payload;
  } catch {
    return undefined;
  }
}
