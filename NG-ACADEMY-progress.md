# NG Academy — سجل التنفيذ (Progress Log)

> الفرع: `arena/01a096db-workadventure` — يبدأ من commit `6112395`
> المرفقات: `NG-ACADEMY-خطة-التحويل.md` (تقرير الفحص والخطة)، `PROJECT-ANALYSIS-ar.md` (تحليل المستودع)

## القرارات المتفق عليها مع مالك المشروع (2026-09-12)

| القرار                | الاختيار                                                                           |
| --------------------- | ---------------------------------------------------------------------------------- |
| حزمة `ng-academy-api` | Node 24 + TypeScript + **Postgres** (+ Zod)، كـ workspace جديد ينفّذ عقد Admin API |
| دخول الطفل            | **رابط سحري** يُرسل لبريد ولي الأمر (بلا كلمة مرور للطفل)                          |
| الحصص                 | **صوت فقط** في المرحلة الأولى (LiveKit لاحقًا)                                     |
| نطاق البدء            | المرحلة 0 + 1 فورًا                                                                |

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

| الفحص                     | النتيجة                                  |
| ------------------------- | ---------------------------------------- |
| `libs/messages` typecheck | ✅ (بعد التوليد)                         |
| `libs/map-editor` vitest  | ✅ 37/37 (كانت 6 ملفات فاشلة قبل الحل)   |
| `play` typecheck          | ✅ 0 أخطاء                               |
| `play` eslint             | ✅                                       |
| `play` prettier --check   | ✅                                       |
| `play` vitest             | ✅ 127 ملفًا / 855 اختبارًا / 10 skipped |
| `play/tests/pusher`       | ✅ 22 ملفًا / 197 اختبارًا               |

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

| الفحص                           | النتيجة                     |
| ------------------------------- | --------------------------- |
| `play` typecheck                | ✅                          |
| `play` eslint (الملفات المعدلة) | ✅                          |
| `play` svelte-check             | ✅ 0 أخطاء / 0 تحذيرات      |
| `play` prettier --check         | ✅                          |
| `play` i18n:check               | ✅ كل الترجمات مكتملة       |
| `play` vitest (كامل)            | ✅ 127 ملفًا / 855 اختبارًا |
| `libs/messages` typecheck       | ✅                          |
| `libs/map-editor` vitest        | ✅ 37/37                    |

---

## المرحلة 2 — تقوية أمان الطفل (Child-safety hardening) ✅

الهدف: لا روابط خارجية، لا محتوى مضمَّن من نطاقات غير موثوقة، ولا دردشة نصية حرة — مع
إبقاء التجربة صامتة وآمنة للطفل (الحجب لا يُظهر رسائل تقنية، فقط سجل للمعلم/المطور في `console.warn`).

### السياسة الجديدة: `play/src/front/ChildSafety/ChildSafety.ts`

- متغير واحد جديد: `CHILD_SAFE_MODE` (BoolAsString، **الافتراضي true**) — أُضيف إلى
  `FrontConfigurationInterface`، validator الـpusher، قائمة `FRONT_ENVIRONMENT_VARIABLES`، و`Enum/EnvironmentVariable` في الواجهة.
- قائمة السماح الوحيدة هي **`EMBEDDED_DOMAINS_WHITELIST` الموجودة أصلًا** (يستخدمها validator
  وpusher في `verifyUrlAsDomainInWhiteList`) — أعيد استخدامها كضابط السماح للأطفال بلا ازدواجية.
- `isUrlAllowedForChildren(url)` تسمح فقط بـ: نفس النطاق (origin)، خدمات المنصة
  (PUSHER/UPLOADER/ICON/JITSI)، مضيف الخريطة الحالية (`trustHost` وقت التشغيل)، والقائمة + نطاقاتها الفرعية.
  وترفض `javascript:` و`data:` و`blob:` وأي URL غير صالح أو نطاق مشابه مخادع (`trusted.org.evil.com`).
- `warnBlocked()` + `ChildSafetyBlockedError` (يُرمَى في مسارات الـanswerer حيث الخطأ يصل للسكربت لا للطفل).

### نقاط التنفيذ (كل مسارات الفتح/التضمين)

