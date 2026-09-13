/**
 * NG Academy — a deliberately tiny hash router: the portal has exactly four
 * screens (login, parent, teacher, admin). No dependency, no history tricks —
 * less JS for a page adults open once a week (requirement 17).
 */
import { writable } from "svelte/store";

export type NgRoute = "/login" | "/parent" | "/teacher" | "/admin";

const ROUTES: NgRoute[] = ["/login", "/parent", "/teacher", "/admin"];

export function ngParseHash(hash: string): NgRoute {
  const path = hash.replace(/^#/, "");
  return (ROUTES.find((route) => route === path) ?? "/login") as NgRoute;
}

export const ngRoute = writable<NgRoute>(
  ngParseHash(typeof window === "undefined" ? "" : window.location.hash),
);

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    ngRoute.set(ngParseHash(window.location.hash));
  });
}

export function ngNavigate(route: NgRoute): void {
  window.location.hash = `#${route}`;
  ngRoute.set(route);
}
