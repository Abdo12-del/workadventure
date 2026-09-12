# ng-academy-api — النظام الخلفي لأكاديمية الجيل الجديد

مساحة عمل Node + TypeScript + Postgres + Zod تنفّذ شيئين:

1. **عقد WA Admin API** الذي يستدعيه الـpusher (`play/src/pusher/services/AdminApi.ts`):
   - `GET /api/capabilities` — لا إمكانات اختيارية (يبقى سلوك WA المحلي للبقية).
   - `GET /api/map?playUri=` — يعيد `MapDetailsData` لكل غرف المدرسة الـ13
     (يُتحقق منه باختبارات عبر `isMapDetailsData` من `@workadventure/messages`).
   - `GET /api/room/access` — يمنح الدخول مع وسوم الأدوار (`ng-student`…) ويسجّل
     **الحضور صامتًا** عند دخول الطالب فصله (متطلب 10).
   - `GET /api/room/tags` — مصفوفة وسوم الغرفة.
2. **خدمات المدرسة (NG)**:
   - `POST /ng/auth/magic-link` — رابط دخول لمرة واحدة (15 دقيقة) إلى بريد **ولي الأمر**
     (لا روابط لحسابات الأطفال؛ الاستجابة 202 دائمًا لمنع تعداد الحسابات).
   - `POST /ng/auth/magic-link/verify` — يستهلك الرابط ويصدر JWT (وسم الدور داخله).
   - `POST /ng/children/:id/session` — ولي الأمر يفتح جلسة طفله (الطفل بلا بريد/كلمة سر).
   - `GET /ng/me`، `GET /ng/classes` (محدودة بالدور)،
     `GET /ng/students/:id/attendance` (ولي الأمر/المعلم/الإدارة فقط)،
     `POST /ng/classes/:id/attendance` (معلم/إدارة)،
     `POST /ng/students/:id/badges` (تشجيع بلا منافسة)،
     `GET /ng/students/:id/progress`.

## قاعدة البيانات

`src/db/schema.sql` (يُطبَّق عند الإقلاع): users, profiles, students, parents,
teachers, courses, classes, schedules, attendance, activities, badges,
achievements, child_progress, virtual_rooms, virtual_events + magic_tokens.
لا حقول هاتف/عنوان/بيانات حساسة للأطفال (متطلب 11).

## التشغيل

```bash
docker compose up -d ng-postgres ng-academy-api
# ثم في .env:
# ADMIN_API_URL=http://ng-academy-api:3100
```

محليًا بلا docker: الاختبارات تعمل بالكامل بذاكرة داخلية (`MemoryRepository`)
وبريد مُلتقَط (`CapturingEmailTransport`) — بلا Postgres ولا SMTP.

## الاختبارات

```bash
npm test -w ng-academy-api   # 14 اختبارًا: تدفق الرابط السحري، جلسات الأطفال،
                             # عقد Admin API، وحراسة الأدوار لكل مسار مدرسة
```

## الأنشطة والشارات (المرحلة 7)

- ‏`GET /ng/activities` — كتالوج المهام (يومي/أسبوعي/مصغّر) لأي مستخدم موثَّق.
- ‏`POST /ng/activities/:activityId/complete` بجسم `{ "studentUserId": "..." }` —
  للمعلم/المدير/المالك فقط؛ يمنح شارة باسم النشاط ويضيف نقاطه إلى تقدم الطفل.
- ‏`GET /ng/my/achievements` — شارات ونقاط صاحب الجلسة فقط (بلا صدارة وبلا بيانات آخرين).
- الـAPI يرسل رؤوس CORS (`Access-Control-Allow-Origin: *` + معالجة OPTIONS) حتى
  يستطيع متصفح الطفل الاستطلاع من نطاق الواجهة (متغير `NG_API_URL` في pusher).
- لإضافة مهام في Postgres:‏ `INSERT INTO activities (title, kind, points) VALUES ('...', 'daily', 2);`
