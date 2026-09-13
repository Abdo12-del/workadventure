/**
 * NG Academy — أكاديمية الجيل الجديد
 * Magic-link authentication (parent email) + JWT issuing.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { signJwt, verifyJwt } from "../auth/jwt.js";
import { requestMagicLink, verifyMagicLink } from "../auth/magicLink.js";
import { ngBearerToken } from "./access.js";

const JWT_TTL_MS = 12 * 60 * 60 * 1000; // a school day

export function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { config, repo, email } = deps;

  /** Always 202: never reveal which emails exist (child safety). */
  app.post("/ng/auth/magic-link", async (req, reply) => {
    const body = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "بريد غير صالح" });
    }
    await requestMagicLink(
      repo,
      email,
      body.data.email,
      config.NG_PORTAL_URL,
      config.MAGIC_LINK_TTL_MS,
    );
    return reply
      .code(202)
      .send({ ok: true, message: "إن كان البريد مسجلًا فسيصله رابط الدخول." });
  });

  app.post("/ng/auth/magic-link/verify", async (req, reply) => {
    const body = z.object({ token: z.string().min(8) }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "رمز غير صالح" });
    }
    const emailOfToken = await verifyMagicLink(repo, body.data.token);
    if (!emailOfToken) {
      return reply.code(401).send({ error: "الرابط منتهٍ أو مستخدم." });
    }
    const user = await repo.getUserByEmail(emailOfToken);
    if (!user) {
      return reply.code(401).send({ error: "حساب غير موجود." });
    }
    const token = signJwt(
      {
        sub: user.id,
        email: user.email,
        name: user.displayName,
        role: user.role,
      },
      config.JWT_SECRET,
      JWT_TTL_MS,
    );
    return reply.send({
      token,
      role: user.role,
      name: user.displayName,
      redirect: "/",
    });
  });

  app.get("/ng/config", async () => ({
    worldUrl: config.NG_APP_URL,
  }));

  app.get("/ng/me", async (req, reply) => {
    const raw = ngBearerToken(req);
    if (!raw) {
      return reply.code(401).send({ error: "non-authenticated" });
    }
    const payload = verifyJwt(raw, config.JWT_SECRET);
    if (!payload) {
      return reply.code(401).send({ error: "token invalid" });
    }
    const user = await repo.getUserById(payload.sub);
    if (!user) {
      return reply.code(404).send({ error: "unknown user" });
    }
    const children =
      user.role === "parent" ? await repo.listChildren(user.id) : [];
    return reply.send({
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
      tags: payload.tags,
      children: children.map((c) => ({ id: c.id, name: c.displayName })),
    });
  });

  /**
   * Child session: the parent (already authenticated by magic link) opens the
   * school for one of their children from the parent portal. Children never
   * handle emails, passwords or magic links themselves.
   */
  app.post("/ng/children/:childId/session", async (req, reply) => {
    const raw = ngBearerToken(req);
    if (!raw) return reply.code(401).send({ error: "unauthenticated" });
    const payload = verifyJwt(raw, config.JWT_SECRET);
    if (!payload || payload.role !== "parent")
      return reply.code(403).send({ error: "parents only" });
    const params = z.object({ childId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "bad params" });
    const children = await repo.listChildren(payload.sub);
    const child = children.find((c) => c.id === params.data.childId);
    if (!child) return reply.code(403).send({ error: "not your child" });
    const token = signJwt(
      {
        sub: child.id,
        email: child.email,
        name: child.displayName,
        role: child.role,
      },
      config.JWT_SECRET,
      JWT_TTL_MS,
    );
    return reply.send({
      token,
      role: child.role,
      name: child.displayName,
      redirect: "/school",
    });
  });
}
