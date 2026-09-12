/**
 * NG Academy — أكاديمية الجيل الجديد
 * School routes (classes, schedules, attendance, badges, progress) with strict
 * role guards. Children (students) never see attendance or other children's data;
 * parents only ever see their own children (requirements 10, 11, 12).
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import type { NgRole } from "../config.js";
import { verifyJwt, type NgJwtPayload } from "../auth/jwt.js";
import type { UserRow } from "../db/types.js";

async function authenticate(
  req: FastifyRequest,
  deps: AppDeps,
): Promise<{ user: UserRow; jwt: NgJwtPayload } | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const payload = verifyJwt(
    header.slice("Bearer ".length),
    deps.config.JWT_SECRET,
  );
  if (!payload) return null;
  const user = await deps.repo.getUserById(payload.sub);
  if (!user) return null;
  return { user, jwt: payload };
}

function requireRole(
  auth: { user: UserRow } | null,
  roles: NgRole[],
): UserRow | null {
  if (!auth) return null;
  return roles.includes(auth.user.role) ? auth.user : null;
}

export function registerSchoolRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  const { repo } = deps;

  /** Classes visible to the caller, scoped by role. */
  app.get("/ng/classes", async (req, reply) => {
    const auth = await authenticate(req, deps);
    if (!auth) return reply.code(401).send({ error: "unauthenticated" });
    const classes = await repo.listClassesForUser(auth.user);
    const schedules = await repo.listSchedules(classes.map((c) => c.id));
    return reply.send({ classes, schedules });
  });

  /** Attendance of one student: parent (of that child), teacher, admin, owner only. */
  app.get("/ng/students/:studentId/attendance", async (req, reply) => {
    const auth = await authenticate(req, deps);
    const params = z.object({ studentId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "bad params" });
    const studentId = params.data.studentId;
    if (!auth) return reply.code(401).send({ error: "unauthenticated" });

    const allowed = await canAccessStudent(deps, auth.user, studentId);
    if (!allowed) return reply.code(403).send({ error: "forbidden" });
    return reply.send({ attendance: await repo.listAttendance(studentId) });
  });

  /** Teachers/admins record attendance or participation (the child UI never calls this). */
  app.post("/ng/classes/:classId/attendance", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [
      "teacher",
      "admin",
      "owner",
    ]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const params = z.object({ classId: z.string() }).safeParse(req.params);
    const body = z
      .object({
        studentUserId: z.string(),
        kind: z.enum(["enter", "exit", "participation"]),
        at: z.string().optional(),
      })
      .safeParse(req.body);
    if (!params.success || !body.success)
      return reply.code(400).send({ error: "bad payload" });
    const row = await repo.recordAttendance({
      studentUserId: body.data.studentUserId,
      classId: params.data.classId,
      kind: body.data.kind,
      at: body.data.at ?? new Date().toISOString(),
      recordedBy: auth.id,
    });
    return reply.code(201).send(row);
  });

  /** Encouragement badges (requirement 9): granted by teachers/admins, never ranked. */
  app.post("/ng/students/:studentId/badges", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [
      "teacher",
      "admin",
      "owner",
    ]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const params = z.object({ studentId: z.string() }).safeParse(req.params);
    const body = z
      .object({ badgeName: z.string().min(1), reason: z.string().default("") })
      .safeParse(req.body);
    if (!params.success || !body.success)
      return reply.code(400).send({ error: "bad payload" });
    const row = await repo.grantBadge({
      studentUserId: params.data.studentId,
      badgeName: body.data.badgeName,
      reason: body.data.reason,
      grantedBy: auth.id,
      at: new Date().toISOString(),
    });
    return reply.code(201).send(row);
  });

  /** Achievements + progress of one student, for parent/teacher/admin portals. */
  app.get("/ng/students/:studentId/progress", async (req, reply) => {
    const auth = await authenticate(req, deps);
    const params = z.object({ studentId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "bad params" });
    if (!auth) return reply.code(401).send({ error: "unauthenticated" });
    const allowed = await canAccessStudent(
      deps,
      auth.user,
      params.data.studentId,
    );
    if (!allowed) return reply.code(403).send({ error: "forbidden" });
    const [achievements, progress] = await Promise.all([
      repo.listAchievements(params.data.studentId),
      repo.listProgress(params.data.studentId),
    ]);
    return reply.send({ achievements, progress });
  });
}

/** Parent: own children only. Teacher: own classes' students (via class list). Admin/owner: all. */
async function canAccessStudent(
  deps: AppDeps,
  caller: UserRow,
  studentId: string,
): Promise<boolean> {
  if (caller.role === "admin" || caller.role === "owner") return true;
  if (caller.id === studentId) return true; // a student may read their own progress
  if (caller.role === "parent") {
    const children = await deps.repo.listChildren(caller.id);
    return children.some((c) => c.id === studentId);
  }
  if (caller.role === "teacher") {
    const classes = await deps.repo.listClassesForUser(caller);
    for (const klass of classes) {
      const attendance = await deps.repo.listAttendance(studentId);
      if (attendance.some((a) => a.classId === klass.id)) return true;
    }
    return false;
  }
  return false;
}
