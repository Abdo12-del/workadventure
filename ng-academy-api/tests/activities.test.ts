/**
 * Phase 7 — activities, badges and achievements (requirement 9):
 * teachers hand out small encouraging wins; children only ever see their own.
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

describe("activities catalogue and completion", () => {
  it("lists activities for any authenticated user, never for anonymous", async () => {
    seed = await seedSchool();
    const res = await seed.app.inject({
      method: "GET",
      url: "/ng/activities",
      headers: bearer(await loginToken(seed, "hasiba@ng.example")),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      activities: { id: string; kind: string; points: number }[];
    };
    expect(body.activities.map((a) => a.id)).toEqual([
      "a-daily-math",
      "a-micro-read",
    ]);
    expect(
      (await seed.app.inject({ method: "GET", url: "/ng/activities" }))
        .statusCode,
    ).toBe(401);
  });

  it("teacher completion grants a badge and stacks points encouragingly", async () => {
    seed = await seedSchool();
    const teacherToken = await loginToken(seed, "hasiba@ng.example");

    const first = await seed.app.inject({
      method: "POST",
      url: "/ng/activities/a-daily-math/complete",
      headers: bearer(teacherToken),
      payload: { studentUserId: "u-student" },
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json() as {
      achievement: { badgeName: string; grantedBy?: string };
      points: number;
    };
    expect(firstBody.achievement.badgeName).toBe("تمارين الرياضيات اليومية");
    expect(firstBody.achievement.grantedBy).toBe("u-teacher");
    expect(firstBody.points).toBe(2);

    const second = await seed.app.inject({
      method: "POST",
      url: "/ng/activities/a-micro-read/complete",
      headers: bearer(teacherToken),
      payload: { studentUserId: "u-student" },
    });
    expect((second.json() as { points: number }).points).toBe(3);
  });

  it("children and parents can never complete activities; bad ids are rejected", async () => {
    seed = await seedSchool();
    const studentToken = await childSessionToken(seed, "u-student");
    const parentToken = await loginToken(seed, "parent@ng.example");

    for (const token of [studentToken, parentToken]) {
      const res = await seed.app.inject({
        method: "POST",
        url: "/ng/activities/a-daily-math/complete",
        headers: bearer(token),
        payload: { studentUserId: "u-student" },
      });
      expect(res.statusCode).toBe(403);
    }

    const teacherToken = await loginToken(seed, "hasiba@ng.example");
    const unknownChild = await seed.app.inject({
      method: "POST",
      url: "/ng/activities/a-daily-math/complete",
      headers: bearer(teacherToken),
      payload: { studentUserId: "u-parent" }, // a parent is not a child
    });
    expect(unknownChild.statusCode).toBe(404);
    const unknownActivity = await seed.app.inject({
      method: "POST",
      url: "/ng/activities/nope/complete",
      headers: bearer(teacherToken),
      payload: { studentUserId: "u-student" },
    });
    expect(unknownActivity.statusCode).toBe(404);
  });

  it("gives the child their own celebration feed — badges and points only", async () => {
    seed = await seedSchool();
    const teacherToken = await loginToken(seed, "hasiba@ng.example");
    await seed.app.inject({
      method: "POST",
      url: "/ng/activities/a-daily-math/complete",
      headers: bearer(teacherToken),
      payload: { studentUserId: "u-student" },
    });

    const mine = await seed.app.inject({
      method: "GET",
      url: "/ng/my/achievements",
      headers: bearer(await childSessionToken(seed, "u-student")),
    });
    expect(mine.statusCode).toBe(200);
    const body = mine.json() as {
      achievements: { badgeName: string; studentUserId: string }[];
      progress: { metric: string; value: number }[];
    };
    expect(body.achievements).toHaveLength(1);
    expect(body.achievements[0]?.studentUserId).toBe("u-student");
    expect(body.progress.find((p) => p.metric === "points")?.value).toBe(2);
  });

  it("answers CORS preflight so the child's browser can reach the API", async () => {
    seed = await seedSchool();
    const preflight = await seed.app.inject({
      method: "OPTIONS",
      url: "/ng/activities",
      headers: { origin: "http://play.workadventure.localhost:8080" },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("*");
    expect(preflight.headers["access-control-allow-headers"]).toContain(
      "Authorization",
    );

    const get = await seed.app.inject({ method: "GET", url: "/healthz" });
    expect(get.headers["access-control-allow-origin"]).toBe("*");
  });
});
