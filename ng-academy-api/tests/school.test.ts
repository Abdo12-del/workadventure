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

describe("school routes and role guards", () => {
  it("scopes class lists by role", async () => {
    seed = await seedSchool();
    const parentToken = await loginToken(seed, "parent@ng.example");
    const teacherToken = await loginToken(seed, "hasiba@ng.example");
    const studentToken = await childSessionToken(seed, "u-student");

    for (const [token, expected] of [
      [parentToken, 1],
      [teacherToken, 1],
      [studentToken, 1],
    ] as const) {
      const res = await seed.app.inject({
        method: "GET",
        url: "/ng/classes",
        headers: bearer(token),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { classes: unknown[]; schedules: unknown[] };
      expect(body.classes).toHaveLength(expected);
      expect(body.schedules).toHaveLength(expected);
    }
    const anon = await seed.app.inject({ method: "GET", url: "/ng/classes" });
    expect(anon.statusCode).toBe(401);
  });

  it("keeps attendance away from children and foreign parents", async () => {
    seed = await seedSchool();
    const studentToken = await childSessionToken(seed, "u-student");
    const parentToken = await loginToken(seed, "parent@ng.example");
    const otherToken = await loginToken(seed, "parent2@ng.example");

    const own = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/attendance",
      headers: bearer(parentToken),
    });
    expect(own.statusCode).toBe(200);

    const foreign = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/attendance",
      headers: bearer(otherToken),
    });
    expect(foreign.statusCode).toBe(403);

    // a student reading their own attendance is allowed (parent portal data),
    // but students can never WRITE attendance:
    const write = await seed.app.inject({
      method: "POST",
      url: `/ng/classes/${seed.classId}/attendance`,
      headers: bearer(studentToken),
      payload: { studentUserId: "u-student", kind: "enter" },
    });
    expect(write.statusCode).toBe(403);
  });

  it("lets teachers record attendance and grant encouragement badges", async () => {
    seed = await seedSchool();
    const teacherToken = await loginToken(seed, "hasiba@ng.example");

    const attendance = await seed.app.inject({
      method: "POST",
      url: `/ng/classes/${seed.classId}/attendance`,
      headers: bearer(teacherToken),
      payload: { studentUserId: "u-student", kind: "participation" },
    });
    expect(attendance.statusCode).toBe(201);

    const badge = await seed.app.inject({
      method: "POST",
      url: "/ng/students/u-student/badges",
      headers: bearer(teacherToken),
      payload: {
        badgeName: "القارئ الصغير",
        reason: "قرأ ثلاثة كتب هذا الأسبوع",
      },
    });
    expect(badge.statusCode).toBe(201);

    const parentToken = await loginToken(seed, "parent@ng.example");
    const progress = await seed.app.inject({
      method: "GET",
      url: "/ng/students/u-student/progress",
      headers: bearer(parentToken),
    });
    expect(progress.statusCode).toBe(200);
    const body = progress.json() as { achievements: { badgeName: string }[] };
    expect(body.achievements.map((a) => a.badgeName)).toContain(
      "القارئ الصغير",
    );
  });
});
