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
  ActivityRow,
  AttendanceKind,
  AttendanceRow,
  ClassRow,
  ProgressRow,
  Repository,
  ScheduleRow,
  UserRow,
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