| المسار                                    | الملف                                         | السلوك عند الحجب                                                |
| ----------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `WA.nav.openTab` / `goToPage`             | `front/Api/ScriptUtils.ts`                    | لا `window.open` ولا تنقّل؛ تحذير console                       |
| co-websites (الدردشة، الخصائص، الكيانات…) | `front/Stores/CoWebsiteStore.ts` `add()`      | لا يُسجَّل في الـstore إطلاقًا                                  |
| `WA.ui.openWebsite` (إنشاء وتعديل)        | `front/Phaser/Game/UI/UIWebsiteManager.ts`    | إنشاء: استثناء للسكربت؛ تعديل: تخطّي التغيير (بدون قتل بث rxjs) |
| مواقع مضمَّنة في الخريطة (إنشاء وتعديل)   | `front/Phaser/Game/EmbeddedWebsiteManager.ts` | نفس نمط UIWebsiteManager                                        |
| الثقة بمضيف الخريطة                       | `front/Phaser/Game/GameScene.ts`              | `trustHost(hostname)` عند تحميل الخريطة وعند إعادة توجيه WAM    |

الدردشة النصية أصلًا محكومة بـ`ENABLE_CHAT` (front + `Room.ts`) — ضُبطت افتراضيات الأطفال في `.env.template`.

### افتراضيات `.env.template` للأطفال

`CHILD_SAFE_MODE=true`، `EMBEDDED_DOMAINS_WHITELIST=` (فارغة)، `ENABLE_CHAT=false`،
`ENABLE_CHAT_UPLOAD=false`، `DISABLE_NOTIFICATIONS=true` (كانت كذلك)، `SKIP_CAMERA_PAGE=true`،
`ENABLE_REPORT_ISSUES_MENU=false` (كانت كذلك)، وPostHog/Sentry فارغة أصلًا = تحليلات خارجية معطلة.
ملاحظة: `DISABLE_ANONYMOUS` تُركت معلَّقة (`# DISABLE_ANONYMOUS=true` للإنتاج) لأن
`docker-compose-no-oidc.yaml` يعتمد على الدخول المجهول — يُفعَّل إلزاميًا في المرحلة 5 مع الرابط السحري.
أُعيد توليد `docs/others/self-hosting/env-variables.md` (صف `CHILD_SAFE_MODE` الجديد).

### اختبارات الوحدة: `play/tests/front/ChildSafety/ChildSafety.test.ts` — 12/12 ✅

نفس النطاق/النسبي ✅، خدمات المنصة ✅، القائمة + النطاقات الفرعية ✅، النطاقات المشابهة المخادعة ❌،
`javascript:`/`data:`/`blob:` ❌، URL غير صالح ❌، `trustHost` ✅، الوضع معطَّل = سماح كامل ✅،
`openTab` لا يفتح خارجي ويفتح داخلي ✅، `goToPage` محجوب ✅، `CoWebsiteStore.add` يرفض/يقبل ✅.
محاكاة env عبر `vi.hoisted` (حيّة: السياسة تقرأ القيم عند كل نداء). في `vitest.setup.ts`
جُعل `CHILD_SAFE_MODE=false` حتى لا تتأثر الاختبارات الموجودة، وبوابات الاختبار الخاصة تحاكي `true`.

### بوابة قبول المرحلة 2

| الفحص                                     | النتيجة                                    |
| ----------------------------------------- | ------------------------------------------ |
| `play` typecheck                          | ✅                                         |
| `play` eslint (الملفات المعدلة + الجديدة) | ✅                                         |
| `play` prettier --check                   | ✅                                         |
| `play` svelte-check                       | ✅ 0 أخطاء / 0 تحذيرات                     |
| `play` i18n:check                         | ✅                                         |
| `play` vitest (كامل)                      | ✅ 128 ملفًا / 867 اختبارًا (كانت 127/855) |
| generate-env-docs                         | ✅ متزامن                                  |

ملاحظة بيئة: أعادت المنصة بناء الـsandbox هذه الجولة (فُقدت `node_modules` والملفات المولَّدة)؛
استُعيد الفرع من `origin` (`git fetch` + `reset --mixed 11d333c`) وأُعيد التمهيد عبر
`./bootstrap.sh --proto-only` + `npm ci --ignore-scripts` + `patch-package` + `typesafe-i18n` —
وهو ما يثبت أن bootstrap المرحلة 0 يعمل من الصفر.

---

## المرحلة 3 — بناء عالم المدرسة (School world) ✅

**13 خريطة** كاملة بصيغة Tiled `*.tmj` + WorkAdventure Map `*.wam` (v2.1.0) داخل
`maps/ng-academy/`، مولَّدة برمجيًا عبر `maps/ng-academy/generate.mjs` (UUIDs مشتقة
من الأسماء ⇒ توليد قابل للتكرار بلا فروقات عشوائية):

