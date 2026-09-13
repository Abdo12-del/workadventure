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
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashToken, LogEmailTransport } from "./auth/magicLink.js";
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
repo.addUser({
  id: "u-owner",
  email: "owner@ng.example",
  role: "owner",
  displayName: "مالك الأكاديمية",
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

/* The school itself: the 13 generated maps, pre-registered as managed world
 * zones so the admin/owner dashboard shows the real world out of the box. */
const NG_ROOMS: [string, string, string][] = [
  [
    "entrance.wam",
    "المدخل والاستقبال",
    "بوابة المدرسة والساحة ونقطة تجمع صف جينو.",
  ],
  ["classroom-arabic.wam", "فصل اللغة العربية", "حصة صوتية مشرفة + ركن قراءة."],
  [
    "classroom-english.wam",
    "فصل اللغة الإنجليزية",
    "حصة صوتية مشرفة + طاولة حواسيب.",
  ],
  [
    "classroom-math.wam",
    "فصل الحساب",
    "حصة صوتية + ركن المعداد التفاعلي لكل طالب.",
  ],
  ["classroom-science.wam", "فصل العلوم", "حصة صوتية + كرات أرضية ومجسمات."],
  [
    "classroom-chess.wam",
    "فصل الشطرنج",
    "حصة صوتية + طاولات الشطرنج (قريبًا: منافسة ودّية).",
  ],
  [
    "classroom-reading.wam",
    "فصل القراءة والكتابة",
    "حصة صوتية + رفوف ومنطقة قراءة.",
  ],
  [
    "classroom-communication.wam",
    "فصل مهارات التواصل",
    "حصة صوتية + طاولة عرض وتقديم.",
  ],
  ["library.wam", "المكتبة", "منطقة صامتة للقراءة الحرة."],
  ["science-lab.wam", "مختبر العلوم", "استكشاف وتجارب بإشراف الأستاذ."],
  ["theater.wam", "المسرح", "خشبة وستارة وعروض الصف."],
  ["creativity-hall.wam", "قاعة الإبداع", "مشاريع وفن وأنشطة حرة مشرفة."],
  [
    "achievements-hall.wam",
    "قاعة الإنجازات",
    "شارات وميداليات ومنصة تتويج ودّية.",
  ],
];
for (const [file, name, purpose] of NG_ROOMS) {
  await repo.createVirtualRoom({
    name,
    wamUrl: `http://map-storage.workadventure.localhost/ng-academy/${file}`,
    purpose,
  });
}

const app = await buildApp({ config, repo, email: new LogEmailTransport() });

/* ------------------------------------------------------------------ *
 * Demo-only back door: one-click entry while the school is still being
 * built. devServer.ts is NEVER the production entry (server.ts is), so
 * these routes cannot exist in a real deployment; the portal only shows
 * its demo buttons when GET /ng/dev/magic-link answers, which happens
 * exclusively here.
 * ------------------------------------------------------------------ */
const DEMO_EMAILS: Record<"parent" | "teacher" | "admin" | "owner", string> = {
  parent: "parent@ng.example",
  teacher: "hasiba@ng.example",
  admin: "admin@ng.example",
  owner: "owner@ng.example",
};

app.get("/ng/dev/magic-link", async () => ({ demo: true }));

app.post("/ng/dev/magic-link", async (req, reply) => {
  const body = z
    .object({ role: z.enum(["parent", "teacher", "admin", "owner"]) })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send({ error: "bad role" });
  const token = randomBytes(24).toString("base64url");
  await repo.createMagicToken(
    hashToken(token),
    DEMO_EMAILS[body.data.role],
    Date.now() + config.MAGIC_LINK_TTL_MS,
  );
  return reply.send({ token });
});

await app.listen({ port: config.PORT, host: "0.0.0.0" });
console.info(
  `ng-academy-api (memory demo) on :${config.PORT} — magic links are printed here.\n` +
    `Try: parent@ng.example / hasiba@ng.example / admin@ng.example`,
);
