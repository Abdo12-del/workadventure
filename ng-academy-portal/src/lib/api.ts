/**
 * NG Academy — أكاديمية الجيل الجديد
 * Portal API client: thin typed wrapper over the ng-academy-api JSON routes.
 * The portal is served from the same origin as the API in production (and
 * proxied by vite in dev), so the base URL stays empty and credentials live
 * in a Bearer header — never in cookies, never in URLs.
 */

export const NG_PORTAL_TOKEN_KEY = "ng-portal-token";

/* Embedded-frame resilience: some browsers give cross-origin iframes (like the
 * Arena live-preview pane) blocked or ephemeral localStorage. The session
 * token therefore lives in memory for the tab's lifetime and is mirrored to
 * localStorage best-effort so a reload keeps the session when storage works. */
let memoryToken: string | null = null;

function safeGetToken(): string | null {
  try {
    return window.localStorage.getItem(NG_PORTAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Current session token (memory first, storage mirror second) for the world gate. */
export function ngCurrentToken(): string | null {
  return memoryToken ?? safeGetToken();
}

export function ngStoreToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) window.localStorage.setItem(NG_PORTAL_TOKEN_KEY, token);
    else window.localStorage.removeItem(NG_PORTAL_TOKEN_KEY);
  } catch {
    // storage unavailable (embedded frame): the in-memory copy carries the session
  }
}

export function ngReadToken(): string | null {
  return memoryToken ?? safeGetToken();
}

export interface NgMe {
  id: string;
  email: string;
  name: string;
  role: "student" | "parent" | "teacher" | "admin" | "owner";
  children: { id: string; name: string }[];
}

export interface NgClass {
  id: string;
  name: string;
  subject: string;
  teacherUserId?: string;
  roomUrl: string;
  livekitRoom: string;
}

export interface NgSchedule {
  id: string;
  classId: string;
  startsAt: string;
  endsAt: string;
}

export interface NgAttendance {
  id: string;
  studentUserId: string;
  classId: string;
  kind: "enter" | "exit" | "participation";
  at: string;
}

export interface NgAchievement {
  id: string;
  studentUserId: string;
  badgeName: string;
  reason: string;
  at: string;
}

export interface NgProgress {
  metric: string;
  value: number;
  at: string;
}

export interface NgNote {
  id: string;
  note: string;
  visibility: "parent" | "admin";
  teacherUserId?: string;
  at: string;
}

export interface NgActivity {
  id: string;
  title: string;
  kind: "daily" | "weekly" | "micro";
  points: number;
}

export interface NgAdminUser {
  id: string;
  email: string;
  role: string;
  name: string;
  createdAt: string;
}

export interface NgRoom {
  id: string;
  name: string;
  wamUrl: string;
  purpose: string;
}

export interface NgOverview {
  students: number;
  teachers: number;
  classes: number;
  activities: number;
  rooms: number;
}

export class NgApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`NG API error ${status}`);
  }
}

export class NgPortalApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      // Mirror for locked-down preview proxies that strip Authorization.
      headers["x-ng-token"] = token;
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new NgApiError(response.status, body);
    }
    return (await response.json()) as T;
  }

  /* ---- auth (magic link: parents/teachers/admins only, never children) -- */

  requestMagicLink(email: string): Promise<{ ok: boolean; message: string }> {
    return this.request("/ng/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  verifyMagicLink(
    token: string,
  ): Promise<{ token: string; role: string; name: string }> {
    return this.request("/ng/auth/magic-link/verify", {
      method: "POST",
      body: JSON.stringify({ token: token.trim() }),
    });
  }

  me(): Promise<NgMe> {
    return this.request("/ng/me");
  }

  /* ---- shared school data ---- */

  classes(): Promise<{ classes: NgClass[]; schedules: NgSchedule[] }> {
    return this.request("/ng/classes");
  }

  classStudents(
    classId: string,
  ): Promise<{ students: { id: string; name: string }[] }> {
    return this.request(`/ng/classes/${encodeURIComponent(classId)}/students`);
  }

  activities(): Promise<{ activities: NgActivity[] }> {
    return this.request("/ng/activities");
  }

  /* ---- per child (parent/teacher views) ---- */

  attendance(studentId: string): Promise<{ attendance: NgAttendance[] }> {
    return this.request(
      `/ng/students/${encodeURIComponent(studentId)}/attendance`,
    );
  }

  achievements(studentId: string): Promise<{ achievements: NgAchievement[] }> {
    return this.request(
      `/ng/students/${encodeURIComponent(studentId)}/achievements`,
    );
  }

  progress(studentId: string): Promise<{ progress: NgProgress[] }> {
    return this.request(
      `/ng/students/${encodeURIComponent(studentId)}/progress`,
    );
  }

  notes(studentId: string): Promise<{ notes: NgNote[] }> {
    return this.request(`/ng/students/${encodeURIComponent(studentId)}/notes`);
  }

  addNote(
    studentId: string,
    note: string,
    visibility: "parent" | "admin",
  ): Promise<NgNote> {
    return this.request(`/ng/students/${encodeURIComponent(studentId)}/notes`, {
      method: "POST",
      body: JSON.stringify({ note, visibility }),
    });
  }

  grantBadge(
    studentId: string,
    badgeName: string,
    reason: string,
  ): Promise<NgAchievement> {
    return this.request(
      `/ng/students/${encodeURIComponent(studentId)}/badges`,
      {
        method: "POST",
        body: JSON.stringify({ badgeName, reason }),
      },
    );
  }

  completeActivity(
    activityId: string,
    studentUserId: string,
  ): Promise<{ points: number }> {
    return this.request(
      `/ng/activities/${encodeURIComponent(activityId)}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ studentUserId }),
      },
    );
  }

  recordAttendance(
    classId: string,
    studentUserId: string,
    kind: "enter" | "exit" | "participation",
  ): Promise<unknown> {
    return this.request(
      `/ng/classes/${encodeURIComponent(classId)}/attendance`,
      {
        method: "POST",
        body: JSON.stringify({ studentUserId, kind }),
      },
    );
  }

  /* ---- world gate (the admin dashboards now live INSIDE the world) ---- */
  worldConfig(): Promise<{ worldUrl: string }> {
    return this.request("/ng/config");
  }
}

/** The single portal-wide client: same-origin, token from localStorage. */
export const portalApi = new NgPortalApi("", () => ngReadToken());