- `entrance` — المدخل + الاستقبال (مكتب + سجادة ترحيب) + **الساحة** (عشب وأرائك ونباتات)؛ المحور الذي تصل منه 12 بوابة لكل الأماكن.
- الفصول السبعة: `classroom-arabic / english / math / science / chess / reading / communication` —
  سبورة + طاولة معلم + 6 طاولات تلاميذ بكراسٍ + نباتات؛ ولكل فصل **غرفة LiveKit صوتية**
  (`disableChat: true`، `startWithVideoMuted: true`) وزر «دخول الحصة» + tooltip عربي.
- `library` (منطقة **صامتة** + رفوف كتب وأرائك)، `science-lab` (طاولات تجارب + جلسة صوتية)،
  `theater` (خشبة + مقاعد جمهور + جلسة عروض)، `creativity-hall` (طاولات عمل ومجلس)،
  `achievements-hall` (جدار عرض الإنجازات — تشجيع بلا منافسة).

### قرارات تقنية

- **tileset طفولي مرسوم برمجيًا** `assets/ng-tileset.png` (16 بلاطة 32px بألوان الهوية
  سماوي/أبيض/أصفر/أخضر) — يُرسم من مخزن بكسلات داخل المولّد (sharp اختياريًا وإلا مرمّز PNG مدمج).
- طبقات العلامات (`start/collisions/silent/exit_*/from_*`) **تحت الأرضية** فلا تظهر
  مربعات `Special_Zones` الملونة في اللعبة (نفس أسلوب خريطة starter المرجعية).
- الأبواب: `exitUrl` نحو `*.wam#spawn` + طبقات ولادة مسماة بـ`startLayer: true`؛
  وكل غرفة تعود للمدخل — مغلق الحلقة بالكامل.
- لافتات عربية عبر `tooltipPropertyData` على مناطق WAM (تظهر عند الاقتراب، بلا نوافذ مزعجة).
- `.env.template`: توثيق `START_ROOM_URL=.../ng-academy/entrance.wam` (معلَّقًا؛ يفعل عند
  تشغيل حاوية الخرائط) — العالم هو الصفحة الرئيسية للطفل.

### بوابة قبول المرحلة 3

`play/tests/maps/ngAcademyMaps.test.ts` — **45 اختبارًا ✅**:

- مطابقة كل `*.wam` لمخطط `docs/schema/2.1.0/wam.json` عبر Ajv.
- سلامة TMJ: أطوال الشبكات = w×h، صور الـtileset موجودة على القرص، طبقة ولادة وطبقة
  تصادم لكل خريطة، وطبقات العلامات تحت الأرضية.
- مخطط الأبواب مغلق: 12 وجهة من المدخل بالضبط، وكل `exitUrl` لملف موجود ولكل `#spawn`
  طبقة ولادة، وكل غرفة تعود للمدخل.
- أمان الطفل: 10 غرف LiveKit بأسماء فريدة وكلها `disableChat:true` + فيديو مطفأ،
  **ولا أي URL خارجي** (`http`) في أي خريطة، والمكتبة صامتة.

| الفحص                                     | النتيجة                                    |
| ----------------------------------------- | ------------------------------------------ |
| `play` vitest (كامل)                      | ✅ 129 ملفًا / 912 اختبارًا (كانت 128/867) |
| `play` typecheck                          | ✅                                         |
| `play` eslint + prettier (الجديد)         | ✅                                         |
| معاينة بصرية للمدخل والفصل (render داخلي) | ✅ تصميم طفولي نظيف                        |

---

## المرحلة 4 — Gino والمعلمون والرسائل المكانية ✅

### الوحدات الجديدة `play/src/front/NgAcademy/`

- `NgAcademyConfig.ts`: هويات المعلمات/المعلمين (أستاذة حسيبة، أستاذة مريم، أستاذ سامي)
  مربوطة بأسماء مناطق المعلمين في الخرائط + نصوص شرح Gino لكل مكان + رسالة الترحيب.
- `GinoStore.ts`: محرك الفقاعات — فقاعة واحدة فقط على الشاشة وطابور صغير (حد 3)،
  شرح Gino وتحية المعلم **مرة واحدة لكل جلسة** (sessionStorage)، إغلاق تلقائي ويدوي،
  ولافتة الموقع «أنت الآن في: …» مخنوقة (3 ثوانٍ). `ngCelebrate()` جاهز كخطاف للمرحلة 7.
- `GinoToast.svelte`: فقاعة كلام طفولية (صورة كرتونية دائرية + اسم + نص + زر ✕)
  أسفل الوسط، وحبّة موقع صغيرة زرقاء — مبنية فوق `toastStore` القائم (بلا اختراع نظام جديد).
- `NgAreaWatcher.ts`: يربط `onEnterArea` (مناطق WAM) بالمحرك، مرة واحدة لكل تحميل صفحة.
- الوصل: سطر واحد في `GameMapPropertiesListener` بعد تسجيل مستمعي المناطق.

