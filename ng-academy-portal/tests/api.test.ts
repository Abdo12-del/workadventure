import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NG_PORTAL_TOKEN_KEY, NgApiError, NgPortalApi } from "../src/lib/api";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("portal API client", () => {
  it("calls same-origin relative URLs with the Bearer token", async () => {
    const fetchMock = stubFetch({
      id: "u-1",
      email: "p@x",
      name: "أم",
      role: "parent",
      children: [],
    });
    window.localStorage.setItem(NG_PORTAL_TOKEN_KEY, "jwt-123");
    const api = new NgPortalApi("", () =>
      window.localStorage.getItem(NG_PORTAL_TOKEN_KEY),
    );
    const me = await api.me();
    expect(me.role).toBe("parent");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/ng/me");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer jwt-123",
    );
  });

  it("never sends a token it does not have, and surfaces failures as NgApiError", async () => {
    const fetchMock = stubFetch({ error: "unauthenticated" }, 401);
    const api = new NgPortalApi("", () =>
      window.localStorage.getItem(NG_PORTAL_TOKEN_KEY),
    );
    await expect(api.me()).rejects.toBeInstanceOf(NgApiError);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>)["Authorization"],
    ).toBeUndefined();
    try {
      await api.me();
    } catch (e) {
      expect((e as NgApiError).status).toBe(401);
    }
  });

  it("verifies a magic link and posts admin payloads as JSON", async () => {
    const fetchMock = stubFetch({ token: "jwt", role: "admin", name: "مدير" });
    const api = new NgPortalApi("", () => null);
    const result = await api.verifyMagicLink(" abc12345 ");
    expect(result.role).toBe("admin");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/ng/auth/magic-link/verify");
    expect(JSON.parse(init.body as string)).toEqual({ token: "abc12345" });

    const configMock = stubFetch({ worldUrl: "http://localhost:3104" });
    const config = await api.worldConfig();
    const [configUrl] = configMock.mock.calls[0] as unknown as [string];
    expect(configUrl).toBe("/ng/config");
    expect(config.worldUrl).toBe("http://localhost:3104");
  });

  it("escapes child ids in per-student paths", async () => {
    const fetchMock = stubFetch({ notes: [] });
    const api = new NgPortalApi("", () => null);
    await api.notes("u 1/2");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/ng/students/u%201%2F2/notes");
  });
});
