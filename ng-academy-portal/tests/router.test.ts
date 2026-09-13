import { describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { ngNavigate, ngParseHash, ngRoute } from "../src/lib/router";

describe("tiny hash router", () => {
  it("parses known routes and falls back to /login", () => {
    expect(ngParseHash("#/parent")).toBe("/parent");
    expect(ngParseHash("#/teacher")).toBe("/teacher");
    expect(ngParseHash("#/admin")).toBe("/admin");
    expect(ngParseHash("#/hackers")).toBe("/login");
    expect(ngParseHash("")).toBe("/login");
  });

  it("navigates by hash and follows hashchange events", () => {
    ngNavigate("/admin");
    expect(window.location.hash).toBe("#/admin");
    expect(get(ngRoute)).toBe("/admin");

    window.location.hash = "#/parent";
    window.dispatchEvent(new Event("hashchange"));
    expect(get(ngRoute)).toBe("/parent");
  });
});