### الأصول

- 3 بورتريهات كرتونية للمعلمين (توليد AI ثم تصغير sharp إلى 192px/‏20-24KB — لا صور حقيقية أبدًا)
  في `play/public/static/images/ng/teachers/` + صورة Gino الموجودة أصلًا.

### الخرائط

- المولّد أصبح يسمي مناطق المعلمين `teacher-<subject>` (بدل `teacher` العامة) لتربطها
  الإعدادات بمعلم محدد؛ أُعيد توليد الـ13 خريطة.

### بوابة قبول المرحلة 4

- `play/tests/front/NgAcademy/GinoStore.test.ts` — 7 اختبارات ✅: ترحيب مرة/جلسة بعد تأخير
  استقرار، تحية معلم مرة/جلسة، شرح مرة واحدة ثم صمت، لافته موقع مخنوقة، طابور بلا تكديس
  مع إسقاط الزائد، إغلاق تلقائي بالمدة، و`ngCelebrate`.
- امتداد `ngAcademyMaps.test.ts` (+2): لكل فصل منطقة معلم مطابقة للإعدادات، وكل مفاتيح
  الشرح/المعلمين تطابق أسماء مناطق حقيقية في الخرائط.
- `play` vitest كامل ✅ 921 اختبارًا (كانت 912) | typecheck ✅ | eslint ✅ | svelte-check 0/0 ✅ | prettier ✅.

---

## المرحلة 5 — ng-academy-api (النظام الخلفي) ✅

مساحة عمل جديدة `ng-academy-api/` (Fastify + Zod + pg + TS)، مضافة إلى workspaces الجذر:

### عقد WA Admin API (ما يستدعيه الـpusher فعلًا)

- `GET /api/capabilities` → `{}` (لا إمكانات اختيارية؛ يبقى سلوك WA المحلي للبقية).
- `GET /api/map` → `MapDetailsData` لكل غرف المدرسة الـ13 (التحقق في الاختبارات عبر
  `isMapDetailsData` المستورد من `@workadventure/messages` — انطباق العقد مضمون).
- `GET /api/room/access` → دخول بوسوم الأدوار `ng-<role>` + **تسجيل الحضور صامتًا**
  عند دخول الطالب فصله (متطلب 10) + `canRecord` للمعلم/الإدارة فقط.
- `GET /api/room/tags` → مصفوفة وسوم.
- المصادقة بين الـpusher والخادم عبر `ADMIN_API_TOKEN` (401 عند غيابها).

### المصادقة والأدوار (متطلبات 5، 11، 16)

- رابط سحري لمرة واحدة (15 دقيقة، مخزّن مجزأ SHA-256) إلى بريد **ولي الأمر** فقط؛
  الاستجابة 202 دائمًا (لا تعداد حسابات)، ولا روابط لحسابات الأطفال إطلاقًا.
- `POST /ng/children/:id/session`: ولي الأمر يفتح جلسة طفله — الطفل بلا بريد/كلمة سر.
- JWT HS256 بـnode:crypto فقط (بلا اعتماد إضافي)؛ الدور يسافر كوسم WA (`ng-student`…).
- حراسة أدوار لكل مسار مدرسة: الحضور لولي الأمر/المعلم/الإدارة فقط، التسجيل للمعلم/الإدارة،
  الشارات تشجيع بلا ترتيب، وقوائم الفصول محدودة بالدور.

### قاعدة البيانات

`src/db/schema.sql` يُطبَّق عند الإقلاع (idempotent): الجداول الـ15 المطلوبة + magic_tokens،
بلا حقول هاتف/عنوان/بيانات حساسة (متطلب 11). تنفيذان للمستودع: `PgRepository` (إنتاج)
و`MemoryRepository` (اختبارات/عرض بلا Postgres).

### النشر والتشغيل

- خدمتا `ng-postgres` و`ng-academy-api` في `docker-compose.yaml` (healthcheck + traefik
  ‏ng-api.workadventure.localhost) + توثيق `ADMIN_API_URL`/`NG_MAPS_BASE_URL` في `.env.template`
  (يبقى ADMIN_API_URL فارغًا افتراضيًا حتى لا ينتظر الـpusher خادمًا غير شغال).

### بوابة قبول المرحلة 5

`ng-academy-api` vitest — **14 اختبارًا ✅** في 3 ملفات: تدفق الرابط السحري (إصدار/استهلاك
واحد/صمت الغرباء/رفض المزور)، جلسات الأطفال (ولي الأمر فقط)، عقد Admin API (capabilities،
انطباق MapDetailsData، وصول الغرفة + الحضور الصامت، 401/403)، وحراسة أدوار مسارات المدرسة.
‏`ng-academy-api` typecheck ✅ | prettier ✅ | `play` typecheck ✅ (لا تغيير في play).

