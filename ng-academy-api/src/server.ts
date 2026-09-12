/**
 * NG Academy — أكاديمية الجيل الجديد
 * Production entry point: Postgres repository + log email transport
 * (swap LogEmailTransport for an SMTP/SES transport when deploying).
 */
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { LogEmailTransport } from "./auth/magicLink.js";
import { PgRepository } from "./db/pg.js";

const config = loadConfig();
if (!config.DATABASE_URL) {
  console.error("ng-academy-api: DATABASE_URL is required.");
  process.exit(1);
}

const repo = await PgRepository.connect(config.DATABASE_URL);
const app = await buildApp({ config, repo, email: new LogEmailTransport() });

await app.listen({ port: config.PORT, host: "0.0.0.0" });
console.info(`ng-academy-api listening on :${config.PORT}`);
