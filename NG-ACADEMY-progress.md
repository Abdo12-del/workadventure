# NG Academy — سجل التنفيذ (Progress Log)

> الفرع: `arena/01a096db-workadventure` — يبدأ من commit `6112395`
> المرفقات: `NG-ACADEMY-خطة-التحويل.md` (تقرير الفحص والخطة)، `PROJECT-ANALYSIS-ar.md` (تحليل المستودع)

## القرارات المتفق عليها مع مالك المشروع (2026-09-12)

| القرار | الاختيار |
| --- | --- |
| حزمة `ng-academy-api` | Node 24 + TypeScript + **Postgres** (+ Zod)، كـ workspace جديد ينفّذ عقد Admin API |
| دخول الطفل | **رابط سحري** يُرسل لبريد ولي الأمر (بلا كلمة مرور للطفل) |
| الحصص | **صوت فقط** في المرحلة الأولى (LiveKit لاحقًا) |
| نطاق البدء | المرحلة 0 + 1 فورًا |

---

## المرحلة 0 — تهيئة البيئة وخط الأساس ✅

**المشكلة:** الكود المولَّد من `messages/protos/*.proto` غير مضمَّن في git؛ وبدونه تفشل كل الفحوص
(`Cannot find module './ts-proto-generated/messages'`)، و`npm ci` داخل `messages/` يفشل لأن
`grpc-tools` ينزّل ثنائيته من GitHub releases (محجوب هنا) ولا يُبنى على Node الحديث.

**الحل المُثبَّت في المستودع:**
- `bootstrap.sh` (جديد، قابل للتشغيل عبر `npm run bootstrap` / `npm run bootstrap -- --proto-only`):
  1. ينشئ `.env` من القالب إن غاب؛
  2. يولّد رسائل Protobuf بترتيب: `protoc` النظام ← خدمة `messages` في docker compose ← حزمة npm
     باسم `protoc` (توزيع غير معدّل لثنائية protoc الرسمية، Apache-2.0) داخل `.bootstrap-tools/` (متجاهَل في git)؛
  3. يثبّت الـworkspaces مع إعادة محاولة `--ignore-scripts --strict-ssl=false` للشبكات المقيدة؛
  4. يولّد ملفات `typesafe-i18n`.
- `.gitignore`: إضافة `.bootstrap-tools/`.
- `package.json` (جذر): سكربتا `bootstrap` و`bootstrap:proto`.
- `docs/agent/dev-setup.md`: توثيق الخطوة ولماذا ليست اختيارية + ملاحظة الشبكات المقيدة.

**خط الأساس المقاس (قبل أي تعديل):**

| الفحص | النتيجة |
| --- | --- |
| `libs/messages` typecheck | ✅ (بعد التوليد) |
| `libs/map-editor` vitest | ✅ 37/37 (كانت 6 ملفات فاشلة قبل الحل) |
| `play` typecheck | ✅ 0 أخطاء |
| `play` eslint | ✅ |
| `play` prettier --check | ✅ |
| `play` vitest | ✅ 127 ملفًا / 855 اختبارًا / 10 skipped |
| `play/tests/pusher` | ✅ 22 ملفًا / 197 اختبارًا |

**قيود البيئة المسجّلة:** لا Docker ولا وصول مباشر لـGitHub؛ لذا تُثبَّت الاعتماديات بـ`--ignore-scripts`
(لا تُبنى الوحدات الأصلية `node-datachannel`/`uWebSockets.js`) — كافٍ للفحوصات والاختبارات،
ولتشغيل الخادم فعليًا يلزم `docker compose up` على آلة كاملة.

---

## المرحلة 1 — الهوية الكاملة: NG Academy ✅

### الأصول البصرية (مصدرها `brand/`، والتوليد عبر `brand/generate-assets.sh`)
- `brand/app-mark.svg`: علامة التطبيق المتجهية — جينو (بومة زرقاء بقبعة تخرج) على مربع مستدير `#38b6ff`.
- `brand/logo-lockup-white.svg`: الشعار الأفقي الأبيض (/owl + NG Academy) لشاشات الدخول/الأخطاء.
- `brand/gino-logo-source.png`: فن شخصية جينو (للاستخدام داخل العالم وشاشات الترحيب).
- أُعيد توليد **كل** الأيقونات بأسماء الملفات القديمة نفسها (صفر تعديل كود): 47 favicon/apple/android/ms،
  `favicon.ico` متعدد المقاسات، `favicon-512x512.svg` متجهي، `logo.png`، `logo-WA-min.png`، `logo-wa-2.png`،
  `icon-workadventure-white.png`، وحركة التحميل `Workadventure.gif` (جينو يقفز).
