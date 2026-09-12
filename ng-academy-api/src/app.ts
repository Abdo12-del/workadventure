/**
 * NG Academy — أكاديمية الجيل الجديد
 * Fastify application factory: WA Admin API contract + NG auth + school routes.
 * The repository and the email transport are injected so tests can run fully
 * in-memory (no Postgres, no SMTP) while production wires PgRepository + mail.
 */
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { NgConfig } from "./config.js";
import type { Repository } from "./db/types.js";
import type { EmailTransport } from "./auth/magicLink.js";
import { registerAdminApiRoutes } from "./routes/adminApi.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSchoolRoutes } from "./routes/school.js";

export interface AppDeps {
  config: NgConfig;
  repo: Repository;
  email: EmailTransport;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.config.NODE_ENV !== "test" });

  app.get("/healthz", async () => ({
    status: "ok",
    service: "ng-academy-api",
  }));

  registerAdminApiRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerSchoolRoutes(app, deps);

  return app;
}
