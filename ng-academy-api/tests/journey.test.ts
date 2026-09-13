/**
 * NG Academy — أكاديمية الجيل الجديد
 * Phase 10: the whole school-life journey in one integration test, at the data
 * layer (requirement 18): admin provisions the school → parent logs in with a
 * magic link → parent opens the child's world session → teacher takes the
 * class, records silent attendance, completes an activity and writes a note →
 * the child's celebration feed fills up → the parent portal sees everything,
 * and every child-safety wall holds along the way.
 *
 * The in-world half of the journey (Gino, the gathering line, the classroom
 * door) is covered by the play front unit tests and by
 * tests/tests/ng_academy_journey.spec.ts on the full stack.
 */
import { afterEach, describe, expect, it } from "vitest";
import { loginToken, seedSchool, type Seed } from "./seed.js";

let seed: Seed;
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

afterEach(async () => {
  await seed?.app.close();
});

describe("the full NG Academy journey (phase 10)", () => {
  it("provision → magic link → child session → lesson → badge → celebration → parent report", async () => {
    seed = await seedSchool();

    /* ---- 1. The admin provisions a new family and a new class ------------- */
    const adminToken = await loginToken(seed, "admin@ng.example");

    const parentRes = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/users",
      headers: bearer(adminToken),
      payload: {
        email: "salma@ng.example",
        role: "parent",
        displayName: "أم سلمان",
      },
    });
    expect(parentRes.statusCode).toBe(201);
    const parentId = (parentRes.json() as { id: string }).id;

    const childRes = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/users",
      headers: bearer(adminToken),
      payload: {
        email: "salman@ng.example",
        role: "student",
        displayName: "سلمان",
        parentUserId: parentId,
      },
    });
    expect(childRes.statusCode).toBe(201);
    const childId = (childRes.json() as { id: string }).id;

    const classRes = await seed.app.inject({
      method: "POST",
      url: "/ng/admin/classes",
      headers: bearer(adminToken),
      payload: {
        name: "فصل العلوم",
        subject: "science",
        teacherUserId: seed.teacher.id,
        studentUserIds: [childId],
      },
    });
    expect(classRes.statusCode).toBe(201);
    const scienceClassId = (classRes.json() as { id: string }).id;

    /* ---- 2. The parent logs in with a magic link (never the child) -------- */
    const parentToken = await loginToken(seed, "salma@ng.example");
    const me = await seed.app.inject({
      method: "GET",
      url: "/ng/me",
      headers: bearer(parentToken),
    });
    expect(me.statusCode).toBe(200);
    const meBody = me.json() as { role: string; children: { id: string; name: string }[] };
    expect(meBody.role).toBe("parent");
    expect(meBody.children.map((c) => c.name)).toEqual(["سلمان"]);

    /* ---- 3. The parent opens the school world for the child --------------- */
    const session = await seed.app.inject({
      method: "POST",
      url: `/ng/children/${childId}/session`,
      headers: bearer(parentToken),
    });
    expect(session.statusCode).toBe(200);
    const childToken = (session.json() as { token: string }).token;
    expect(childToken).toBeTruthy();
    // the child's JWT carries the student tag used by the WA Admin API
    const childMe = await seed.app.inject({
      method: "GET",
      url: "/ng/me",
      headers: bearer(childToken),
    });
    expect((childMe.json() as { role: string; tags: string[] }).tags).toEqual(["ng-student"]);

    /* ---- 4. Lesson time: silent attendance + the class the child sees ----- */
    const teacherToken = await loginToken(seed, "hasiba@ng.example");

    const childClasses = await seed.app.inject({
      method: "GET",
      url: "/ng/classes",
      headers: bearer(childToken),
    });
    const classNames = (childClasses.json() as { classes: { name: string }[] }).classes.map((c) => c.name);
    expect(classNames).toEqual(["فصل العلوم"]);

    const enter = await seed.app.inject({
      method: "POST",
      url: `/ng/classes/${scienceClassId}/attendance`,
      headers: bearer(teacherToken),
      payload: { studentUserId: childId, kind: "enter" },
    });
    expect(enter.statusCode).toBe(201);

    /* ---- 5. Encouragement: an activity completed → badge + points --------- */
    const done = await seed.app.inject({
      method: "POST",
      url: "/ng/activities/a-micro-read/complete",
      headers: bearer(teacherToken),
      payload: { studentUserId: childId },
    });
    expect(done.statusCode).toBe(201);
    const doneBody = done.json() as { achievement: { badgeName: string }; points: number };
    expect(doneBody.achievement.badgeName).toBe("قراءة قصة قصيرة");
    expect(doneBody.points).toBe(1);

    /* ---- 6. A note from the teacher to the parent ------------------------- */
    const note = await seed.app.inject({
      method: "POST",
      url: `/ng/students/${childId}/notes`,
      headers: bearer(teacherToken),
      payload: { note: "سلمان قرأ قصته الأولى اليوم 📖" },
    });
    expect(note.statusCode).toBe(201);

    /* ---- 7. The child's celebration feed (what Gino polls in-world) ------- */
    const feed = await seed.app.inject({
      method: "GET",
      url: "/ng/my/achievements",
      headers: bearer(childToken),
    });
    const feedBody = feed.json() as {
      achievements: { badgeName: string }[];
      progress: { metric: string; value: number }[];
    };
    expect(feedBody.achievements.map((a) => a.badgeName)).toEqual(["قراءة قصة قصيرة"]);
    expect(feedBody.progress.find((p) => p.metric === "points")?.value).toBe(1);

    /* ---- 8. The parent portal sees the whole picture ---------------------- */
    const [attRes, achRes, notesRes, progRes] = await Promise.all([
      seed.app.inject({ method: "GET", url: `/ng/students/${childId}/attendance`, headers: bearer(parentToken) }),
      seed.app.inject({ method: "GET", url: `/ng/students/${childId}/achievements`, headers: bearer(parentToken) }),
      seed.app.inject({ method: "GET", url: `/ng/students/${childId}/notes`, headers: bearer(parentToken) }),
      seed.app.inject({ method: "GET", url: `/ng/students/${childId}/progress`, headers: bearer(parentToken) }),
    ]);
    const attendance = attRes.json() as { attendance: { kind: string }[] };
    const achievements = achRes.json() as { achievements: unknown[] };
    const notes = notesRes.json() as { notes: { note: string }[] };
    const progress = progRes.json() as { progress: { metric: string; value: number }[] };
    expect(attendance.attendance.map((a) => a.kind)).toEqual(["enter"]);
    expect(achievements.achievements).toHaveLength(1);
    expect(notes.notes[0]?.note).toContain("قرأ قصته الأولى");
    expect(progress.progress.find((p) => p.metric === "points")?.value).toBe(1);

    /* ---- 9. The safety walls hold all along the journey ------------------- */
    // the child cannot read adult correspondence…
    const childNotes = await seed.app.inject({
      method: "GET",
      url: `/ng/students/${childId}/notes`,
      headers: bearer(childToken),
    });
    expect(childNotes.statusCode).toBe(403);
    // …cannot browse rosters, write attendance, grant badges or self-complete activities…
    const roster = await seed.app.inject({
      method: "GET",
      url: `/ng/classes/${scienceClassId}/students`,
      headers: bearer(childToken),
    });
    expect(roster.statusCode).toBe(403);
    for (const attempt of [
      seed.app.inject({
        method: "POST",
        url: `/ng/classes/${scienceClassId}/attendance`,
        headers: bearer(childToken),
        payload: { studentUserId: childId, kind: "enter" },
      }),
      seed.app.inject({
        method: "POST",
        url: `/ng/students/${childId}/badges`,
        headers: bearer(childToken),
        payload: { badgeName: "شارة ذاتية" },
      }),
      seed.app.inject({
        method: "POST",
        url: "/ng/activities/a-micro-read/complete",
        headers: bearer(childToken),
        payload: { studentUserId: childId },
      }),
      seed.app.inject({ method: "GET", url: "/ng/admin/users", headers: bearer(childToken) }),
    ]) {
      expect((await attempt).statusCode).toBe(403);
    }
    // …and a foreign parent sees nothing of this child.
    const strangerToken = await loginToken(seed, "parent2@ng.example");
    const stranger = await seed.app.inject({
      method: "GET",
      url: `/ng/students/${childId}/achievements`,
      headers: bearer(strangerToken),
    });
    expect(stranger.statusCode).toBe(403);
  });
});
