/**
 * NG Academy — أكاديمية الجيل الجديد
 * Activities, badges and achievements (requirement 9): small encouraging wins
 * (daily / weekly / micro tasks) granted by teachers — never by competition
 * between children, and never exposed as a ranking.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { authenticate, requireRole } from "./access.js";

export function registerActivitiesRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  const { repo } = deps;

  /** The catalogue of small tasks a teacher can hand out (any authenticated user may read it). */
  app.get("/ng/activities", async (req, reply) => {
    const auth = await authenticate(req, deps);
    if (!auth) return reply.code(401).send({ error: "unauthenticated" });
    return reply.send({ activities: await repo.listActivities() });
  });

  /** A teacher/admin marks an activity as done: badge + points for one child. */
  app.post("/ng/activities/:activityId/complete", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [
      "teacher",
      "admin",
      "owner",
    ]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const params = z.object({ activityId: z.string() }).safeParse(req.params);
    const body = z.object({ studentUserId: z.string() }).safeParse(req.body);
    if (!params.success || !body.success)
      return reply.code(400).send({ error: "bad payload" });

    const student = await repo.getUserById(body.data.studentUserId);
    if (!student || student.role !== "student")
      return reply.code(404).send({ error: "unknown_child" });

    try {
      const result = await repo.completeActivity({
        activityId: params.data.activityId,
        studentUserId: body.data.studentUserId,
        byUserId: auth.id,
        at: new Date().toISOString(),
      });
      return reply.code(201).send(result);
    } catch {
      return reply.code(404).send({ error: "unknown_activity" });
    }
  });

  /** The child's own celebration feed — their badges only, never a leaderboard. */
  app.get("/ng/my/achievements", async (req, reply) => {
    const auth = await authenticate(req, deps);
    if (!auth) return reply.code(401).send({ error: "unauthenticated" });
    const [achievements, progress] = await Promise.all([
      repo.listAchievements(auth.user.id),
      repo.listProgress(auth.user.id),
    ]);
    return reply.send({ achievements, progress });
  });
}
