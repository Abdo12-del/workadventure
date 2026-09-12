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

| المسار | الملف | السلوك عند الحجب |
| --- | --- | --- |
| `WA.nav.openTab` / `goToPage` | `front/Api/ScriptUtils.ts` | لا `window.open` ولا تنقّل؛ تحذير console |
| co-websites (الدردشة، الخصائص، الكيانات…) | `front/Stores/CoWebsiteStore.ts` `add()` | لا يُسجَّل في الـstore إطلاقًا |
| `WA.ui.openWebsite` (إنشاء وتعديل) | `front/Phaser/Game/UI/UIWebsiteManager.ts` | إنشاء: استثناء للسكربت؛ تعديل: تخطّي التغيير (بدون قتل بث rxjs) |
| مواقع مضمَّنة في الخريطة (إنشاء وتعديل) | `front/Phaser/Game/EmbeddedWebsiteManager.ts` | نفس نمط UIWebsiteManager |
| الثقة بمضيف الخريطة | `front/Phaser/Game/GameScene.ts` | `trustHost(hostname)` عند تحميل الخريطة وعند إعادة توجيه WAM |

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

| الفحص | النتيجة |
| --- | --- |
| `play` typecheck | ✅ |
| `play` eslint (الملفات المعدلة + الجديدة) | ✅ |
| `play` prettier --check | ✅ |
| `play` svelte-check | ✅ 0 أخطاء / 0 تحذيرات |
| `play` i18n:check | ✅ |
| `play` vitest (كامل) | ✅ 128 ملفًا / 867 اختبارًا (كانت 127/855) |
| generate-env-docs | ✅ متزامن |

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

| الفحص | النتيجة |
| --- | --- |
| `play` vitest (كامل) | ✅ 129 ملفًا / 912 اختبارًا (كانت 128/867) |
| `play` typecheck | ✅ |
| `play` eslint + prettier (الجديد) | ✅ |
| معاينة بصرية للمدخل والفصل (render داخلي) | ✅ تصميم طفولي نظيف |

---

## التالي: المرحلة 4 — Gino والمعلمون والرسائل المكانية

- Gino (البومة الزرقاء بقبعة التخرج) كـentity مخصصة + overlay Svelte: ترحيب عند أول دخول،
  شرح الأماكن عند الاقتراب أول مرة فقط (غير مزعج)، تهنئة عند الإنجازات.
- NPCs للمعلمين (أستاذة حسيبة…) برسائل قرب حسب المنطقة (بلا دردشة نصية حرة).
- رسائل «أنت الآن في …» لكل منطقة (مدعومة بـtooltip areas الحالية + طبقة رسائل الواجهة).
- بوابة القبول: اختبارات وحدة لتدفق رسائل Gino (مرة واحدة لكل منطقة/جلسة) + E2E يدوي لاحقًا.
