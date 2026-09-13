/**
 * NG Academy — أكاديمية الجيل الجديد
 * Postgres repository (production). Plain SQL through `pg`, schema applied at boot.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type {
  AchievementRow,
  ActivityKind,
  ActivityRow,
  AttendanceKind,
  AttendanceRow,
  ClassRow,
  CourseRow,
  NoteRow,
  ProgressRow,
  Repository,
  ScheduleRow,
  UserRow,
  VirtualRoomRow,
} from "./types.js";
import type { NgRole } from "../config.js";

const here = dirname(fileURLToPath(import.meta.url));

interface UserAggregate {
  id: string;
  email: string;
  role: NgRole;
  display_name: string;
  created_at: Date;
}

const toUser = (r: UserAggregate): UserRow => ({
  id: r.id,
  email: r.email,
  role: r.role,
  displayName: r.display_name,
  createdAt: r.created_at.toISOString(),
});

export class PgRepository implements Repository {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(databaseUrl: string): Promise<PgRepository> {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const repo = new PgRepository(pool);
    await repo.applySchema();
    return repo;
  }

  async applySchema(): Promise<void> {
    const schema = readFileSync(join(here, "schema.sql"), "utf-8");
    await this.pool.query(schema);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async getUserByEmail(email: string): Promise<UserRow | undefined> {
    const res = await this.pool.query<UserAggregate>(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase()],
    );
    return res.rows[0] ? toUser(res.rows[0]) : undefined;
  }

  async getUserById(id: string): Promise<UserRow | undefined> {
    const res = await this.pool.query<UserAggregate>(
      "SELECT * FROM users WHERE id = $1",
      [id],
    );
    return res.rows[0] ? toUser(res.rows[0]) : undefined;
  }

  async listChildren(parentUserId: string): Promise<UserRow[]> {
    const res = await this.pool.query<UserAggregate>(
      `SELECT u.* FROM users u
             JOIN students s ON s.user_id = u.id
             JOIN parent_students ps ON ps.student_id = s.id
             JOIN parents p ON p.id = ps.parent_id
             JOIN users pu ON pu.id = p.user_id
             WHERE pu.id = $1`,
      [parentUserId],
    );
    return res.rows.map(toUser);
  }

  async listClassesForUser(user: UserRow): Promise<ClassRow[]> {
    const base = `SELECT c.id, c.name, co.subject, tu.id AS teacher_user_id, c.room_url, c.livekit_room
                      FROM classes c JOIN courses co ON co.id = c.course_id
                      LEFT JOIN teachers t ON t.id = c.teacher_id
                      LEFT JOIN users tu ON tu.id = t.user_id`;
    let res;
    if (user.role === "admin" || user.role === "owner") {
      res = await this.pool.query(base);
    } else if (user.role === "teacher") {
      res = await this.pool.query(
        `${base} JOIN teachers mt ON mt.id = c.teacher_id JOIN users mu ON mu.id = mt.user_id WHERE mu.id = $1`,
        [user.id],
      );
    } else if (user.role === "student") {
      res = await this.pool.query(
        `${base} JOIN students s ON s.class_id = c.id JOIN users su ON su.id = s.user_id WHERE su.id = $1`,
        [user.id],
      );
    } else {
      res = await this.pool.query(
        `${base} JOIN students s ON s.class_id = c.id
                 JOIN parent_students ps ON ps.student_id = s.id
                 JOIN parents p ON p.id = ps.parent_id
                 JOIN users pu ON pu.id = p.user_id WHERE pu.id = $1`,
        [user.id],
      );
    }
    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      teacherUserId: r.teacher_user_id ?? undefined,
      roomUrl: r.room_url,
      livekitRoom: r.livekit_room,
    }));
  }

  async listSchedules(classIds: string[]): Promise<ScheduleRow[]> {
    if (classIds.length === 0) return [];
    const res = await this.pool.query(
      `SELECT id, class_id, starts_at, ends_at FROM schedules WHERE class_id = ANY($1)`,
      [classIds],
    );
    return res.rows.map((r) => ({
      id: r.id,
      classId: r.class_id,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
    }));
  }

  async recordAttendance(input: {
    studentUserId: string;
    classId: string;
    kind: AttendanceKind;
    at: string;
    recordedBy: string | undefined;
  }): Promise<AttendanceRow> {
    const res = await this.pool.query(
      `INSERT INTO attendance (student_id, class_id, kind, at, recorded_by)
             SELECT s.id, $2, $3, $4, $5 FROM students s JOIN users u ON u.id = s.user_id WHERE u.id = $1
             RETURNING id, at`,
      [
        input.studentUserId,
        input.classId,
        input.kind,
        input.at,
        input.recordedBy ?? null,
      ],
    );
    return {
      ...input,
      id: res.rows[0].id as string,
      at: (res.rows[0].at as Date).toISOString(),
    };
  }

  async listAttendance(studentUserId: string): Promise<AttendanceRow[]> {
    const res = await this.pool.query(
      `SELECT a.id, u.id AS student_user_id, a.class_id, a.kind, a.at, a.recorded_by
             FROM attendance a JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id
             WHERE u.id = $1 ORDER BY a.at`,
      [studentUserId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      studentUserId: r.student_user_id,
      classId: r.class_id,
      kind: r.kind,
      at: r.at.toISOString(),
      recordedBy: r.recorded_by ?? undefined,
    }));
  }

  async grantBadge(input: {
    studentUserId: string;
    badgeName: string;
    reason: string;
    grantedBy: string | undefined;
    at: string;
  }): Promise<AchievementRow> {
    const badge = await this.pool.query(
      `INSERT INTO badges (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [input.badgeName],
    );
    const res = await this.pool.query(
      `INSERT INTO achievements (student_id, badge_id, reason, granted_by, at)
             SELECT s.id, $2, $3, $4, $5 FROM students s JOIN users u ON u.id = s.user_id WHERE u.id = $1
             RETURNING id, at`,
      [
        input.studentUserId,
        badge.rows[0].id,
        input.reason,
        input.grantedBy ?? null,
        input.at,
      ],
    );
    return {
      ...input,
      id: res.rows[0].id as string,
      at: (res.rows[0].at as Date).toISOString(),
    };
  }

  async listAchievements(studentUserId: string): Promise<AchievementRow[]> {
    const res = await this.pool.query(
      `SELECT a.id, u.id AS student_user_id, b.name, a.reason, a.granted_by, a.at
             FROM achievements a
             JOIN students s ON s.id = a.student_id
             JOIN users u ON u.id = s.user_id
             JOIN badges b ON b.id = a.badge_id
             WHERE u.id = $1 ORDER BY a.at`,
      [studentUserId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      studentUserId: r.student_user_id,
      badgeName: r.name,
      reason: r.reason,
      grantedBy: r.granted_by ?? undefined,
      at: r.at.toISOString(),
    }));
  }

  async upsertProgress(
    studentUserId: string,
    metric: string,
    value: number,
    at: string,
  ): Promise<ProgressRow> {
    const res = await this.pool.query(
      `INSERT INTO child_progress (student_id, metric, value, at)
             SELECT s.id, $2, $3, $4 FROM students s JOIN users u ON u.id = s.user_id WHERE u.id = $1
             ON CONFLICT (student_id, metric) DO UPDATE SET value = EXCLUDED.value, at = EXCLUDED.at
             RETURNING metric, value, at`,
      [studentUserId, metric, value, at],
    );
    return {
      studentUserId,
      metric: res.rows[0].metric,
      value: res.rows[0].value,
      at: res.rows[0].at.toISOString(),
    };
  }

  async listProgress(studentUserId: string): Promise<ProgressRow[]> {
    const res = await this.pool.query(
      `SELECT p.metric, p.value, p.at, u.id AS student_user_id
             FROM child_progress p JOIN students s ON s.id = p.student_id JOIN users u ON u.id = s.user_id
             WHERE u.id = $1`,
      [studentUserId],
    );
    return res.rows.map((r) => ({
      studentUserId: r.student_user_id,
      metric: r.metric,
      value: r.value,
      at: r.at.toISOString(),
    }));
  }

  async listActivities(): Promise<ActivityRow[]> {
    const res = await this.pool.query(
      `SELECT id, title, kind, points FROM activities ORDER BY title`,
    );
    return res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      points: r.points,
    }));
  }

  async createActivity(input: {
    title: string;
    kind: ActivityKind;
    points: number;
  }): Promise<ActivityRow> {
    const res = await this.pool.query(
      `INSERT INTO activities (title, kind, points) VALUES ($1, $2, $3) RETURNING id`,
      [input.title, input.kind, input.points],
    );
    return { id: res.rows[0].id, ...input };
  }

  async completeActivity(input: {
    activityId: string;
    studentUserId: string;
    byUserId: string | undefined;
    at: string;
  }): Promise<{ achievement: AchievementRow; points: number }> {
    const activityRes = await this.pool.query(
      `SELECT title, kind, points FROM activities WHERE id = $1`,
      [input.activityId],
    );
    const activity = activityRes.rows[0] as
      | { title: string; kind: string; points: number }
      | undefined;
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
    const res = role
      ? await this.pool.query(
          `SELECT id, email, role, display_name, created_at FROM users WHERE role = $1 ORDER BY created_at`,
          [role],
        )
      : await this.pool.query(
          `SELECT id, email, role, display_name, created_at FROM users ORDER BY created_at`,
        );
    return res.rows.map(toUser);
  }

  async createUser(input: {
    email: string;
    role: NgRole;
    displayName: string;
    createdAt: string;
  }): Promise<UserRow> {
    const res = await this.pool.query(
      `INSERT INTO users (email, role, display_name, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role, display_name, created_at`,
      [input.email, input.role, input.displayName, input.createdAt],
    );
    const row = res.rows[0];
    if (!row) throw new Error("duplicate email");
    return toUser(row);
  }

  async linkChild(parentUserId: string, studentUserId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO parents (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [parentUserId],
    );
    await this.pool.query(
      `INSERT INTO students (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [studentUserId],
    );
    await this.pool.query(
      `INSERT INTO parent_students (parent_id, student_id)
       SELECT p.id, s.id FROM parents p, students s WHERE p.user_id = $1 AND s.user_id = $2
       ON CONFLICT DO NOTHING`,
      [parentUserId, studentUserId],
    );
  }

  async createCourse(input: {
    title: string;
    subject: string;
  }): Promise<CourseRow> {
    const res = await this.pool.query(
      `INSERT INTO courses (title, subject) VALUES ($1, $2) RETURNING id, title, subject`,
      [input.title, input.subject],
    );
    return res.rows[0] as CourseRow;
  }

  async createClass(input: {
    name: string;
    subject: string;
    teacherUserId: string | undefined;
    studentUserIds: string[];
    roomUrl: string;
    livekitRoom: string;
  }): Promise<ClassRow> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let courseId = (
        await client.query(
          `SELECT id FROM courses WHERE subject = $1 LIMIT 1`,
          [input.subject],
        )
      ).rows[0]?.id as string | undefined;
      if (!courseId) {
        courseId = (
          await client.query(
            `INSERT INTO courses (title, subject) VALUES ($1, $2) RETURNING id`,
            [input.subject, input.subject],
          )
        ).rows[0].id as string;
      }
      let teacherId: string | undefined;
      if (input.teacherUserId) {
        teacherId = (
          await client.query(
            `INSERT INTO teachers (user_id, subject) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET subject = EXCLUDED.subject RETURNING id`,
            [input.teacherUserId, input.subject],
          )
        ).rows[0].id as string;
      }
      const classId = (
        await client.query(
          `INSERT INTO classes (name, course_id, teacher_id, room_url, livekit_room)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            input.name,
            courseId,
            teacherId ?? null,
            input.roomUrl,
            input.livekitRoom,
          ],
        )
      ).rows[0].id as string;
      for (const studentUserId of input.studentUserIds) {
        await client.query(
          `INSERT INTO students (user_id, class_id) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET class_id = EXCLUDED.class_id`,
          [studentUserId, classId],
        );
      }
      await client.query("COMMIT");
      return {
        id: classId,
        name: input.name,
        subject: input.subject,
        teacherUserId: input.teacherUserId,
        roomUrl: input.roomUrl,
        livekitRoom: input.livekitRoom,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async addClassStudents(
    classId: string,
    studentUserIds: string[],
  ): Promise<void> {
    for (const studentUserId of studentUserIds) {
      await this.pool.query(
        `INSERT INTO students (user_id, class_id) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET class_id = EXCLUDED.class_id`,
        [studentUserId, classId],
      );
    }
  }

  async listClassStudents(classId: string): Promise<UserRow[]> {
    const res = await this.pool.query(
      `SELECT u.id, u.email, u.role, u.display_name, u.created_at
         FROM students s JOIN users u ON u.id = s.user_id WHERE s.class_id = $1`,
      [classId],
    );
    return res.rows.map(toUser);
  }

  async addNote(input: {
    studentUserId: string;
    teacherUserId: string | undefined;
    note: string;
    visibility: "parent" | "admin";
    at: string;
  }): Promise<NoteRow> {
    const res = await this.pool.query(
      `INSERT INTO teacher_notes (student_id, teacher_user_id, note, visibility, at)
       SELECT s.id, $2, $3, $4, $5 FROM students s
       ON CONFLICT DO NOTHING
       RETURNING id, student_id, teacher_user_id, note, visibility, at`,
      [
        input.studentUserId,
        input.teacherUserId ?? null,
        input.note,
        input.visibility,
        input.at,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error(`no student row for user ${input.studentUserId}`);
    return {
      id: row.id,
      studentUserId: input.studentUserId,
      teacherUserId: row.teacher_user_id ?? undefined,
      note: row.note,
      visibility: row.visibility,
      at: row.at.toISOString(),
    };
  }

  async listNotes(studentUserId: string): Promise<NoteRow[]> {
    const res = await this.pool.query(
      `SELECT n.id, n.teacher_user_id, n.note, n.visibility, n.at
         FROM teacher_notes n JOIN students s ON s.id = n.student_id JOIN users u ON u.id = s.user_id
         WHERE u.id = $1 ORDER BY n.at DESC`,
      [studentUserId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      studentUserId,
      teacherUserId: r.teacher_user_id ?? undefined,
      note: r.note,
      visibility: r.visibility,
      at: r.at.toISOString(),
    }));
  }

  async listVirtualRooms(): Promise<VirtualRoomRow[]> {
    const res = await this.pool.query(
      `SELECT id, name, wam_url, purpose FROM virtual_rooms ORDER BY name`,
    );
    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      wamUrl: r.wam_url,
      purpose: r.purpose,
    }));
  }

  async createVirtualRoom(input: {
    name: string;
    wamUrl: string;
    purpose: string;
  }): Promise<VirtualRoomRow> {
    const res = await this.pool.query(
      `INSERT INTO virtual_rooms (name, wam_url, purpose) VALUES ($1, $2, $3) RETURNING id`,
      [input.name, input.wamUrl, input.purpose],
    );
    return { id: res.rows[0].id, ...input };
  }

  async createMagicToken(
    hash: string,
    email: string,
    expiresAt: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO magic_tokens (hash, email, expires_at) VALUES ($1, $2, $3)
             ON CONFLICT (hash) DO UPDATE SET email = EXCLUDED.email, expires_at = EXCLUDED.expires_at, consumed_at = NULL`,
      [hash, email, expiresAt],
    );
  }

  async consumeMagicToken(
    hash: string,
    now: number,
  ): Promise<string | undefined> {
    const res = await this.pool.query(
      `UPDATE magic_tokens SET consumed_at = $2 WHERE hash = $1 AND consumed_at IS NULL AND expires_at >= $2
             RETURNING email`,
      [hash, now],
    );
    return res.rows[0]?.email;
  }
}
