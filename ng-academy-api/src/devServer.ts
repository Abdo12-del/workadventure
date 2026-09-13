/**
 * NG Academy — أكاديمية الجيل الجديد
 * Development/demo entry point: in-memory repository pre-seeded with one
 * family, one teacher, one admin, a class and the phase-7 activities.
 * Magic-link emails are printed to the console (LogEmailTransport), so the
 * whole parent login flow works without Postgres or SMTP.
 * NEVER use in production — everything is lost on restart.
 */
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { LogEmailTransport } from "./auth/magicLink.js";
import { MemoryRepository } from "./db/memory.js";

const config = loadConfig();
const repo = new MemoryRepository();
const now = new Date().toISOString();

const parent = repo.addUser({
  id: "u-parent",
  email: "parent@ng.example",
  role: "parent",
  displayName: "ولي أمر ياسمين",
  createdAt: now,
});
const teacher = repo.addUser({
  id: "u-teacher",
  email: "hasiba@ng.example",
  role: "teacher",
  displayName: "أستاذة حسيبة",
  createdAt: now,
});
repo.addUser({
  id: "u-admin",
  email: "admin@ng.example",
  role: "admin",
  displayName: "مدير الأكاديمية",
  createdAt: now,
});
const student = repo.addUser({
  id: "u-student",
  email: "child@ng.example",
  role: "student",
  displayName: "ياسمين",
  createdAt: now,
});
repo.children.set(parent.id, [student.id]);

repo.addActivity({
  id: "a-daily-math",
  title: "تمارين الرياضيات اليومية",
  kind: "daily",
  points: 2,
});
repo.addActivity({
  id: "a-micro-read",
  title: "قراءة قصة قصيرة",
  kind: "micro",
  points: 1,
});

const classId = "c-math";
repo.addClass(
  {
    id: classId,
    name: "فصل الرياضيات",
    subject: "math",
    teacherUserId: teacher.id,
    roomUrl: "classroom-math",
    livekitRoom: "lesson-math",
  },
  [student.id],
);
repo.addSchedule({
  id: "s-1",
  classId,
  startsAt: "2026-09-14T08:00:00.000Z",
  endsAt: "2026-09-14T08:45:00.000Z",
});

const app = await buildApp({ config, repo, email: new LogEmailTransport() });
await app.listen({ port: config.PORT, host: "0.0.0.0" });
console.info(
  `ng-academy-api (memory demo) on :${config.PORT} — magic links are printed here.\n` +
    `Try: parent@ng.example / hasiba@ng.example / admin@ng.example`,
);
