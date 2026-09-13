/**
 * NG Academy — أكاديمية الجيل الجديد
 * Magic-link login to the PARENT email (confirmed decision): the child never
 * handles a password. Tokens are single-use, short-lived, and stored hashed.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Repository } from "../db/types.js";

export interface EmailTransport {
  send(to: string, subject: string, body: string): Promise<void>;
}

/** Development transport: prints to the server log. */
export class LogEmailTransport implements EmailTransport {
  async send(to: string, subject: string, body: string): Promise<void> {
    console.info(`[ng-mail] to=${to} subject=${subject}\n${body}`);
  }
}

/** Test transport: keeps messages in memory. */
export class CapturingEmailTransport implements EmailTransport {
  readonly sent: { to: string; subject: string; body: string }[] = [];
  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
  }
}

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export interface MagicLinkRequestResult {
  /** False when the email is unknown: we answer 202 either way (no account enumeration). */
  known: boolean;
}

export async function requestMagicLink(
  repo: Repository,
  email: EmailTransport,
  email_: string,
  appUrl: string,
  ttlMs: number,
): Promise<MagicLinkRequestResult> {
  const address = email_.trim().toLowerCase();
  const user = await repo.getUserByEmail(address);
  if (
    !user ||
    (user.role !== "parent" &&
      user.role !== "admin" &&
      user.role !== "owner" &&
      user.role !== "teacher")
  ) {
    // Children cannot request links: login always goes through the parent.
    return { known: false };
  }
  const token = randomBytes(24).toString("base64url");
  await repo.createMagicToken(hashToken(token), address, Date.now() + ttlMs);
  const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
  // Hash query: the token never reaches any server log on the way in.
  const link = `${base}#/login?token=${token}`;
  await email.send(
    address,
    "رابط دخول أكاديمية الجيل الجديد",
    `مرحبًا! رابط الدخول إلى أكاديمية الجيل الجديد (صالح لمرة واحدة ولمدة 15 دقيقة):\n${link}\n` +
      `إن لم تطلبه، تجاهل هذه الرسالة.`,
  );
  return { known: true };
}

/** Consumes a token and returns the account email, or undefined when invalid/expired/used. */
export async function verifyMagicLink(
  repo: Repository,
  token: string,
): Promise<string | undefined> {
  return repo.consumeMagicToken(hashToken(token), Date.now());
}
