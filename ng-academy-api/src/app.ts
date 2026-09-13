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
import { registerActivitiesRoutes } from "./routes/activities.js";
import { registerPortalRoutes } from "./routes/portal.js";

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

  // The child's browser talks to this API cross-origin in dev (WA front on :8080),
  // and the parent portal (phase 8) will too: allow simple preflighted requests.
  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") {
      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        .header("Access-Control-Allow-Headers", "Authorization,Content-Type")
        .header("Access-Control-Max-Age", "86400")
        .code(204);
      return reply.send();
    }
  });
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
  });

  // Phase 8: the parent/admin portal is a static Svelte build; serving it from
  // the API keeps one origin (no extra CORS surface) in production.
  if (deps.config.PORTAL_DIST) {
    const fastifyStatic = (await import("@fastify/static")).default;
    await app.register(fastifyStatic, {
      root: deps.config.PORTAL_DIST,
      prefix: "/portal/",
    });
    // Preview-friendliness: opening the API root lands on the portal instead
    // of a bare 404 (single-origin design: API + portal share one host).
    app.get("/", async (_req, reply) => reply.redirect("/portal/"));
  }

  registerAdminApiRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerSchoolRoutes(app, deps);
  registerActivitiesRoutes(app, deps);
  registerPortalRoutes(app, deps);

  return app;
}