- ميزانية أداء: مجلد favicons كله **280KB** و`brand/ng` **108KB** (الأصل كان 83KB لأشكال مسطحة؛
  الزيادة مقابل أيقونة ملونة حقيقية لكل المقاسات، مع quantization لكل الملفات).
- أصول إضافية جديدة: `play/public/static/images/ng/{gino.png,gino-white.png,icon-1024.png,logo-white.svg}`.

### الكود
- `play/src/common/Brand.ts` (جديد): مصدر الحقيقة للهوية (الاسمان العربي/اللاتيني، الألوان، الأيقونات، اللغة الافتراضية).
- `play/src/pusher/services/MetaTagsBuilder.ts`: القيم الافتراضية ← NG Academy (عنوان، وصف عربي، `#38b6ff`، أيقونات محلية بدل صورة workadventu.re الخارجية).
- `play/src/pusher/controllers/FrontController.ts`: الـmanifest الديناميكي ← `lang: ar`، `dir: rtl`، خلفية بيضاء، وإزالة `related_applications` التي كانت تشير لمواقع WorkAdventure.
- `libs/messages/src/JsonMessages/MapDetailsData.ts`: افتراضيات وأمثلة مخطط MetaTags ← NG Academy.
- `libs/tailwind/style/index.css`: لوحة `ng-*` (blue/sky/ink/sun/leaf/coral/cream) إضافةً غير كاسرة.
- `play/public/static/images/favicons/manifest.json`: اسم/وصف/لغة/ألوان NG + `related_applications: []`.
- إزالة شارة "Powered by WorkAdventure": حُذفت الكتلتان والاستيرادان من `LoginScene.svelte` و`PwaInstallScreen.svelte` وحُذفت صورتا الشارة.
- i18n: استبدال **503 مواضع** لسلسلة "WorkAdventure" داخل نصوص الواجهة في **112 ملف ترجمة** (17 لغة) بـ"NG Academy" + تصحيحات متفرقة (اسم جهاز Matrix، رسالة ModalEvent، رسالة MapValidator واختبارها).
- `.env.template`: `FALLBACK_LOCALE=ar-SA` (العربية أولًا، وRTL يُفعَّل تلقائيًا من `locales.ts`).

### بوابة قبول المرحلة 1 (بعد التعديلات)

| الفحص | النتيجة |
| --- | --- |
| `play` typecheck | ✅ |
| `play` eslint (الملفات المعدلة) | ✅ |
| `play` svelte-check | ✅ 0 أخطاء / 0 تحذيرات |
| `play` prettier --check | ✅ |
| `play` i18n:check | ✅ كل الترجمات مكتملة |
| `play` vitest (كامل) | ✅ 127 ملفًا / 855 اختبارًا |
| `libs/messages` typecheck | ✅ |
| `libs/map-editor` vitest | ✅ 37/37 |

---

## التالي: المرحلة 2 — تقوية أمان الطفل (Child-safety hardening)

- افتراضيات `.env` آمنة: `ENABLE_CHAT=false`، `ENABLE_CHAT_UPLOAD=false`، `DISABLE_NOTIFICATIONS=true`،
  `ENABLE_REPORT_ISSUES_MENU=false`، `DISABLE_ANONYMOUS=true` (مع مسار الرابط السحري لاحقًا)، `SKIP_CAMERA_PAGE=true`.
- تعطيل PostHog/Analytics الخارجية افتراضيًا لبيانات الأطفال.
- قائمة نطاقات مسموحة للمحتوى المضمَّن + `hideUrl` في مناطق `openWebsite`.
- اختبارات E2E/وحدة تثبت: لا دردشة خاصة، لا روابط خارجية، لا إشعارات متصفح.

ثم المرحلة 3: بناء عالم المدرسة (خرائط Tiled+WAM للمدخل والفصول السبعة والمكتبة والمختبر والمسرح والإنجازات والساحة).
