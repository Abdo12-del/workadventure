import { afterEach, describe, expect, it } from "vitest";
import { loginToken, seedSchool, type Seed } from "./seed.js";

let seed: Seed;

afterEach(async () => {
  await seed?.app.close();
});

describe("magic-link authentication (parent email)", () => {
  it("publishes the world url for the portal world-gate", async () => {
    seed = await seedSchool();
    const res = await seed.app.inject({ method: "GET", url: "/ng/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json().worldUrl).toContain("play");
  });

  it("sends a single-use link and issues a role JWT", async () => {
    seed = await seedSchool();
    const requested = await seed.app.inject({
      method: "POST",
      url: "/ng/auth/magic-link",
      payload: { email: "parent@ng.example" },
    });
    expect(requested.statusCode).toBe(202);
    expect(seed.email.sent).toHaveLength(1);
    expect(seed.email.sent[0]?.subject).toContain("أكاديمية الجيل الجديد");

    const token = await loginToken(seed, "parent@ng.example");
    const me = await seed.app.inject({
      method: "GET",
      url: "/ng/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    const body = me.json() as {
      role: string;
      tags: string[];
      children: { id: string }[];
    };
    expect(body.role).toBe("parent");
    expect(body.tags).toEqual(["ng-parent"]);
    expect(body.children.map((c) => c.id)).toEqual(["u-student"]);
  });

  it("rejects a reused link (single use) and unknown emails stay silent", async () => {
    seed = await seedSchool();
    await seed.app.inject({
      method: "POST",
      url: "/ng/auth/magic-link",
      payload: { email: "parent@ng.example" },
    });
    const mail = seed.email.sent[0];
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail?.body ?? "")?.[1] ?? "";
    const first = await seed.app.inject({
      method: "POST",
      url: "/ng/auth/magic-link/verify",
      payload: { token },
    });
    expect(first.statusCode).toBe(200);
    const second = await seed.app.inject({
      method: "POST",
      url: "/ng/auth/magic-link/verify",
      payload: { token },
    });
    expect(second.statusCode).toBe(401);

    const unknown = await seed.app.inject({
      method: "POST",
      url: "/ng/auth/magic-link",
      payload: { email: "stranger@ng.example" },
    });
    expect(unknown.statusCode).toBe(202); // no account enumeration
    expect(seed.email.sent).toHaveLength(1); // but no email leaves the building
  });

  it("never issues links to children accounts", async () => {
    seed = await seedSchool();
    await seed.app.inject({
      method: "POST",
      url: "/ng/auth/magic-link",
      payload: { email: "child@ng.example" },
    });
    expect(seed.email.sent).toHaveLength(0);
  });

  it("rejects forged or expired JWTs on /ng/me", async () => {
    seed = await seedSchool();
    const forged = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LXBhcmVudCJ9.invalid";
    const res = await seed.app.inject({
      method: "GET",
      url: "/ng/me",
      headers: { authorization: `Bearer ${forged}` },
    });
    expect(res.statusCode).toBe(401);
    const none = await seed.app.inject({ method: "GET", url: "/ng/me" });
    expect(none.statusCode).toBe(401);
  });
});

describe("child sessions (parent-opened)", () => {
  it("opens a child session only for their own parent", async () => {
    seed = await seedSchool();
    const parentToken = await loginToken(seed, "parent@ng.example");
    const ok = await seed.app.inject({
      method: "POST",
      url: "/ng/children/u-student/session",
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { role: string }).role).toBe("student");

    const otherToken = await loginToken(seed, "parent2@ng.example");
    const foreign = await seed.app.inject({
      method: "POST",
      url: "/ng/children/u-student/session",
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(foreign.statusCode).toBe(403);
  });
});
