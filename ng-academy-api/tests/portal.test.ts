/**
 * Phase 8 — parent portal & admin dashboard data layer:
 * rosters, achievements, teacher notes and the admin management endpoints,
 * each behind its role guard (requirements 11, 12, 13).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  childSessionToken,
  loginToken,
  seedSchool,
  type Seed,
} from "./seed.js";

let seed: Seed;
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

afterEach(async () => {
  await seed?.app.close();
});

describe("class rosters and child data for adults", () => {
  it("gives the teacher the roster, keeps children and strangers out", async () => {
    seed = await seedSchool();
    const teacherToken = await loginToken(seed, "hasiba@ng.example");
    const res = await seed.app.inject({
      method: "GET",
      url: `/ng/classes/${seed.classId}/students`,
      headers: bearer(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { students: { id: string; name: string }[] };
    expect(body.students.map((s) => s.id)).toEqual(["u-student"]);

    // a child never browses rosters (requirement 11)
    const studentToken = await childSessionToken(seed, "u-student");
    const child = await seed.app.inject({
      method: "GET",
      url: `/ng/classes/${seed.classId}/students`,
      headers: bearer(studentToken),
    });
    expect(child.statusCode).toBe(403);

    // a parent of a child in another class gets 403 for foreign classes
    const otherToken = await loginToken(seed, "parent2@ng.example");
    const foreign = await seed.app.inject({
      method: "GET",
      url: `/ng/classes/${seed.classId}/students`,
      headers: bearer(otherToken),
    });
    expect(foreign.statusCode).toBe(403);
  });

  it("lets the parent read their child's badges, not a foreign child's", async () => {
    seed = await seedSchool();
    await seed.repo.grantBadge({
      studentUserId: "u-student",
      badgeName: "بطل القراءة",
      reason: "",
      grantedBy: "u-teacher",
      at: new Date().toISOString(),
    });
    const parentToken = await loginToken(seed, "parent@ng.example");
    const own = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/achievements",
      headers: bearer(parentToken),
    });
    expect(own.statusCode).toBe(200);
    const body = own.json() as { achievements: { badgeName: string }[] };
    expect(body.achievements.map((a) => a.badgeName)).toEqual(["بطل القراءة"]);

    const otherToken = await loginToken(seed, "parent2@ng.example");
    const foreign = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/achievements",
      headers: bearer(otherToken),
    });
    expect(foreign.statusCode).toBe(403);
  });

  it("carries teacher notes to the parent, hides admin-only notes, blocks children", async () => {
    seed = await seedSchool();
    const teacherToken = await loginToken(seed, "hasiba@ng.example");
    const adminToken = await loginToken(seed, "admin@ng.example");

    const note = await seed.app.inject({
      method: "POST",
      url: "/ng/students/u-student/notes",
      headers: bearer(teacherToken),
      payload: { note: "ياسمين ساعدت زملاءها في درس اليوم 💙" },
    });
    expect(note.statusCode).toBe(201);
    const secret = await seed.app.inject({
      method: "POST",
      url: "/ng/students/u-student/notes",
      headers: bearer(adminToken),
      payload: { note: "ملاحظة إدارية داخلية", visibility: "admin" },
    });
    expect(secret.statusCode).toBe(201);

    const parentToken = await loginToken(seed, "parent@ng.example");
    const parentView = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/notes",
      headers: bearer(parentToken),
    });
    const notes = (parentView.json() as { notes: { note: string }[] }).notes;
    expect(notes).toHaveLength(1);
    expect(notes[0]?.note).toContain("ساعدت زملاءها");

    const adminView = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/notes",
      headers: bearer(adminToken),
    });
    expect((adminView.json() as { notes: unknown[] }).notes).toHaveLength(2);

    // the child never reads adult correspondence
    const studentToken = await childSessionToken(seed, "u-student");
    const childView = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/notes",
      headers: bearer(studentToken),
    });
    expect(childView.statusCode).toBe(403);

    // parents cannot write notes
    const write = await seed.app.inject({
      method: "POST",
      url: "/ng/students/u-student/notes",
      headers: bearer(parentToken),
      payload: { note: "محاولة" },
    });
    expect(write.statusCode).toBe(403);
  });
});

describe("admin management endpoints", () => {
  it("answers the dashboard overview with counts", async () => {
    seed = await seedSchool();
    const adminToken = await loginToken(seed, "admin@ng.example");
    const res = await seed.app.inject({
      method: "GET",
      url: "/ng/admin/overview",
      headers: bearer(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      students: 1,
      teachers: 1,
      classes: 1,
      activities: 2,
      rooms: 0,
    });
  });

  it("creates a course, binds a teacher and adds students to a new class", async () => {
    seed = await seedSchool();
    const adminToken = await loginToken(seed, "admin@ng.example");

    const course = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/courses",
      headers: bearer(adminToken),
      payload: { title: "الشطرنج للمبتدئين", subject: "chess" },
    });
    expect(course.statusCode).toBe(201);

    const newStudent = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/users",
      headers: bearer(adminToken),
      payload: {
        email: "karim@ng.example",
        role: "student",
        displayName: "كريم",
        parentUserId: seed.parent.id,
      },
    });
    expect(newStudent.statusCode).toBe(201);
    const karimId = (newStudent.json() as { id: string }).id;

    const klass = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/classes",
      headers: bearer(adminToken),
      payload: {
        name: "فصل الشطرنج",
        subject: "chess",
        teacherUserId: seed.teacher.id,
        studentUserIds: [karimId],
      },
    });
    expect(klass.statusCode).toBe(201);
    const classId = (klass.json() as { id: string }).id;

    // the teacher now sees the new class and its roster
    const teacherToken = await loginToken(seed, "hasiba@ng.example");
    const classes = await seed.app.inject({
      method: "GET",
      url: "/ng/classes",
      headers: bearer(teacherToken),
    });
    const names = (
      classes.json() as { classes: { name: string }[] }
    ).classes.map((c) => c.name);
    expect(names).toContain("فصل الشطرنج");

    const roster = await seed.app.inject({
      method: "GET",
      url: `/ng/classes/${classId}/students`,
      headers: bearer(teacherToken),
    });
    expect(
      (roster.json() as { students: { name: string }[] }).students.map(
        (s) => s.name,
      ),
    ).toEqual(["كريم"]);

    // and the parent sees the new child in /ng/me
    const parentToken = await loginToken(seed, "parent@ng.example");
    const me = await seed.app.inject({
      method: "GET",
      url: "/ng/me",
      headers: bearer(parentToken),
    });
    const children = (
      me.json() as { children: { name: string }[] }
    ).children.map((c) => c.name);
    expect(children).toEqual(["ياسمين", "كريم"]);

    // adding another student afterwards works too
    const add = await seed.app.inject({
      method: "POST",
      url: `/ng/admin/classes/${classId}/students`,
      headers: bearer(adminToken),
      payload: { studentUserIds: ["u-student"] },
    });
    expect(add.statusCode).toBe(200);
    expect((add.json() as { students: unknown[] }).students).toHaveLength(2);
  });

  it("rejects duplicates, bad teachers, and every non-admin caller", async () => {
    seed = await seedSchool();
    const adminToken = await loginToken(seed, "admin@ng.example");

    const dup = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/users",
      headers: bearer(adminToken),
      payload: {
        email: "hasiba@ng.example",
        role: "teacher",
        displayName: "نسخة",
      },
    });
    expect(dup.statusCode).toBe(409);

    const badTeacher = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/classes",
      headers: bearer(adminToken),
      payload: { name: "فصل", subject: "math", teacherUserId: seed.parent.id },
    });
    expect(badTeacher.statusCode).toBe(400);

    const parentToken = await loginToken(seed, "parent@ng.example");
    const studentToken = await childSessionToken(seed, "u-student");
    for (const token of [parentToken, studentToken]) {
      const res = await seed.app.inject({
        method: "GET",
        url: "/ng/admin/users",
        headers: bearer(token),
      });
      expect(res.statusCode).toBe(403);
    }
    const anon = await seed.app.inject({
      method: "GET",
      url: "/ng/admin/users",
    });
    expect(anon.statusCode).toBe(403);
  });

  it("manages activities and world zones", async () => {
    seed = await seedSchool();
    const adminToken = await loginToken(seed, "admin@ng.example");

    const activity = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/activities",
      headers: bearer(adminToken),
      payload: { title: "تحدي الأسبوع: علم", kind: "weekly", points: 3 },
    });
    expect(activity.statusCode).toBe(201);
    const list = await seed.app.inject({
      method: "GET",
      url: "/ng/activities",
      headers: bearer(adminToken),
    });
    expect((list.json() as { activities: unknown[] }).activities).toHaveLength(
      3,
    );

    const room = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/rooms",
      headers: bearer(adminToken),
      payload: {
        name: "المكتبة",
        wamUrl: "http://maps.workadventure.localhost/ng-academy/library.wam",
        purpose: "قراءة صامتة",
      },
    });
    expect(room.statusCode).toBe(201);
    const rooms = await seed.app.inject({
      method: "GET",
      url: "/ng/admin/rooms",
      headers: bearer(adminToken),
    });
    expect(
      (rooms.json() as { rooms: { name: string }[] }).rooms.map((r) => r.name),
    ).toEqual(["المكتبة"]);
  });
});

describe("serving the built portal (phase 8)", () => {
  it("hosts the static portal under /portal/ when PORTAL_DIST is set", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { loadConfig } = await import("../src/config.js");
    const { MemoryRepository } = await import("../src/db/memory.js");
    const { CapturingEmailTransport } =
      await import("../src/auth/magicLink.js");
    const { buildApp } = await import("../src/app.js");

    const dir = mkdtempSync(join(tmpdir(), "ng-portal-"));
    writeFileSync(
      join(dir, "index.html"),
      "<!doctype html><title>portal</title>",
    );
    const app = await buildApp({
      config: loadConfig({
        NODE_ENV: "test",
        PORTAL_DIST: dir,
      } as NodeJS.ProcessEnv),
      repo: new MemoryRepository(),
      email: new CapturingEmailTransport(),
    });
    const res = await app.inject({ method: "GET", url: "/portal/index.html" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("portal");
    // the JSON API keeps working next to the static files
    expect(
      (await app.inject({ method: "GET", url: "/healthz" })).statusCode,
    ).toBe(200);
    await app.close();
  });
});
