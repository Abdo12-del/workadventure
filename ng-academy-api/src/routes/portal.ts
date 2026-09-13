/**
 * NG Academy — أكاديمية الجيل الجديد
 * Phase 8 — the data layer behind the parent portal and the admin dashboard
 * (requirements 12 & 13). Traditional read/write JSON: tables and stats live
 * in the portal UI, never in the child's world.
 *
 * Access rules:
 *  - parents: their own children only (attendance, badges, progress, notes, classes);
 *  - teachers: their classes' rosters, notes and encouragement tools;
 *  - admin/owner: user/course/class/activity/zone management + overview stats.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { NG_ROLES } from "../config.js";
import { authenticate, canAccessStudent, requireRole } from "./access.js";

export function registerPortalRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  const { repo } = deps;

  /* ---------------- shared: a class roster (teacher tools, admin) --------- */

  app.get("/ng/classes/:classId/students", async (req, reply) => {
    // Adults only (requirement 11): children never browse rosters.
    const auth = requireRole(await authenticate(req, deps), [
      "teacher",
      "parent",
      "admin",
      "owner",
    ]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const params = z.object({ classId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "bad params" });
    const classes = await repo.listClassesForUser(auth);
    if (!classes.some((c) => c.id === params.data.classId))
      return reply.code(403).send({ error: "forbidden" });
    const students = await repo.listClassStudents(params.data.classId);
    return reply.send({
      students: students.map((s) => ({ id: s.id, name: s.displayName })),
    });
  });

  /* ---------------- parent + teacher: badges & notes per child ------------ */

  app.get("/ng/students/:studentId/achievements", async (req, reply) => {
    const auth = await authenticate(req, deps);
    if (!auth) return reply.code(401).send({ error: "unauthenticated" });
    const params = z.object({ studentId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "bad params" });
    if (!(await canAccessStudent(deps, auth.user, params.data.studentId)))
      return reply.code(403).send({ error: "forbidden" });
    return reply.send({
      achievements: await repo.listAchievements(params.data.studentId),
    });
  });

  app.get("/ng/students/:studentId/notes", async (req, reply) => {
    // Notes are adult correspondence (requirement 12): the child never reads them.
    const auth = requireRole(await authenticate(req, deps), [
      "parent",
      "teacher",
      "admin",
      "owner",
    ]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const params = z.object({ studentId: z.string() }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "bad params" });
    if (!(await canAccessStudent(deps, auth, params.data.studentId)))
      return reply.code(403).send({ error: "forbidden" });
    const notes = await repo.listNotes(params.data.studentId);
    // Admin-only notes never reach a parent.
    const visible =
      auth.role === "admin" || auth.role === "owner" || auth.role === "teacher"
        ? notes
        : notes.filter((n) => n.visibility === "parent");
    return reply.send({ notes: visible });
  });

  app.post("/ng/students/:studentId/notes", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [
      "teacher",
      "admin",
      "owner",
    ]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const params = z.object({ studentId: z.string() }).safeParse(req.params);
    const body = z
      .object({
        note: z.string().min(1),
        visibility: z.enum(["parent", "admin"]).default("parent"),
      })
      .safeParse(req.body);
    if (!params.success || !body.success)
      return reply.code(400).send({ error: "bad payload" });
    const student = await repo.getUserById(params.data.studentId);
    if (!student || student.role !== "student")
      return reply.code(404).send({ error: "unknown_child" });
    const row = await repo.addNote({
      studentUserId: params.data.studentId,
      teacherUserId: auth.id,
      note: body.data.note,
      visibility: body.data.visibility,
      at: new Date().toISOString(),
    });
    return reply.code(201).send(row);
  });

  /* ---------------- admin / owner: management ----------------------------- */

  const ADMIN = ["admin", "owner"] as const;

  app.get("/ng/admin/overview", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const [students, teachers, classes, activities, rooms] = await Promise.all([
      repo.listUsers("student"),
      repo.listUsers("teacher"),
      repo.listClassesForUser(auth),
      repo.listActivities(),
      repo.listVirtualRooms(),
    ]);
    return reply.send({
      students: students.length,
      teachers: teachers.length,
      classes: classes.length,
      activities: activities.length,
      rooms: rooms.length,
    });
  });

  app.get("/ng/admin/users", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const query = z
      .object({ role: z.enum(NG_ROLES).optional() })
      .safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "bad params" });
    const users = await repo.listUsers(query.data.role);
    return reply.send({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.displayName,
        createdAt: u.createdAt,
      })),
    });
  });

  app.post("/ng/admin/users", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(NG_ROLES),
        displayName: z.string().min(1),
        // For a student: the parent this child belongs to (magic links always
        // go to the parent's email — children never handle credentials).
        parentUserId: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad payload" });
    if (body.data.parentUserId && body.data.role !== "student")
      return reply
        .code(400)
        .send({ error: "parentUserId is only for students" });
    try {
      const user = await repo.createUser({
        email: body.data.email,
        role: body.data.role,
        displayName: body.data.displayName,
        createdAt: new Date().toISOString(),
      });
      if (body.data.parentUserId)
        await repo.linkChild(body.data.parentUserId, user.id);
      return reply.code(201).send(user);
    } catch {
      return reply.code(409).send({ error: "duplicate email" });
    }
  });

  app.post("/ng/admin/courses", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const body = z
      .object({ title: z.string().min(1), subject: z.string().min(1) })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad payload" });
    return reply.code(201).send(await repo.createCourse(body.data));
  });

  /** Acceptance gate of phase 8: create a class, bind its teacher, add students. */
  app.post("/ng/admin/classes", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const body = z
      .object({
        name: z.string().min(1),
        subject: z.string().min(1),
        teacherUserId: z.string().optional(),
        studentUserIds: z.array(z.string()).default([]),
        roomUrl: z.string().default(""),
        livekitRoom: z.string().default(""),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad payload" });
    if (body.data.teacherUserId) {
      const teacher = await repo.getUserById(body.data.teacherUserId);
      if (!teacher || teacher.role !== "teacher")
        return reply
          .code(400)
          .send({ error: "teacherUserId is not a teacher" });
    }
    const klass = await repo.createClass({
      name: body.data.name,
      subject: body.data.subject,
      teacherUserId: body.data.teacherUserId,
      studentUserIds: body.data.studentUserIds,
      roomUrl: body.data.roomUrl || `ng-academy:${body.data.subject}`,
      livekitRoom:
        body.data.livekitRoom || `ng-${body.data.subject}-${Date.now()}`,
    });
    return reply.code(201).send(klass);
  });

  app.post("/ng/admin/classes/:classId/students", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const params = z.object({ classId: z.string() }).safeParse(req.params);
    const body = z
      .object({ studentUserIds: z.array(z.string()).min(1) })
      .safeParse(req.body);
    if (!params.success || !body.success)
      return reply.code(400).send({ error: "bad payload" });
    try {
      await repo.addClassStudents(
        params.data.classId,
        body.data.studentUserIds,
      );
    } catch {
      return reply.code(404).send({ error: "unknown class" });
    }
    return reply.code(200).send({
      students: (await repo.listClassStudents(params.data.classId)).map(
        (s) => ({
          id: s.id,
          name: s.displayName,
        }),
      ),
    });
  });

  app.post("/ng/admin/activities", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const body = z
      .object({
        title: z.string().min(1),
        kind: z.enum(["daily", "weekly", "micro"]),
        points: z.number().int().min(1).max(100).default(1),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad payload" });
    return reply.code(201).send(await repo.createActivity(body.data));
  });

  app.get("/ng/admin/rooms", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    return reply.send({ rooms: await repo.listVirtualRooms() });
  });

  app.post("/ng/admin/rooms", async (req, reply) => {
    const auth = requireRole(await authenticate(req, deps), [...ADMIN]);
    if (!auth) return reply.code(403).send({ error: "forbidden" });
    const body = z
      .object({
        name: z.string().min(1),
        wamUrl: z.string().min(1),
        purpose: z.string().default(""),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "bad payload" });
    return reply.code(201).send(await repo.createVirtualRoom(body.data));
  });
}
