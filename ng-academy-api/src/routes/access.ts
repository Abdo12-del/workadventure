/**
 * NG Academy — أكاديمية الجيل الجديد
 * Shared auth helpers for the NG routes: JWT bearer authentication, role
 * guards and the "may this adult see this child?" rule used by the school,
 * activities and portal routes.
 */
import type { FastifyRequest } from "fastify";
import type { AppDeps } from "../app.js";
import type { NgRole } from "../config.js";
import { verifyJwt, type NgJwtPayload } from "../auth/jwt.js";
import type { UserRow } from "../db/types.js";

export async function authenticate(
  req: FastifyRequest,
  deps: AppDeps,
): Promise<{ user: UserRow; jwt: NgJwtPayload } | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const payload = verifyJwt(
    header.slice("Bearer ".length),
    deps.config.JWT_SECRET,
  );
  if (!payload) return null;
  const user = await deps.repo.getUserById(payload.sub);
  if (!user) return null;
  return { user, jwt: payload };
}

export function requireRole(
  auth: { user: UserRow } | null,
  roles: NgRole[],
): UserRow | null {
  if (!auth) return null;
  return roles.includes(auth.user.role) ? auth.user : null;
}

/**
 * Who may see a child's school data (requirements 11 & 12):
 * the student themself, their parent, teachers/admins/owners. A teacher counts
 * when the child attends one of their classes (attendance history or roster).
 */
export async function canAccessStudent(
  deps: AppDeps,
  caller: UserRow,
  studentUserId: string,
): Promise<boolean> {
  if (caller.role === "admin" || caller.role === "owner") return true;
  if (caller.id === studentUserId) return true; // a student may read their own progress
  if (caller.role === "parent") {
    const children = await deps.repo.listChildren(caller.id);
    return children.some((c) => c.id === studentUserId);
  }
  if (caller.role === "teacher") {
    const classes = await deps.repo.listClassesForUser(caller);
    for (const klass of classes) {
      const roster = await deps.repo.listClassStudents(klass.id);
      if (roster.some((s) => s.id === studentUserId)) return true;
    }
    const attendance = await deps.repo.listAttendance(studentUserId);
    return attendance.some((a) => classes.some((k) => k.id === a.classId));
  }
  return false;
}
