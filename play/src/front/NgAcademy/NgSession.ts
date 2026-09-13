/**
 * NG Academy — أكاديمية الجيل الجديد
 * The bridge between the adult portal and the walkable world: when an adult
 * opens the world through the portal gate, the URL carries `#ngToken=<jwt>`.
 * This module remembers it, verifies it against ng-academy-api and exposes
 * the identity (name + role) so in-world features (the admin office…) can
 * gate themselves. Children never see this path: parents open the world for
 * them with a child-scoped token from the parent dashboard.
 */
import { derived, readable } from "svelte/store";
import { NG_API_URL } from "../Enum/EnvironmentVariable";

export interface NgIdentity {
    name: string;
    role: string;
}

/** Pure helper (unit-tested): pull an ngToken out of hash + search + storage. */
export function parseNgToken(hash: string, search: string, stored: string | null): string | null {
    const match = /[#&?]ngToken=([^&#]+)/.exec(`${hash}${search ? `&${search.replace(/^\?/, "")}` : ""}`);
    if (match) {
        return decodeURIComponent(match[1]);
    }
    return stored;
}

function captureToken(): string | null {
    if (typeof window === "undefined") return null;
    const token = parseNgToken(window.location.hash, window.location.search, sessionStorage.getItem("ng-token"));
    const fresh = /[#&?]ngToken=([^&#]+)/.exec(window.location.hash + window.location.search);
    if (fresh && token) sessionStorage.setItem("ng-token", token);
    return token;
}

export const ngToken: string | null = captureToken();

export const ngApiBase: string | undefined = NG_API_URL;

export const ngIdentity = readable<NgIdentity | null>(null, (set) => {
    if (!ngToken || !ngApiBase) return;
    fetch(`${ngApiBase}/ng/me`, { headers: { "x-ng-token": ngToken } })
        .then((response) => (response.ok ? response.json() : null))
        .then((json: { name?: string; displayName?: string; role?: string } | null) => {
            if (json && json.role) {
                set({ name: json.name || json.displayName || "", role: json.role });
            }
        })
        .catch(() => {
            /* offline API: the world still works, just without admin powers */
        });
});

export const ngIsAdmin = derived(ngIdentity, (identity) => identity?.role === "admin" || identity?.role === "owner");