---

## قرار المالك (2026-09-12): استبدال المرحلة 6

> «المرحلة 6 لا تقم بها؛ دعه يتنقل ليعرف قسمه، أو نجعل شخصية البومة تدلّهم عن طريق
> جمعهم في صف ونقلهم لغرفتهم.»
>
> ⇒ أُلغيت شاشة الرحلة/بطاقة الفصل مؤقتًا؛ بُني بدلها **الاستكشاف الحر + صف جينو**.
> رحلة الدخول التقليدية وبطاقة الفصل مؤجلتان حتى يطلبهما المالك مجددًا.

## قرار المالك (2026-09-12): حذف القطار + تنفيذ المرحلة 7

> «المرحلة 7 قم بها مع حذف فكرة القطارة اجعلها كصف عادي هو وراء بعضهم يتبعون جينو»
>
> ⇒ حُذفت فكرة «القطار» بالكامل (الكود والاختبارات وكل ذكر لها)، وبقيت الميكانيكا
> **صفًّا مدرسيًا عاديًا**: الأطفال يقفون الواحد وراء الآخر ويتبعون جينو الذي يمشي
> أمامهم على المسار نفسه. ونُفِّذت المرحلة 7 (الأنشطة والشارات والإنجازات).

## المرحلة 6 (البديلة) — الاستكشاف الحر و«صف جينو» ✅

- **الاستكشاف حر دائمًا**: لا نقل قسري؛ الطفل يتجول ويتعرف على قسمه بنفسه
  (لافتات الأماكن وشرح Gino مرة واحدة لكل مكان موجودان من المرحلة 4).
- **نقطة التجمع**: منطقة WAM `gathering` على سجادة الاستقبال في المدخل
  (tooltip: «نقطة تجمع صف جينو 🦉») — أُعيد توليد الخرائط.
- **العرض**: عند الوقوف على السجادة يعرض Gino فقاعة بأزرار (مرة كل 60 ثانية،
  ولن يعرضها وفقاعة أخرى مشغولة): بلا فصل محفوظ → «🏫 أين فصلي؟» يفتح
  `NgClassPicker.svelte` (7 أزرار كبيرة، الاختيار يُحفظ في localStorage)؛
  ومع فصل محفوظ → «🚶 أنضم إلى الصف» / «🌳 سأبقى في الساحة».
- **الصف نفسه** `NgLine.ts`: مشي نقطة-نقطة عبر `GameScene.moveTo` (pathfinding حقيقي)،
  ثم تسليم الطفل عند باب فصله عبر `onMapExit` (نفس مسار بلاطة الباب تمامًا).
  **الترتيب في الصف ناشئ طبيعيًا**: الجميع يمشي المسار نفسه، فمن انضم أولًا وقف
  أولًا — بلا حجز أماكن ولا إجبار.
- **جينو يقود من الأمام**: دالة هندسية نقية `ngLeaderPosition(path, stopIndex, lead)`
  تحسب موضع جينو على المسار قبل الطفل بـ2.5 بلاطة، ويعرضه المحقن كعلامة بومة صغيرة
  (Phaser DOMElement) تتقدم من نقطة لنقطة ثم تختفي عند الباب.
- **الخروج من الصف**: أي إدخال يدوي (أسهم/WASD/لمس الكانفاس) يوقف المتابعة صامتًا
  ويخفي علامة جينو — لا يُجرّ طفل لغرفة ضد إرادته أبدًا.
- فقاعات Gino تدعم **أزرار إجراءات** (`NgBubble.actions` + `ngBubbleAction`).
- المحقن `NgLineDriver` يجعل آلة الحالة قابلة للاختبار بلا Phaser؛
  `NgLineSceneAdapter.ts` ربط رفيع بالمشهد الحقيقي.

### بوابة قبول المرحلة 6 البديلة (بصيغة الصف)

- `NgLine.test.ts` — 7 اختبارات ✅: حفظ الفصل ورفض العبث، عرض الـpicker/الاصطفاف،
  كتم الإلحاح (60ث)، تسلسل نقاط المسار + تقدم جينو أمام كل نقطة ثم `goRoom`
  بـ`#from_entrance`، الخروج الصامت عند التدخل اليدوي، هندسة موضع القائد
  (منتصف مسار/منعطف/انتظار عند الباب)، وتغطية أبواب الفصول السبعة.
- امتداد اختبارات الخرائط (48): وجود منطقة `gathering` في المدخل.

## المرحلة 7 — الأنشطة والشارات والإنجازات ✅

