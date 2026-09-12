/**
 * NG Academy — أكاديمية الجيل الجديد
 * Row shapes + repository contract. Two implementations exist:
 *  - MemoryRepository (tests, demos)
 *  - PgRepository (production, see schema.sql)
 */
import type { NgRole } from "../config.js";

export interface UserRow {
  id: string;
  email: string;
  role: NgRole;
  displayName: string;
  createdAt: string;
}

export interface ClassRow {
  id: string;
  name: string;
  subject: string;
  teacherUserId: string | undefined;
  roomUrl: string;
  livekitRoom: string;
}

export interface ScheduleRow {
  id: string;
  classId: string;
  startsAt: string;
  endsAt: string;
}

export type AttendanceKind = "enter" | "exit" | "participation";

export interface AttendanceRow {
  id: string;
  studentUserId: string;
  classId: string;
  kind: AttendanceKind;
  at: string;
  recordedBy: string | undefined;
}

export interface AchievementRow {
  id: string;
  studentUserId: string;
  badgeName: string;
  reason: string;
  grantedBy: string | undefined;
  at: string;
}

export interface ProgressRow {
  studentUserId: string;
  metric: string;
  value: number;
  at: string;
}

export interface MagicTokenRow {
  hash: string;
  email: string;
  expiresAt: number;
  consumedAt: number | undefined;
}

export interface Repository {
  /* auth & directory */
  getUserByEmail(email: string): Promise<UserRow | undefined>;
  getUserById(id: string): Promise<UserRow | undefined>;
  listChildren(parentUserId: string): Promise<UserRow[]>;
  /* school */
  listClassesForUser(user: UserRow): Promise<ClassRow[]>;
  listSchedules(classIds: string[]): Promise<ScheduleRow[]>;
  recordAttendance(input: {
    studentUserId: string;
    classId: string;
    kind: AttendanceKind;
    at: string;
    recordedBy: string | undefined;
  }): Promise<AttendanceRow>;
  listAttendance(studentUserId: string): Promise<AttendanceRow[]>;
  grantBadge(input: {
    studentUserId: string;
    badgeName: string;
    reason: string;
    grantedBy: string | undefined;
    at: string;
  }): Promise<AchievementRow>;
  listAchievements(studentUserId: string): Promise<AchievementRow[]>;
  upsertProgress(
    studentUserId: string,
    metric: string,
    value: number,
    at: string,
  ): Promise<ProgressRow>;
  listProgress(studentUserId: string): Promise<ProgressRow[]>;
  /* magic links */
  createMagicToken(
    hash: string,
    email: string,
    expiresAt: number,
  ): Promise<void>;
  consumeMagicToken(hash: string, now: number): Promise<string | undefined>;
}
