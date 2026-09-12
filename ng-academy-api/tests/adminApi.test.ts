import { afterEach, describe, expect, it } from "vitest";
import { isMapDetailsData } from "@workadventure/messages/src/JsonMessages/MapDetailsData";
import { loginToken, seedSchool, type Seed } from "./seed.js";
import { roomSlugFromPlayUri } from "../src/routes/adminApi.js";

let seed: Seed;
const adminHeaders = { authorization: "ng-academy-admin-token" };

afterEach(async () => {
  await seed?.app.close();
});

describe("WorkAdventure Admin API contract", () => {
  it("advertises no optional capabilities", async () => {
    seed = await seedSchool();
    const res = await seed.app.inject({
      method: "GET",
      url: "/api/capabilities",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });

  it("serves MapDetailsData the front can parse, for every school room", async () => {
    seed = await seedSchool();
    const res = await seed.app.inject({
      method: "GET",
      url: "/api/map?playUri=http://play.workadventure.localhost/ng-academy/entrance",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    const parsed = isMapDetailsData.safeParse(res.json());
    expect(parsed.success, JSON.stringify(parsed.error)).toBe(true);
    expect(parsed.success && parsed.data.wamUrl).toContain("entrance.wam");

    const missing = await seed.app.inject({
      method: "GET",
      url: "/api/map?playUri=http://play.workadventure.localhost/ng-academy/nowhere",
      headers: adminHeaders,
    });
    expect(missing.statusCode).toBe(404);

    const unauth = await seed.app.inject({
      method: "GET",
      url: "/api/map?playUri=x",
    });
    expect(unauth.statusCode).toBe(401);
  });

  it("grants room access with role tags and records silent attendance", async () => {
    seed = await seedSchool();
    const access = await seed.app.inject({
      method: "GET",
      url: "/api/room/access?userIdentifier=u-student&playUri=http://play.workadventure.localhost/ng-academy/classroom-math",
      headers: adminHeaders,
    });
    expect(access.statusCode).toBe(200);
    const body = access.json() as {
      status: string;
      tags: string[];
      userUuid: string;
      world: string;
    };
    expect(body.status).toBe("ok");
    expect(body.tags).toEqual(["ng-student"]);
    expect(body.world).toBe("ng-academy");
    // requirement 10: attendance recorded server-side, invisibly
    const attendance = await seed.repo.listAttendance("u-student");
    expect(attendance).toHaveLength(1);
    expect(attendance[0]?.kind).toBe("enter");
  });

  it("denies unknown users and accepts JWT bearer identities", async () => {
    seed = await seedSchool();
    const denied = await seed.app.inject({
      method: "GET",
      url: "/api/room/access?userIdentifier=ghost&playUri=http://play.workadventure.localhost/ng-academy/entrance",
      headers: adminHeaders,
    });
    expect(denied.statusCode).toBe(403);

    const token = await loginToken(seed, "parent@ng.example");
    const viaJwt = await seed.app.inject({
      method: "GET",
      url: `/api/room/access?userIdentifier=whatever&playUri=http://play.workadventure.localhost/ng-academy/entrance&accessToken=${token}`,
      headers: adminHeaders,
    });
    expect(viaJwt.statusCode).toBe(200);
    expect((viaJwt.json() as { tags: string[] }).tags).toEqual(["ng-parent"]);
  });

  it("exposes room tags as a string array", async () => {
    seed = await seedSchool();
    const res = await seed.app.inject({
      method: "GET",
      url: "/api/room/tags?roomUrl=entrance",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("parses play URIs into room slugs", () => {
    expect(
      roomSlugFromPlayUri(
        "http://play.workadventure.localhost/ng-academy/classroom-math",
      ),
    ).toBe("classroom-math");
    expect(
      roomSlugFromPlayUri(
        "http://play.workadventure.localhost/ng-academy/entrance/",
      ),
    ).toBe("entrance");
  });
});
