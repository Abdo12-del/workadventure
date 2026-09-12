/**
 * Shared test fixtures: an in-memory school with one family and one class.
 */
import { loadConfig, type NgConfig } from "../src/config.js";
import { MemoryRepository } from "../src/db/memory.js";
import { CapturingEmailTransport } from "../src/auth/magicLink.js";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";
import type { UserRow } from "../src/db/types.js";

export interface Seed {
  app: FastifyInstance;
  repo: MemoryRepository;
  email: CapturingEmailTransport;
  config: NgConfig;
  parent: UserRow;
  otherParent: UserRow;
  teacher: UserRow;
  student: UserRow;
  classId: string;
}

export async function seedSchool(): Promise<Seed> {
  const config = loadConfig({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
  const repo = new MemoryRepository();
  const email = new CapturingEmailTransport();

  const parent = repo.addUser({
    id: "u-parent",
    email: "parent@ng.example",
    role: "parent",
    displayName: "ولي الأمر",
    createdAt: new Date().toISOString(),
  });
  const otherParent = repo.addUser({
    id: "u-parent2",
    email: "parent2@ng.example",
    role: "parent",
    displayName: "ولي أمر آخر",
    createdAt: new Date().toISOString(),
  });
  const teacher = repo.addUser({
    id: "u-teacher",
    email: "hasiba@ng.example",
    role: "teacher",
    displayName: "أستاذة حسيبة",
    createdAt: new Date().toISOString(),
  });
  const student = repo.addUser({
    id: "u-student",
    email: "child@ng.example",
    role: "student",
    displayName: "ياسمين",
    createdAt: new Date().toISOString(),
  });
  repo.children.set(parent.id, [student.id]);

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
    startsAt: "2026-09-13T08:00:00.000Z",
    endsAt: "2026-09-13T08:45:00.000Z",
  });

  const app = await buildApp({ config, repo, email });
  return {
    app,
    repo,
    email,
    config,
    parent,
    otherParent,
    teacher,
    student,
    classId,
  };
}

/** Child session opened by the parent (children never handle magic links). */
export async function childSessionToken(
  seed: Seed,
  childId: string,
): Promise<string> {
  const parentToken = await loginToken(seed, "parent@ng.example");
  const res = await seed.app.inject({
    method: "POST",
    url: `/ng/children/${childId}/session`,
    headers: { authorization: `Bearer ${parentToken}` },
  });
  if (res.statusCode !== 200)
    throw new Error(`child session failed: ${res.statusCode} ${res.body}`);
  return (res.json() as { token: string }).token;
}

export async function loginToken(seed: Seed, email: string): Promise<string> {
  const requested = await seed.app.inject({
    method: "POST",
    url: "/ng/auth/magic-link",
    payload: { email },
  });
  if (requested.statusCode !== 202)
    throw new Error(`magic-link request failed: ${requested.statusCode}`);
  const mails = seed.email.sent.filter((m) => m.to === email);
  const mail = mails[mails.length - 1];
  if (!mail) throw new Error(`no email captured for ${email}`);
  const token = /token=([A-Za-z0-9_-]+)/.exec(mail.body)?.[1];
  if (!token) throw new Error("no token in email body");
  const verified = await seed.app.inject({
    method: "POST",
    url: "/ng/auth/magic-link/verify",
    payload: { token },
  });
  if (verified.statusCode !== 200)
    throw new Error(`verify failed: ${verified.statusCode}`);
  return (verified.json() as { token: string }).token;
}