**الهدف (البند 9)**: مهام صغيرة مشجعة (يومية/أسبوعية/مصغّرة) يمنحها المعلم،
فتتحول لشارات ونقاط واحتفال من جينو — تشجيع بلا منافسة ولا لوحات صدارة.

- **API** (`ng-academy-api`):
  - ‏`GET /ng/activities` — كتالوج المهام لأي مستخدم موثَّق.
  - ‏`POST /ng/activities/:activityId/complete` — المعلم/المدير/المالك فقط؛
    تمنح شارة باسم النشاط وتراكم نقاط الطفل في `child_progress` (metric=points).
  - ‏`GET /ng/my/achievements` — تغذية احتفال الطفل نفسه فقط (شاراته ونقاطه،
    لا بيانات غيره إطلاقًا).
  - رؤوس **CORS** + ‏OPTIONS preflight حتى يصل متصفح الطفل للـAPI من نطاق اللعب.
  - ‏`Repository.listActivities/completeActivity` في الذاكرة وPg معًا، وبذرة اختبار
    بنشاطين («تمارين الرياضيات اليومية» 2 نقطة، «قراءة قصة قصيرة» 1 نقطة).
- **Front** (`NgAchievements.ts`): مراقب لطيف يبدأ مع `initNgAreaWatcher`:
  - معطَّل تمامًا ما لم يُضبط `NG_API_URL` (متغير بيئة جديد عبر pusher→window.env)
    ويملك الطفل جلسة (`ng-token` من تدفق الرابط السحري).
  - استطلاع كل 60 ثانية (البند 17: أجهزة ضعيفة)؛ **أول استطلاع صامت** يسجّل
    الموجود حتى لا يُقصف الطفل بشارات قديمة، وبعدها يحتفل `ngCelebrate` بكل شارة
    جديدة مرة واحدة فقط (تُحفظ المعرفات في localStorage).
  - أي فشل (انقطاع/عطل API) صامت للطفل — console فقط.

### بوابة قبول المرحلة 7

- ‏`ng-academy-api` vitest — **19/19 ✅** (ملف جديد `activities.test.ts`: السرد
  والحراسة من المجهول، منح المعلم + تراكم النقاط، منع الطفل/ولي الأمر (403)
  ورفض المعرفات الخاطئة (404)، تغذية الطفل نفسه، وCORS preflight). typecheck ✅.
- ‏`NgAchievements.test.ts` — 4 اختبارات ✅: الصمت بلا token/بلا NG_API_URL،
  أول استطلاع صامت ثم الاحتفال بالجديد مرة واحدة، تحمّل أخطاء API + عدم تضاعف
  المؤقت، وإرسال Bearer للـAPI المضبوط فقط.
- ‏`play` vitest كامل ✅ **933 اختبارًا** | typecheck ✅ | eslint ✅ |
  svelte-check 0/0 ✅ | prettier ✅.

---

## المرحلة 8 — بوابة ولي الأمر + لوحة الإدارة ✅

**الهدف (البندان 12 و13)**: تطبيقان/مساران منفصلان بتصميم «تقليدي» للكبار فقط،
بعيدًا عن واجهة الطفل — العالم يبقى الصفحة الرئيسية للطفل (البند 19).

### ‏`ng-academy-api` — طبقة البيانات

- مساعدات وصول مشتركة `routes/access.ts` (authenticate/requireRole/canAccessStudent)
  أعيد استخدامها في school/activities/portal (معلم الفصل يصل طلابه عبر القائمة أو الحضور).
- ‏`Repository` + Memory + Pg: ‏`listUsers/createUser/linkChild/createCourse/createClass/
addClassStudents/listClassStudents/addNote/listNotes/listVirtualRooms/createVirtualRoom/
createActivity`، وجدول `teacher_notes` جديد في `schema.sql`.
- مسارات `routes/portal.ts`:
  - قائمة الفصل `GET /ng/classes/:id/students` — **كبار فقط** (الطفل لا يتصفح القوائم، بند 11).
  - ملاحظات المعلم `GET|POST /ng/students/:id/notes` — الكتابة معلم+، والقراءة
    ولي الأمر/المعلم/الإدارة؛ ملاحظات `visibility=admin` لا تصل لولي الأمر، والطفل محجوب.
  - شارات الطفل `GET /ng/students/:id/achievements` (حراسة canAccessStudent).
  - إدارة: ‏`/ng/admin/overview` (عدّادات)، ‏`/ng/admin/users` (سرد/إنشاء + ربط طفل
    بولي أمر، 409 للبريد المكرر)، ‏`/ng/admin/courses`، ‏`/ng/admin/classes`
    (إنشاء فصل + ربط معلم + طلاب — بوابة قبول المرحلة)، ‏`/ng/admin/classes/:id/students`،
    ‏`/ng/admin/activities`، ‏`/ng/admin/rooms` (سرد/إنشاء مناطق العالم).
