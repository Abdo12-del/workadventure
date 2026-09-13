import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { NG_PORTAL_TOKEN_KEY } from "../src/lib/api";
import {
  ngHomeRouteFor,
  ngLoginWithToken,
  ngLogout,
  ngMe,
  ngRefreshMe,
  ngToken,
} from "../src/lib/auth";

function stubMe(body: unknown, status = 200) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const PARENT = {
  id: "u-parent",
  email: "p@x",
  name: "أم ياسمين",
  role: "parent",
  children: [],
};

beforeEach(() => {
  window.localStorage.clear();
  ngLogout();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("portal session", () => {
  it("persists the JWT under the portal key and loads /ng/me", async () => {
    stubMe(PARENT);
    const me = await ngLoginWithToken("jwt-parent");
    expect(me.role).toBe("parent");
    expect(window.localStorage.getItem(NG_PORTAL_TOKEN_KEY)).toBe("jwt-parent");
    expect(get(ngToken)).toBe("jwt-parent");
    expect(get(ngMe)?.name).toBe("أم ياسمين");
  });

  it("drops the session silently when the token stops working", async () => {
    stubMe(PARENT);
    await ngLoginWithToken("jwt-parent");
    stubMe({ error: "unauthenticated" }, 401);
    await ngRefreshMe();
    expect(get(ngMe)).toBeNull();
    expect(get(ngToken)).toBeNull();
    expect(window.localStorage.getItem(NG_PORTAL_TOKEN_KEY)).toBeNull();
  });

  it("never calls the API without a token", async () => {
    const fetchMock = stubMe(PARENT);
    await ngRefreshMe();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes each role to its own home — children have none", () => {
    expect(ngHomeRouteFor("parent")).toBe("/parent");
    expect(ngHomeRouteFor("teacher")).toBe("/teacher");
    expect(ngHomeRouteFor("admin")).toBe("/admin");
    expect(ngHomeRouteFor("owner")).toBe("/admin");
    expect(ngHomeRouteFor("student")).toBe("/login");
    expect(ngHomeRouteFor(undefined)).toBe("/login");
  });
});
