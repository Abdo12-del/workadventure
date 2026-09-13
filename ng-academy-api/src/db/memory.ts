/**
 * NG Academy — أكاديمية الجيل الجديد
 * In-memory repository: unit/integration tests and local demos without Postgres.
 */
import type { NgRole } from "../config.js";
import type {
  AchievementRow,
  ActivityKind,
  ActivityRow,
  AttendanceKind,
  AttendanceRow,
  ClassRow,
  CourseRow,
  MagicTokenRow,
  NoteRow,
  ProgressRow,
  Repository,
  ScheduleRow,
  UserRow,
  VirtualRoomRow,
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
  activities = new Map<string, ActivityRow>();
  notes: NoteRow[] = [];
  courses = new Map<string, CourseRow>();
  rooms = new Map<string, VirtualRoomRow>();

  addUser(user: UserRow): UserRow {
    this.users.set(user.id, user);
    return user;
  }

  addClass(row: ClassRow, studentUserIds: string[] = []): ClassRow {
    this.classes.set(row.id, { ...row, studentUserIds });
    return row;
  }

  addActivity(row: ActivityRow): ActivityRow {
    this.activities.set(row.id, row);
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

  async listActivities(): Promise<ActivityRow[]> {
    return [...this.activities.values()];
  }

  async createActivity(input: {
    title: string;
    kind: ActivityKind;
    points: number;
  }): Promise<ActivityRow> {
    const row: ActivityRow = { id: nextId(), ...input };
    this.activities.set(row.id, row);
    return row;
  }

  async completeActivity(input: {
    activityId: string;
    studentUserId: string;
    byUserId: string | undefined;
    at: string;
  }): Promise<{ achievement: AchievementRow; points: number }> {
    const activity = this.activities.get(input.activityId);
    if (!activity) throw new Error(`unknown activity ${input.activityId}`);
    const achievement = await this.grantBadge({
      studentUserId: input.studentUserId,
      badgeName: activity.title,
      reason: `أكمل نشاطًا (${activity.kind})`,
      grantedBy: input.byUserId,
      at: input.at,
    });
    const current = await this.listProgress(input.studentUserId);
    const points =
      (current.find((row) => row.metric === "points")?.value ?? 0) +
      activity.points;
    await this.upsertProgress(input.studentUserId, "points", points, input.at);
    return { achievement, points };
  }

  async listUsers(role?: NgRole): Promise<UserRow[]> {
    const all = [...this.users.values()];
    return role ? all.filter((u) => u.role === role) : all;
  }

  async createUser(input: {
    email: string;
    role: NgRole;
    displayName: string;
    createdAt: string;
  }): Promise<UserRow> {
    if ([...this.users.values()].some((u) => u.email === input.email)) {
      throw new Error("duplicate email");
    }
    const row: UserRow = { id: nextId(), ...input };
    this.users.set(row.id, row);
    return row;
  }

  async linkChild(parentUserId: string, studentUserId: string): Promise<void> {
    const kids = this.children.get(parentUserId) ?? [];
    if (!kids.includes(studentUserId)) kids.push(studentUserId);
    this.children.set(parentUserId, kids);
  }

  async createCourse(input: {
    title: string;
    subject: string;
  }): Promise<CourseRow> {
    const row: CourseRow = { id: nextId(), ...input };
    this.courses.set(row.id, row);
    return row;
  }

  async createClass(input: {
    name: string;
    subject: string;
    teacherUserId: string | undefined;
    studentUserIds: string[];
    roomUrl: string;
    livekitRoom: string;
  }): Promise<ClassRow> {
    const row: ClassRow = {
      id: nextId(),
      name: input.name,
      subject: input.subject,
      teacherUserId: input.teacherUserId,
      roomUrl: input.roomUrl,
      livekitRoom: input.livekitRoom,
    };
    this.classes.set(row.id, {
      ...row,
      studentUserIds: [...input.studentUserIds],
    });
    return row;
  }

  async addClassStudents(
    classId: string,
    studentUserIds: string[],
  ): Promise<void> {
    const klass = this.classes.get(classId);
    if (!klass) throw new Error(`unknown class ${classId}`);
    for (const id of studentUserIds) {
      if (!klass.studentUserIds.includes(id)) klass.studentUserIds.push(id);
    }
  }

  async listClassStudents(classId: string): Promise<UserRow[]> {
    const klass = this.classes.get(classId);
    if (!klass) return [];
    return klass.studentUserIds
      .map((id) => this.users.get(id))
      .filter((u): u is UserRow => u !== undefined);
  }

  async addNote(input: {
    studentUserId: string;
    teacherUserId: string | undefined;
    note: string;
    visibility: "parent" | "admin";
    at: string;
  }): Promise<NoteRow> {
    const row: NoteRow = { id: nextId(), ...input };
    this.notes.push(row);
    return row;
  }

  async listNotes(studentUserId: string): Promise<NoteRow[]> {
    return this.notes.filter((n) => n.studentUserId === studentUserId);
  }

  async listVirtualRooms(): Promise<VirtualRoomRow[]> {
    return [...this.rooms.values()];
  }

  async createVirtualRoom(input: {
    name: string;
    wamUrl: string;
    purpose: string;
  }): Promise<VirtualRoomRow> {
    const row: VirtualRoomRow = { id: nextId(), ...input };
    this.rooms.set(row.id, row);
    return row;
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