- **تقديم البوابة من الـAPI**: ‏`PORTAL_DIST` → `@fastify/static` تحت `/portal/`
  (نطاق واحد، بلا سطح CORS إضافي).
- الرابط السحري صار يشير إلى البوابة: ‏`NG_PORTAL_URL` + الصيغة `#/login?token=…`
  (الرمز في الـhash — لا يلمس سجلات الخوادم).
- ‏`npm run dev:memory`: خادم تطوير بذاكرة مزروعة (عائلة/معلمة/مدير/فصل/أنشطة)
  وروابط الدخول تُطبع في الطرفية — بلا Postgres ولا SMTP.

### ‏`ng-academy-portal` — workspace جديد (Svelte 5 + Vite)

- ≈**24KB مضغوط** (بند 17): راوتر hash صغير بلا اعتماديات، 4 شاشات فقط:
  ‏`#/login` (رابط سحري + استهلاك تلقائي لـ`?token=`)، `#/parent` (لمحة/حضور/شارات/
  ملاحظات/فصول — أطفاله فقط)، `#/teacher` (قوائم الفصل + حضور + شارة + نشاط + ملاحظة)،
  ‏`#/admin` (تبويبات: نظرة عامة/مستخدمون/فصول ودورات/أنشطة/مناطق العالم).
- تصميم تقليدي هادئ RTL (جداول/بطاقات، أزرق ناضج `#0369a1`) — **مختلف جذريًا** عن
  عالم الطفل المرح (بند 14). بلا بيانات شخصية: أسماء أولى فقط (بند 11).
- الجلسة JWT في `ng-portal-token` (منفصل عن `ng-token` الخاص بالطفل)؛
  كل الحراسات تُفرض في الخادم والواجهة تعرض فقط.
- ‏`vite.config.ts`: ‏`base=/portal/`، proxy ‏`/ng`→‏`NG_API_PROXY` (في compose:
  ‏`ng-academy-api:3100`)، ‏`allowedHosts:true` لمعاينات التطوير.
- docker-compose: خدمة `ng-academy-portal` (vite dev على
  ‏`ng-portal.workadventure.localhost`) + ‏`PORTAL_DIST`/`NG_PORTAL_URL` لخدمة الـAPI.

### بوابة قبول المرحلة 8

- ‏`ng-academy-api` vitest — **27/27 ✅** (ملف `portal.test.ts` جديد: قائمة الفصل
  للكبار فقط، شارات الطفل لولي أمره دون الغريب، الملاحظات تصل ولي الأمر وتخفي
  الإدارية وتحجب الطفل، سيناريو الإدارة الكامل «دورة + معلم + طلاب» حتى ظهور
  الطفل الجديد في `/ng/me` لولي أمره، 409/400/403، الأنشطة والمناطق، وتقديم
  البوابة الثابتة تحت `/portal/`). typecheck ✅.
- ‏`ng-academy-portal` vitest — **10/10 ✅** (عميل API: مسارات نسبية + Bearer +
  NgApiError + تهريب المعرفات؛ الجلسة: حفظ/إسقاط صامت عند 401/بلا طلب بلا رمز/
  توجيه الأدوار — الطالب بلا بوابة؛ الراوتر: التحليل والسقوط إلى `/login`).
  ‏typecheck + svelte-check 0/0 ✅ | `vite build` ✅ (68KB خام/24KB gzip).
- ‏`play` لم تُمسّ في هذه المرحلة.

---

## المرحلة 9 — الأداء على الأجهزة الضعيفة ✅

**الهدف (البند 17)**: هواتف وأجهزة لوحية مدرسية ضعيفة — تنزيل أقل، ذاكرة أقل،
وشاشة درس سلسة. كل مكسب أدناه **مثبَّت باختبار** حتى لا ينتكس.

### 1) إخراج MediaPipe من الحزمة الرئيسية (أكبر مكسب)

- كان `createBackgroundTransformer.ts` يستورد `@mediapipe/tasks-vision` و
  ‏`@mediapipe/selfie_segmentation` **استيرادًا ثابتًا** عبر `MediaStore` — أي أن
  كل طفل ينزّل محركات تأثيرات الكاميرا (ومئات الكيلوبايتات من wasm) حتى لو لم
  يفتح كاميرته أبدًا.
