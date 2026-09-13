/**
 * NG Academy — portal session: a magic-link JWT kept in localStorage under a
 * key separate from the child's world session (`ng-token`). Children never log
 * into the portal; the router redirects them away (requirement 12).
 */
import { get, writable } from "svelte/store";
import {
  NgApiError,
  ngReadToken,
  ngStoreToken,
  portalApi,
  type NgMe,
} from "./api";

export const ngToken = writable<string | null>(ngReadToken());
export const ngMe = writable<NgMe | null>(null);

export async function ngLoginWithToken(token: string): Promise<NgMe> {
  ngStoreToken(token);
  ngToken.set(token);
  const me = await portalApi.me();
  ngMe.set(me);
  return me;
}

export async function ngRefreshMe(): Promise<void> {
  if (!get(ngToken)) {
    ngMe.set(null);
    return;
  }
  try {
    ngMe.set(await portalApi.me());
  } catch {
    // expired or revoked session: back to the login screen, silently
    ngLogout();
  }
}

export function ngLogout(): void {
  ngStoreToken(null);
  ngToken.set(null);
  ngMe.set(null);
}

/** Where each role lands after login — students have no portal home at all. */
export function ngHomeRouteFor(
  role: string | undefined,
): "/parent" | "/teacher" | "/admin" | "/login" {
  switch (role) {
    case "parent":
      return "/parent";
    case "teacher":
      return "/teacher";
    case "admin":
    case "owner":
      return "/admin";
    default:
      return "/login";
  }
}

export function ngIsForbiddenError(e: unknown): boolean {
  return e instanceof NgApiError && (e.status === 401 || e.status === 403);
}
