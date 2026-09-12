/**
 * NG Academy — أكاديمية الجيل الجديد
 * In-memory repository: unit/integration tests and local demos without Postgres.
 */
import type {
  AchievementRow,
  AttendanceKind,
  AttendanceRow,
  ClassRow,
  MagicTokenRow,
  ProgressRow,
  Repository,
  ScheduleRow,
  UserRow,
} from "./types.js";

let seq = 0;
const nextId = (): string => `mem-${++seq}`;

export class MemoryRepository implements Repository {
  users = new Map<string, UserRow>();
  children = new Map<string, string[]>(); // parentUserId -> student user ids
  classes = new Map<string, ClassRow & { studentUserIds: string[] }>();
  schedules: ScheduleRow[] = [];
  attendance: AttendanceRow[] = [];
  achievements: AchievementRow[] = [];
  progress: ProgressRow[] = [];
  tokens = new Map<string, MagicTokenRow>();

  addUser(user: UserRow): UserRow {
    this.users.set(user.id, user);
    return user;
  }

  addClass(row: ClassRow, studentUserIds: string[] = []): ClassRow {
    this.classes.set(row.id, { ...row, studentUserIds });
    return row;
  }

  addSchedule(row: ScheduleRow): ScheduleRow {
    this.schedules.push(row);
    return row;
  }

  async getUserByEmail(email: string): Promise<UserRow | undefined> {
    return [...this.users.values()].find(
      (u) => u.email === email.toLowerCase(),
    );
  }

  async getUserById(id: string): Promise<UserRow | undefined> {
    return this.users.get(id);
  }

  async listChildren(parentUserId: string): Promise<UserRow[]> {
    return (this.children.get(parentUserId) ?? [])
      .map((id) => this.users.get(id))
      .filter((u): u is UserRow => u !== undefined);
  }

  async listClassesForUser(user: UserRow): Promise<ClassRow[]> {
    const all = [...this.classes.values()];
    switch (user.role) {
      case "admin":
      case "owner":
        return all;
      case "teacher":
        return all.filter((c) => c.teacherUserId === user.id);
      case "student":
        return all.filter((c) => c.studentUserIds.includes(user.id));
      case "parent": {
        const kids = this.children.get(user.id) ?? [];
        return all.filter((c) =>
          c.studentUserIds.some((s) => kids.includes(s)),
        );
      }
    }
  }

  async listSchedules(classIds: string[]): Promise<ScheduleRow[]> {
    return this.schedules.filter((s) => classIds.includes(s.classId));
  }

  async recordAttendance(input: {
    studentUserId: string;
    classId: string;
    kind: AttendanceKind;
    at: string;
    recordedBy: string | undefined;
  }): Promise<AttendanceRow> {
    const row: AttendanceRow = { id: nextId(), ...input };
    this.attendance.push(row);
    return row;
  }

  async listAttendance(studentUserId: string): Promise<AttendanceRow[]> {
    return this.attendance.filter((a) => a.studentUserId === studentUserId);
  }

  async grantBadge(input: {
    studentUserId: string;
    badgeName: string;
    reason: string;
    grantedBy: string | undefined;
    at: string;
  }): Promise<AchievementRow> {
    const row: AchievementRow = { id: nextId(), ...input };
    this.achievements.push(row);
    return row;
  }

  async listAchievements(studentUserId: string): Promise<AchievementRow[]> {
    return this.achievements.filter((a) => a.studentUserId === studentUserId);
  }

  async upsertProgress(
    studentUserId: string,
    metric: string,
    value: number,
    at: string,
  ): Promise<ProgressRow> {
    const existing = this.progress.find(
      (p) => p.studentUserId === studentUserId && p.metric === metric,
    );
    if (existing) {
      existing.value = value;
      existing.at = at;
      return existing;
    }
    const row: ProgressRow = { studentUserId, metric, value, at };
    this.progress.push(row);
    return row;
  }

  async listProgress(studentUserId: string): Promise<ProgressRow[]> {
    return this.progress.filter((p) => p.studentUserId === studentUserId);
  }

  async createMagicToken(
    hash: string,
    email: string,
    expiresAt: number,
  ): Promise<void> {
    this.tokens.set(hash, { hash, email, expiresAt, consumedAt: undefined });
  }

  async consumeMagicToken(
    hash: string,
    now: number,
  ): Promise<string | undefined> {
    const token = this.tokens.get(hash);
    if (!token || token.consumedAt !== undefined || token.expiresAt < now) {
      return undefined;
    }
    token.consumedAt = now;
    return token.email;
  }
}