- صار المصنع `async` ويحمّل المحركين عبر `await import()` — vite/rolldown يفصلهما
  تلقائيًا في حزمتين عند الطلب. **الدليل من بناء إنتاجي حقيقي**:
  ‏`MediaPipeTasksVisionTransformer-*.js` (148KB) و`MediaPipeBackgroundTransformer-*.js`
  (52KB) صارا حزمتين منفصلتين، وعدد حدوث `ImageSegmenter/SelfieSegmentation` في
  حزمة اللعبة الرئيسية = **صفر**. (موضع الاستدعاء الوحيد داخل
  ‏`runLocalVideoTrackUpdate` المسلسل عبر `localStreamUpdateQueue` — لا سباق.)

### 2) الخرائط: توليد مضغوط (minified)

- ‏`generate.mjs` كان يكتب TMJ منسّقًا سطرًا لكل بلاطة: خريطة المدخل **294KB**
  (26 ألف سطر!). صارت مضغوطة: ‏**58KB**، ومجلد الخرائط كله من 684KB إلى
  ‏**181KB** (‎-73%‎) — وكلها تُنزَّل على جهاز الطفل عند التجول.
- اختبارات الخرائط الـ48 ما تزال خضراء بعد إعادة التوليد.

### 3) افتراضيات بيئة أخف (القوالب + الافتراضات المبرمجة معًا)

- ‏`MAX_DISPLAYED_VIDEOS`: ‏16 → **4** (في `.env.template` وفي افتراضي
  `EnvironmentVariableValidator` معًا) — فصل أطفال على أجهزة لوحية لا يعرض
  16 بث فيديو أبدًا.
- ‏`LIVEKIT_PIXEL_DENSITY`: ‏0.667 → **0.5** — توفير كبير على معالجات الرسوم
  الضعيفة بلا فرق ملحوظ على شاشة صغيرة.
- الموجود مسبقًا ويُحفظ: ‏`DISABLE_NOTIFICATIONS=true`، ‏`ENABLE_CHAT=false`،
  ‏`SKIP_RENDER_OPTIMIZATIONS=false`، واستطلاع إنجازات NG كل 60 ثانية
  (‏`NG_ACHIEVEMENTS_POLL_MS` صار ثابتًا مُصدَّرًا).

### 4) ميزانية أصول مفروضة باختبار — `ngPerfBudget.test.ts` (5 اختبارات)

- صور NG: ≤100KB للصورة، ≤400KB للمجموع (الواقع: 172KB).
- الخرائط: ≤8KB لكل WAM، ≤64KB لكل TMJ، ≤400KB للمجموع، والمدخل مضغوط
  (سطر واحد) — إعادة تنسيق المولّد ستكسر الاختبار فورًا.
- حراسة المصدر: لا استيراد ثابت لـ`@mediapipe` أو لوحدات MediaPipe في كامل
  `play/src/front` خارج `BackgroundProcessor`، والمحركان خلف `await import()`.
- ‏`.env.template`: القيم الخفيفة أعلاه مثبتة نصًا.
- الاستطلاع ≥ 60 ثانية.

### بوابة قبول المرحلة 9

- ‏`play` vitest كامل — **938 اختبارًا ✅** (933 + 5 ميزانية) | typecheck ✅ |
  eslint ✅ | svelte-check 0/0 ✅ | prettier ✅ | **بناء إنتاجي ✅ (15.5 ثانية)**
  مع دليل فصل الحزم أعلاه. ‏`ng-academy-api` 27/27 و`ng-academy-portal` 10/10
  لم يتغيرا (لم تُمسّا).

### قائمة فحص «جهاز ضعيف» للتجربة اليدوية (خارج الصندوق)

1. هاتف/جهاز لوحي متوسط أو Chrome DevTools مع CPU throttling ×6 وشبكة "Fast 3G".
2. افتح عالم المدرسة: زمن أول ظهور قابل للعب، والتجول بين 4 خرائط متتالية بلا تجميد.
3. ‏FPS داخل الفصل المزدحم ≥ 30 (مؤشر `--fps` أو DevTools Performance).
4. تحقق في DevTools→Network أن حزم MediaPipe **لا تُنزَّل** ما دامت تأثيرات
   الكاميرا مغلقة (وهي مغلقة افتراضيًا للأطفال).
5. ذاكرة التبويب بعد 10 دقائق تجول مستقرة (لا تسريب من فقاعات جينو/الصف).

---

## التالي: المرحلة 10 — الاختبار الشامل والتوثيق والنشر

- ‏E2E لرحلة الطفل الكاملة (دخول → جينو → صف → حصة → نشاط → شارة → قاعة الإنجازات)،
  تحديث README/UPGRADE/docs بعلامة NG Academy، وcompose/Helm للإنتاج.
