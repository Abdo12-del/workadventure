-- NG Academy — أكاديمية الجيل الجديد
-- School database schema (requirement 16). Idempotent: applied at boot.
-- Roles: student / parent / teacher / admin / owner (mirrored as WA JWT tags).

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL CHECK (role IN ('student','parent','teacher','admin','owner')),
    display_name TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    avatar_url  TEXT,
    birth_year  INTEGER,
    -- Child-safe: NO phone, NO personal email beyond the account email, NO address.
    favorite_color TEXT
);

CREATE TABLE IF NOT EXISTS teachers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    subject     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    subject     TEXT NOT NULL,
    teacher_id  UUID REFERENCES teachers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS classes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id   UUID REFERENCES teachers(id) ON DELETE SET NULL,
    room_url     TEXT NOT NULL,
    livekit_room TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    class_id    UUID REFERENCES classes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS parents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_students (
    parent_id   UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL
);

-- Attendance is invisible to the child (requirement 10): only parent/teacher/admin read it.
CREATE TABLE IF NOT EXISTS attendance (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('enter','exit','participation')),
    at            TIMESTAMPTZ NOT NULL,
    recorded_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('daily','weekly','micro')),
    points      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL
);

-- Encouragement, never competition (requirement 9): no leaderboards, no ranks.
CREATE TABLE IF NOT EXISTS achievements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL DEFAULT '',
    granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS child_progress (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    metric      TEXT NOT NULL,
    value       INTEGER NOT NULL,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, metric)
);

CREATE TABLE IF NOT EXISTS virtual_rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    wam_url     TEXT NOT NULL,
    purpose     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS virtual_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          TEXT NOT NULL,
    virtual_room_id UUID NOT NULL REFERENCES virtual_rooms(id) ON DELETE CASCADE,
    starts_at      TIMESTAMPTZ NOT NULL,
    ends_at        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_tokens (
    hash        TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    expires_at  BIGINT NOT NULL,
    consumed_at BIGINT
);

CREATE INDEX IF NOT EXISTS attendance_student_idx ON attendance(student_id, at);
CREATE INDEX IF NOT EXISTS schedules_class_idx ON schedules(class_id, starts_at);
