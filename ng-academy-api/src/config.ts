import { z } from "zod";

/**
 * NG Academy — أكاديمية الجيل الجديد
 * Environment configuration, validated at boot with zod.
 */
const configSchema = z.object({
  PORT: z.coerce.number().default(3100),
  /** Postgres connection. When absent the API refuses to boot in production mode. */
  DATABASE_URL: z.string().optional(),
  /** HMAC secret for the JWTs handed to the front / WA pusher. */
  JWT_SECRET: z.string().min(16).default("ng-academy-dev-secret-change-me"),
  /** Shared secret the WA pusher sends as Authorization header (ADMIN_API_TOKEN). */
  ADMIN_API_TOKEN: z.string().default("ng-academy-admin-token"),
  /** Base URL where the school maps are served (maps container / map-storage). */
  NG_MAPS_BASE_URL: z
    .string()
    .default("http://maps.workadventure.localhost/ng-academy"),
  /** Public URL of the play front, used in magic-link emails. */
  NG_APP_URL: z.string().default("http://play.workadventure.localhost"),
  /** Magic-link lifetime in milliseconds (15 minutes). */
  MAGIC_LINK_TTL_MS: z.coerce.number().default(15 * 60 * 1000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type NgConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NgConfig {
  return configSchema.parse(env);
}

/** WA roles, mirrored by JWT tags (requirement 16). */
export const NG_ROLES = [
  "student",
  "parent",
  "teacher",
  "admin",
  "owner",
] as const;
export type NgRole = (typeof NG_ROLES)[number];
