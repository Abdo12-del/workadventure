/**
 * NG Academy — أكاديمية الجيل الجديد
 * Tiny client for ng-academy-api used by the in-world admin office panel.
 * Same contract as the (retired) standalone portal dashboard: every call is
 * authenticated with the session token the portal handed to the world, and
 * the API re-checks the admin/owner role server-side on each route.
 */
import { ngApiBase, ngToken } from "./NgSession";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const base = ngApiBase;
    if (!base) throw new Error("NG_API_URL is not configured");
    const response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(ngToken ? { "x-ng-token": ngToken } : {}),
            ...(init?.headers ?? {}),
        },
    });
    if (!response.ok) throw new Error(`ng-api ${response.status}`);
    return (await response.json()) as T;
}

export interface NgOverview {
    students: number;
    teachers: number;
    parents: number;
    classes: number;
    rooms: number;
    activities: number;
}
export interface NgAdminUser {
    id: string;
    email: string;
    name: string;
    role: string;
}
export interface NgClass {
    id: string;
    name: string;
    subject: string;
    teacher?: string;
    students?: { id: string; name: string }[];
}
export interface NgActivity {
    id: string;
    title: string;
    kind: string;
    points: number;
}
export interface NgRoom {
    id: string;
    name: string;
    wamUrl: string;
    purpose: string;
}

export const ngAdminApi = {
    overview: () => request<NgOverview>("/ng/admin/overview"),
    users: (role?: string) =>
        request<{ users: NgAdminUser[] }>(`/ng/admin/users${role ? `?role=${encodeURIComponent(role)}` : ""}`),
    createUser: (input: { email: string; role: string; displayName: string }) =>
        request<NgAdminUser>("/ng/admin/users", { method: "POST", body: JSON.stringify(input) }),
    classes: () => request<{ classes: NgClass[] }>("/ng/classes"),
    createClass: (input: { name: string; subject: string }) =>
        request<NgClass>("/ng/admin/classes", { method: "POST", body: JSON.stringify(input) }),
    activities: () => request<{ activities: NgActivity[] }>("/ng/activities"),
    createActivity: (input: { title: string; kind: string; points: number }) =>
        request<NgActivity>("/ng/admin/activities", { method: "POST", body: JSON.stringify(input) }),
    rooms: () => request<{ rooms: NgRoom[] }>("/ng/admin/rooms"),
    createRoom: (input: { name: string; wamUrl: string; purpose: string }) =>
        request<NgRoom>("/ng/admin/rooms", { method: "POST", body: JSON.stringify(input) }),
};
