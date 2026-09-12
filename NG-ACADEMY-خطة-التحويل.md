# NG Academy — تقرير الفحص وخطة التحويل
### تحويل WorkAdventure إلى مدرسة افتراضية تعليمية للأطفال (6–12 سنة)

> **حالة المستودع:** نظيف، لم يُعدَّل أي ملف حتى الآن (تنفيذًا للبند 20).
> **الفرع:** `arena/01a096db-workadventure` — **آخر commit:** `6112395`
> **تاريخ التقرير:** 2026-09-12

---

## الجزء الأول: الفحص (10 نقاط مطلوبة)

### 1) بنية المشروع الحالية

Monorepo (npm workspaces) مبني على **خدمات مصغّرة** تعمل خلف `Traefik`:

```
المتصفح
  │  HTTPS
  ▼
Traefik v3 ──▶ play (front + pusher + room-api)   ← الطفل يعيش هنا
          ──▶ back (gRPC: Worlds / Rooms / Spaces)
          ──▶ map-storage (تخزين الخرائط WAM + محرر)
          ──▶ uploader (ملفات مؤقتة Redis/S3)
          ──▶ maps (خرائط جاهزة عبر Apache/PHP)
          ──▶ Redis 6 (pub/sub + متغيرات + كاش)
          ──▶ Synapse/Matrix (الدردشة)
          ──▶ oidc-server-mock (تسجيل الدخول في التطوير)
          ──▶ icon server
```

**توزيع الكود (~275 ألف سطر TS/Svelte):**

| المكوّن | الأسطر | الوظيفة |
| --- | --- | --- |
| `play/src/front` | ~143,000 | تطبيق المتصفح: Svelte 5 (UI) + Phaser 4 (العالم) |
| `play/src/pusher` | ~17,000 | خادم WebSocket/HTTP الوسيط بين المتصفح و`back` وAdmin API |
| `back/src` | ~13,000 | منطق الغرف/العوالم والمواضع (gRPC + uWebSockets) |
| `map-storage/src` | ~5,500 | تخزين الخرائط، الكيانات، المناطق، S3 |
| `libs/*` | ~6,000+ | `messages` (Protobuf+Zod)، `map-editor`، `shared-utils`، `tailwind`… |
| `uploader/src` | ~700 | رفع الملفات |
| `tests/` | 75 spec | Playwright E2E |

**نقطة بنيوية حاسمة للمشروع:** لا توجد قاعدة بيانات علائقية إطلاقًا. المنصّة **stateless by design** — كل ما هو "حسابات، مستخدمون، خرائط مسموحة، أفاتارات" يأتي من **Admin API خارجية** (انظر §4 و§5). هذا في صالحنا: يعني أن طبقة "المدرسة" (طلاب/معلمون/دورات/حضور/شارات) يجب أن تُبنى كخدمة جديدة **بدون تعديل جوهر المحرك**.

---

### 2) التقنيات المستخدمة

| الطبقة | التقنية |
| --- | --- |
| اللغة | TypeScript 5.9 (ESM) في كل المستودع، Node 24 في CI |
| الواجهة | **Svelte 5** (runes: `$state/$derived/$props/$effect`) + **Tailwind CSS 4** + `@workadventure/design-system` |
| المحرك ثنائي الأبعاد | **Phaser 4.2.0** (مع patch محلي `patches/phaser+4.2.0.patch`) + `phaser4-rex-plugins` + `easystarjs` (إيجاد المسار) |
| البناء | Vite (`play/vite.config.ts`)، `tsx` للتشغيل الخادمي |
| الخوادم | `express 5` + `hyper-express` + `uWebSockets.js` (pusher)، `@grpc/grpc-js` (back) |
| العقود | **Protobuf** (`messages/protos`) + **Zod 3** + `@anatine/zod-openapi` (Swagger) |
| الصوت/الفيديو | **LiveKit** (SFU، مُوصى به) أو WebRTC P2P (`@workadventure/simple-peer`) أو Jitsi/BBB |
| الدردشة | Matrix (`matrix-js-sdk`) + دردشة القرب (Proximity) |
| المصادقة | OIDC (`openid-client`, `jose`) + JWT داخلي + وضع مجهول |
| التخزين | Redis 6، S3 (`@aws-sdk/client-s3`، RustFS محليًا)، نظام ملفات |
| المعالجة الصورية | TensorFlow.js + MediaPipe (خلفيات افتراضية/تشويش) |
| i18n | `typesafe-i18n` — **17 لغة منها `ar-SA`** مع دعم RTL مدمج |
| الاختبارات | Vitest (163 ملف وحدة) + Playwright (75 spec) + Artillery (حمل) |
| النشر | Docker Compose (6 تركيبات) + Helm chart + صور متعددة المعماريات |
| المراقبة | Sentry + Prometheus (`prom-client`) + PostHog + خط تحليلات جديد |

**ملاحظة مهمة للعربية:** `play/src/front/Utils/locales.ts` يضبط `document.documentElement.dir = "rtl"` عند `ar-SA` تلقائيًا، ويوجد `FALLBACK_LOCALE` في البيئة — أي أن العربية مدعومة بنيويًا وليست ترقيعًا.

---

### 3) أهم المكوّنات الموجودة

**أ) محرك العالم (`play/src/front/Phaser`)**
- `Game/GameScene.ts` (4,670 سطر): المشهد الرئيسي — الحركة، التصادم، الفقاعات، المناطق.
- `Game/GameManager.ts`: إدارة الانتقال بين الغرف/الخرائط (`exitUrl` → مشهد جديد).
- `Game/GameMap/` + `GameMapFrontWrapper.ts` (1,782 سطر): قراءة خريطة Tiled وخصائصها.
- `Game/AreasPropertiesListener.ts` (2,111 سطر): **قلب "المكان يؤثر على التفاعل"** — ينفّذ خصائص المناطق (Jitsi/LiveKit/موقع/صوت/ميجا فون…).
- `Entity/Character.ts` + `Player/` + `Companion/`: الشخصيات والحيوان المرافق.
- `Login/`: `EntryScene → LoginScene → SelectCharacterScene → SelectCompanionScene → EnableCameraScene → GameScene` — **وهي بالضبط سلسلة "رحلة الطفل" المطلوبة**.

**ب) Pusher (`play/src/pusher`)** — 17 controller و~45 خدمة: `IoSocketController` (WebSocket)، `AuthenticateController`، `WokaListController`، `MapController`، `LivekitWebhookController`، `SocketManager` (1,700+ سطر)، `JWTTokenManager`، `AdminApi/AdminService/LocalAdmin`، `RedisClient`، `ShutdownDrains`، وطابور التحليلات الجديد.

**ج) نظام المناطق/الكيانات (`libs/map-editor`)** — صيغة **WAM** التي تسمح بإضافة مناطق وكيانات فوق خريطة Tiled دون تعديلها، مع هجرات (Migrations) وصلاحيات وأوامر (Commands).

**د) Scripting API (`play/src/iframe_api.ts` + `play/src/front/Api`)** — مساحات: `WA.ui` (بما فيها **UIWebsite** و`openPopup` و`displayBubble` و`registerMenuCommand`)، `WA.room` (مناطق/طبقات/كيانات + `onEnterZone`)، `WA.player`/`WA.players`، `WA.nav`، `WA.chat`، `WA.sound`، `WA.camera`، `WA.spaces`، `WA.state`، `WA.event`، `WA.mapEditor`. **هذه أداتنا الأساسية لبناء جينو والأنشطة والحصص دون لمس المحرك.**

**هـ) التخصيص (Woka)** — `play/src/pusher/data/woka.json` يحتوي محليًا: 24 شخصية كاملة + 33 جسم + 30 عين + **74 تسريحة** + **74 لباس** + 27 قبعة + 34 إكسسوار، والصور في `play/public/resources/customisation/character_*` و`resources/characters/pipoya`. **يعمل دون Admin API** عبر `LocalWokaService` — أي أننا نملك نظام اختيار شخصية/شعر/ملابس/ألوان/إكسسوار **جاهزًا** ونستبدل الفن فقط.

**و) الدردشة والإشراف** — `Chat/` (Matrix + Proximity + Void)، `ReportMenu` (إبلاغ/حظر)، `BanMessage`، `MatrixRoomPowerLevels`، وخاصيتا `readableBy`/`writableBy` و`restrictedRights` على مستوى الخريطة/المنطقة.

**ز) لوحة الإدارة الحالية** — `play/src/front/Administration/` هي أدوات **داخل العالم** (ميجا فون، متغيرات، مناطق شخصية، مستخدمون) وليست Dashboard مؤسسيًا. لا يوجد LMS ولا بوابة ولي أمر ولا لوحة إدارة أكاديمية.

---

### 4) نظام المصادقة (كما هو فعليًا)

ثلاثة مسارات متوازية:

1. **مجهول (Anonymous)** — الافتراضي في التطوير؛ `DISABLE_ANONYMOUS` لإلغائه. يُنشأ uuid محليًا.
2. **OIDC** — `OPENID_CLIENT_ID/SECRET/ISSUER` → `OpenIDClient.ts` + `AuthenticateController` + `OpenIdProfileController`، مع `oidc-server-mock` في docker-compose. سياسة اسم الأفاتار: `OPID_WOKA_NAME_POLICY` (`forced`/`no-forced`) و`PROVIDE_DEFAULT_WOKA_NAME` (`no|random|fix|fix-plus-random-numbers`) و`DEFAULT_WOKA_NAME` — **مفيدة جدًا لنا لفرض أسماء آمنة للأطفال**.
3. **Admin API** — إذا ضُبط `ADMIN_API_URL` + `ADMIN_API_TOKEN` فإن **pusher هو من يستدعي إدارتك** (وليس العكس):
   - `/api/map` → `MapDetailsData` (أي خريطة يراها المستخدم + سياسات + `groupOwner` + `authenticationEndpoint` + `enableChat`…)
   - `/api/room/access` → `FetchMemberDataByUuidResponse` (هل يُسمح له بالدخول + tags + متغيرات)
   - `/api/woka/list` → الأفاتارات المسموحة للطفل
   - `/api/companion/list`, `/api/domain/verify`, `/api/save-name`, `/api/save-textures`, `/api/livekit/credentials`, `/api/ice-servers`, `/api/analytics/events-batch`

**التفويض (Authorization):** مبني على **وسوم (tags)** داخل JWT:
`AuthTokenData = { identifier, accessToken?, username?, locale?, tags?[], matrixUserId? }`.
`tags.includes("admin")` تفتح: تحرير الخريطة، الميجا فون العام، الطرد/الحظر، أدوات الإدارة (`SocketManager.ts`، `eventProcessorInit.ts`، `LocalAdmin.ts`)، ووسم `"editor"` للتحرير.
وعلى مستوى الخريطة: `readableBy` / `writableBy` / `restrictedRights` / `jitsiRoomAdminTag` / `personalArea` (وضع `claim`).

> **الاستنتاج التصميمي الأهم:** نظام الأدوار المطلوب (student / parent / teacher / admin / owner) **يُترجم مباشرة** إلى وسوم تُصدرها خدمة NG Academy عبر `/api/room/access`، بدون اختراع آلية جديدة.

---

### 5) قاعدة البيانات (الوضع الحالي)

**لا توجد قاعدة بيانات علائقية في النسخة المفتوحة.** الموجود:

| المخزن | الاستخدام | الكود |
| --- | --- | --- |
| **Redis** | متغيرات العالم + متغيرات اللاعب (مع FieldMask/deltas)، pub/sub بين الخدمات، تخزين ملفات الـuploader المؤقت | `back/src/Services/Repository/RedisVariablesRepository.ts`، `PlayersRepository/RedisPlayersVariablesRepository.ts`، `uploader/src/Service/RedisStorageProvider.ts` |
| **Void variants** | تشغيل بلا Redis (لا حفظ) | `VoidVariablesRepository.ts`، `VoidPlayersVariablesRepository.ts` |
| **S3 / نظام ملفات** | خرائط WAM + الكيانات المخصصة + ملفات | `map-storage/src/Services/S3Client.ts`، `Upload/DiskFileSystem.ts` |
| **Synapse** | تاريخ الدردشة (Matrix) | خارج المستودع |
| **Admin API (خارجية)** | المستخدمون، الحقوق، الأفاتارات، الوسوم، البيانات الوصفية | `docs/others/self-hosting/adminAPI.md` |

**ما يعنيه هذا للتحويل:** كل الجداول المطلوبة (users, profiles, students, parents, teachers, courses, classes, schedules, attendance, activities, badges, achievements, child_progress, virtual_rooms, virtual_events) **يجب أن تُبنى في خدمة جديدة**. والخبر الجيد: `player variables` في Redis تصلح كطبقة **مزامنة لحظية** (نقاط/شارات داخل الجلسة) بينما يبقى المصدر الدائم في قاعدة NG Academy.

---

### 6) طريقة بناء العالم الافتراضي

**الطبقة 1 — خريطة Tiled (JSON/TMJ):** طبقات (`floor`, `walls`, `furniture`, `abovePlayer1..3`, `collisions`, `start`, `exit`) + tilesets (PNG). مثال حي: `maps/starter/map.json` (31×17) مع طبقات `jitsiMeetingRoom [jitsiRoom=MeetingRoom]` و`clockZone [zone=clock]` وسكربت `maps/starter/script.js` يستخدم `WA.room.onEnterZone`.

**الطبقة 2 — ملف WAM (WorkAdventure Map):** يُخزَّن في map-storage ويضيف دون لمس الخريطة:
```
WAMFileFormat = { version, mapUrl, entities{}, areas[], entityCollections[], lastCommandId?, settings?, metadata?, vendor? }
```
- **Areas** بأنواع خصائص (من `libs/map-editor/src/types.ts`): `start` (مع `isDefault`)، `exit` (url+areaName)، `silent`، `focusable` (zoom_margin)، `highlight`، `jitsiRoomProperty` (roomName/trigger/onenter|onaction|onicon/closable/adminTag/config `startWithAudioMuted|VideoMuted`)، `livekitRoomProperty` (مع **`disableChat`**)، `openWebsite` (link/trigger/width/policy/position/application/poster/placeholder/icon/label/**hideUrl**/**allowAPI**/targetEmbedableUrl/regexUrl)، `openFile`، `playAudio` (volume/loop)، `speakerMegaphone`/`listenerMegaphone` (+chatEnabled/seeAttendees)، `matrixRoomProperty`، `entityDescription`/`areaDescription` (tooltip)، `extensionModule` (subtype+data — **بابنا لميزات الأكاديمية المخصصة**)، `personalArea` (claim mode)، `maxUsersInArea`، `lockableArea`، `restrictedRights`، `readableBy/writableBy`.
- **Entities**: كيانات مخصصة (prefabs + collections) بخصائص `jitsiRoomProperty | livekitRoomProperty | openWebsite | openFile | playAudio` — **هنا نضع جينو والمعلمين واللوحات**.
- **Settings**: `megaphone` و`recording`.

**الطبقة 3 — Scripting API**: سكربت `.js` مرتبط بخاصية `script` على طبقة/منطقة (مع `allowApi`)، أو موقع مضمَّن (`openWebsite` + `allowAPI`)، أو **External Modules** (`play/src/front/ExternalModule/ExtensionModule.ts` + مجلد `external-modules/` الفارغ المخصص للوحدات الخاصة).

**الطبقة 4 — محرر الخرائط المدمج**: `ENABLE_MAP_EDITOR=true` + `play/src/front/Components/MapEditor/` يسمح بإنشاء المناطق والكيانات من داخل العالم (مع صلاحيات `admin`/`editor` أو `MAP_EDITOR_ALLOWED_USERS`).

**مسار الغرفة/الرابط:** `START_ROOM_URL=/_/global/maps.workadventure.localhost/starter/map.json` هو نقطة الدخول الافتراضية؛ الصيغتان `/_/…` (مجهول/عام) و`/@/org/world/room` (مع Admin API) تُحلَّان في `play/src/front/Url/UrlManager.ts`.

---

### 7) ما يمكن إعادة استخدامه (بدون تعديل أو بتعديل طفيف)

| # | المكوّن | درجة الإعادة | ملاحظة |
| --- | --- | --- | --- |
| 1 | محرك العالم: حركة، تصادم، كاميرا، طبقات، انتقالات بين الخرائط | ♻️ 100% | لا يُلمس |
| 2 | Pusher + back + Redis (المواضع والحضور اللحظي) | ♻️ 100% | نضيف فقط **بث أحداث حضور** إلى NG API |
| 3 | LiveKit / WebRTC (دخول الحصة صوت+فيديو) | ♻️ 100% | `livekitRoomProperty` + `disableChat` جاهز |
| 4 | نظام المناطق (Areas) وخصائصها | ♻️ 100% | يغطي: فصل، مكتبة، مسرح، ساحة، منطقة صامتة، حد أقصى للطلاب، منطقة مقفلة |
| 5 | **Woka customization** (شعر/ملابس/ألوان/قبعة/إكسسوار) | ♻️ 95% | نستبدل الفن فقط (`woka.json` + `resources/customisation`) — **لا صور حقيقية للأطفال** بطبيعة النظام |
| 6 | Scripting API + UIWebsite + Popups + Bubbles | ♻️ 100% | أساس جينو، رسائل المناطق، لوحات الأنشطة |
| 7 | نظام الوسوم (tags) والصلاحيات | ♻️ 95% | student/parent/teacher/admin/owner ← وسوم |
| 8 | i18n + RTL + `ar-SA` | ♻️ 90% | نضيف نصوص الأكاديمية ونجعل `FALLBACK_LOCALE=ar-SA` |
| 9 | PWA + Touch + خدمة العمال | ♻️ 100% | مهم للهواتف/الألواح (`BYPASS_PWA`, `SKIP_CAMERA_PAGE`) |
| 10 | map-storage + محرر الخرائط | ♻️ 90% | لتخزين خرائط المدرسة وتعديلها لاحقًا |
| 11 | أدوات الإشراف (Report/Block/Ban/PowerLevels) | ♻️ 85% | تُفعَّل للمعلم/الإدارة فقط |
| 12 | خط التحليلات الجديد (Analytics pipeline) | ⚠️ 60% | **يُعطَّل أو يُقيَّد بشدة** لبيانات الأطفال (انظر §9) |
| 13 | Docker Compose / Helm / CI | ♻️ 95% | نضيف خدمة `ng-academy-api` |
| 14 | Playwright E2E + Vitest | ♻️ 100% | نضيف سيناريوهات "رحلة الطفل" |

---

### 8) ما يجب إعادة تصميمه أو استبداله

| # | العنصر | الإجراء | السبب / الملف |
| --- | --- | --- | --- |
| 1 | **الهوية البصرية** | استبدال | `MetaTagsDefaultValue` في `play/src/pusher/services/MetaTagsBuilder.ts` (title="WorkAdventure"، themeColor `#1B2A41`، cardImage خارجي) + `play/public/static/images/logo*.png` + `favicons/*` + متغيرات الثيم في `@workadventure/tailwind` و`play/src/front/style/*` |
| 2 | **شاشة الدخول والترحيب** | إعادة تصميم | `Phaser/Login/*` + `Components/Login` + `MainLayout.svelte`: نريد "مرحبًا بك في أكاديمية الجيل الجديد 👋" ثم 5 بطاقات كبيرة (المدرسة/فصولي/إنجازاتي/جدولي/ملفي) |
| 3 | **قوائم الطفل** | تبسيط جذري | `Components/Menu`, `ActionBar`, `ActionsMenu`, `HelpSettings`: إخفاء كل ما هو تقني (Jitsi/LiveKit/متغيرات/تقرير مشكلة/إعدادات متقدمة) خلف وضع "Child Mode" |
| 4 | **الخرائط** | استبدال | `maps/starter` و`maps/Tuto` مكتبية/تعليمية للكبار → نبني `maps/ng-academy/*` (مدخل، 7 فصول، إبداع، مكتبة، مختبر، مسرح، إنجازات، ساحة) |
| 5 | **فن الشخصيات** | استبدال | `resources/customisation/*` و`pipoya` بنم LPC → أسلوب طفولي مستدير مناسب 6–12 |
| 6 | **طبقة البيانات/LMS** | بناء جديد كليًا | دورات، حصص، جداول، حضور، أنشطة، شارات، تقدم، ملاحظات معلم — غير موجودة |
| 7 | **بوابة ولي الأمر** | بناء جديد | غير موجودة؛ تصميم مختلف تمامًا عن واجهة الطفل (بطاقات/تقارير) |
| 8 | **لوحة الإدارة الأكاديمية** | بناء جديد | `front/Administration` أدوات داخل العالم فقط؛ المطلوب إدارة طلاب/معلمين/دورات/مناطق/شارات |
| 9 | **الدردشة والروابط** | تقييد | `ENABLE_CHAT*`, `ENABLE_SAY`, `ENABLE_CHAT_UPLOAD`, قائمة نطاقات مسموحة لـ`openWebsite`/`openTab`، إخفاء URL (`hideUrl`) |
| 10 | **الحضور** | بناء جديد | لا يوجد سجل حضور دائم؛ نشتقه من أحداث دخول/خروج pusher |
| 11 | **التحليلات/التتبع** | تعطيل/تقييد | PostHog وخط التحليلات وSentry مع بيانات أطفال → سياسة خصوصية صارمة |
| 12 | **التوثيق** | إعادة كتابة | README/UPGRADE/docs تحمل علامة WorkAdventure |

---

### 9) المخاطر التقنية (مرتّبة)

| الخطر | الدرجة | التفصيل | التخفيف |
| --- | --- | --- | --- |
| **حاجز البناء: Protobuf** | 🔴 عالي | كل الحزم تستورد `libs/messages/src/ts-proto-generated/*` غير المضمَّن في git؛ تحقّقت عمليًا: `npm test` في `libs/map-editor` يفشل، و`npm ci` في `messages/` يفشل لأن `grpc-tools` لا يُبنى على Node الحديث. لا يمكن تشغيل أي فحص محلي قبل حلّه. | تثبيت `protoc` نظامًا (كما تفعل CI عبر `arduino/setup-protoc@v3`) + سكربت `bootstrap`؛ أو نشر `@workadventure/messages` مولَّدة. **يجب حلّه في المرحلة 0.** |
| **امتثال حماية الطفل** | 🔴 عالي | المنصّة ليست مصممة أصلًا لـ COPPA/GDPR-K: لا موافقة ولي أمر، لا سياسة احتفاظ، والتحليلات الجديدة ترسل أحداثًا لجهة خارجية (PostHog/ClickHouse عبر Admin API). | تعطيل التحليلات الخارجية، تقليل البيانات المُخزَّنة، موافقة ولي الأمر كشرط تسجيل، سياسة احتفاظ وحذف، عدم تخزين صور/صوت الأطفال. |
| **الفيديو للأطفال** | 🟠 متوسط | `JITSI_URL=meet.jit.si` (خادم عام) غير مقبول للأطفال؛ LiveKit يحتاج TURN/تسجيل. | LiveKit ذاتي الاستضافة + `startWithVideoMuted` افتراضيًا + `disableChat` + خيار "صوت فقط". |
| **الإشراف على المحتوى** | 🟠 متوسط | لا يوجد فلترة كلمات على الخادم؛ الدردشة Matrix حرة نسبيًا. | إيقاف الدردشة الخاصة/العالمية للأطفال، الإبقاء على "فقاعات القرب" بإشراف المعلم، فلترة خادمية إن لزم. |
| **تعقيد `front`** | 🟠 متوسط | `GameScene.ts` 4,670 سطر و`RoomConnection.ts` 2,389 — أي تعديل عميق هنا مكلف وخطر. | قاعدة ذهبية: **لا نعدّل المحرك**؛ ننفّذ عبر المناطق + Scripting API + Svelte components جديدة. |
| **RTL/العربية** | 🟠 متوسط | الدعم موجود على مستوى `document.dir` لكن مكونات كثيرة (Phaser DOM layer، popups، editor) لم تُختبر RTL. | جعل `ar-SA` اللغة المرجعية، فحص بصري لكل شاشة، وتصميم "عربي أولًا". |
| **أصول الخرائط والفن** | 🟡 منخفض-متوسط | LPC/Pipoya لها متطلبات إسناد؛ نحتاج فنًا طفوليًا جديدًا بترخيص واضح. | توليد/شراء tileset بأسلوب واضح الترخيص، وتوثيق الإسناد. |
| **الأداء على أجهزة ضعيفة** | 🟡 متوسط | Phaser + TF.js/MediaPipe + Sentry تُحمّل JS ثقيل. | `SKIP_CAMERA_PAGE=true`، تعطيل معالجة الخلفية، ميزانية أصول (أطلس واحد)، `MAX_DISPLAYED_VIDEOS` منخفض، lazy loading، وتقليل حجم الخريطة. |
| **سجل git shallow** | 🟡 منخفض | commit واحد فقط → صعب تتبع الانحدارات. | الاعتماد على الاختبارات (Vitest/Playwright) كبوابة أمان قبل/بعد كل مرحلة. |
| **الترخيص** | 🟡 منخفض | `SEE LICENSE IN LICENSE.txt` (ليست MIT). استخدام تجاري لعلامة مشتقة يحتاج مراجعة. | مراجعة الترخيص قبل الإطلاق التجاري وإزالة كل علامة WorkAdventure. |

---

### 10) خطة التحويل إلى NG Academy

#### أ) المعمارية المستهدفة (قرار معماري مركزي)

> **لا نعيد بناء المحرك. نبني "العقل الأكاديمي" كخدمة جديدة تلعب دور Admin API الذي تتوقعه WorkAdventure أصلًا.**

```
                    ┌────────────────────────────────────────┐
                    │        NG Academy (العلامة الجديدة)     │
                    └────────────────────────────────────────┘
 الطفل ──▶ /login (OIDC مبسّط أو رمز صف) ──▶ شاشة ترحيب + 5 بطاقات ──▶ العالم (play/front)
                                     │
 ولي الأمر ──▶ /parent  (Dashboard)  │  REST/JSON
 المعلم  ──▶ /teacher  (Dashboard)   │
 الإدارة ──▶ /admin    (Dashboard)   │
                                     ▼
                        ┌──────────────────────────┐
                        │  ng-academy-api (جديد)    │  ◀── Admin API contract
                        │  Postgres + Prisma/Drizzle│      /api/map, /api/room/access,
                        │  Roles: student|parent|   │      /api/woka/list, /api/companion/list,
                        │  teacher|admin|owner      │      /api/save-name, /api/livekit/credentials,
                        │  حضور/أنشطة/شارات/تقدم    │      /api/analytics/events-batch (معطَّل)
                        └───────────┬──────────────┘
                                    │ gRPC/WS
        ┌───────────────┬───────────┴──────────┬───────────────┬──────────────┐
        ▼               ▼                      ▼               ▼              ▼
     play(front)     pusher                  back          map-storage    LiveKit
     Phaser+Svelte   حضور/وسوم/غرف          غرف/متغيرات   خرائط المدرسة   الحصص
```

**لماذا هذا القرار؟**
- يحافظ على 100% من المحرك ويمنع كسر الوظائف (§15).
- Admin API عقد **موثّق ومستقر** (`docs/others/self-hosting/adminAPI.md` + Swagger على `/swagger-ui/`).
- يعطينا مكانًا طبيعيًا لقاعدة البيانات والأدوار والحضور والشارات.
- يسمح بتشغيل وضعين: `LocalAdmin` (تطوير سريع بلا API) و`ADMIN_API_URL` (الإنتاج).

#### ب) قاعدة البيانات المقترحة (Postgres)

```
users(id, uuid WA, email?, role[student|parent|teacher|admin|owner], status, created_at)
profiles(user_id, display_name, avatar_set JSONB, locale, theme, is_child, consent_at)
students(id, user_id, birth_year, grade, class_id, parent_ids[], guardian_consent bool)
parents(id, user_id, student_ids[], notify_preferences JSONB)
teachers(id, user_id, subjects[], tags[])
courses(id, title, subject, grade, teacher_id, description, color, icon)
classes(id, course_id, title, teacher_id, room_id, capacity, join_policy)
schedules(id, class_id, starts_at, ends_at, recurrence, livekit_room, status)
attendance(id, student_id, class_id?, virtual_room_id?, joined_at, left_at,
           duration_s, presence_source[world|class|activity], teacher_note?)
activities(id, type[daily|weekly|micro], title_ar, body_ar, course_id?, badge_id?, points, due_at)
activity_attempts(id, activity_id, student_id, status, submitted_at, evidence_url?, teacher_feedback?)
badges(id, code, title_ar, description_ar, image_url, category)
achievements(id, student_id, badge_id, activity_id?, awarded_at, awarded_by)
child_progress(id, student_id, course_id, xp, level, streak_days, updated_at)
teacher_notes(id, student_id, teacher_id, note, visibility[parent|admin], created_at)
virtual_rooms(id, wa_room_url, map_url, kind[entrance|classroom|library|lab|theater|hall|yard],
              label_ar, icon, capacity, silent, supervised_by)
virtual_events(id, virtual_room_id, title_ar, starts_at, kind[assembly|show|reading])
audit_log(id, actor_id, action, target, meta JSONB, at)      -- للإدارة/ولي الأمر فقط
```

**قواعد الصلاحيات:**
- `student`: يرى ملفه، فصوله، أنشطته، شاراته، حضوره (عرض مبسّط بلا أرقام إدارية).
- `parent`: أطفاله فقط (حضور/حصص/تقدم/تقييمات/شارات/أنشطة/ملاحظات المعلم) — **لا دخول للعالم**.
- `teacher`: صفوفه (حضور، ملاحظات، أنشطة، بدء الحصة، ميجا فون داخل العالم).
- `admin`: كل الأكاديمية + إدارة المناطق/الشارات/الأحداث.
- `owner`: admin + إعدادات النظام والأدوار والحذف.
- داخل العالم: الوسوم `student|teacher|admin|owner` تُحقن في JWT عبر `/api/room/access`، وتُستخدم مع `restrictedRights`/`readableBy`/`writableBy`/`jitsiRoomAdminTag`.

#### ج) المراحل التنفيذية (مع بوابة اختبار بعد كل مرحلة)

| المرحلة | المحتوى | ملفات/أماكن العمل | بوابة القبول |
| --- | --- | --- | --- |
| **0. التهيئة** | حلّ حاجز Protobuf، سكربت `bootstrap`، تثبيت Node 24، تشغيل `typecheck+lint+test` كخط أساس (baseline) | `messages/`, `package.json`, `docs/agent/dev-setup.md` | كل فحوص CI الخضراء محليًا + لقطة "قبل" |
| **1. الهوية** | الاسم/الشعار/الأيقونات/الألوان (`#38b6ff` + أبيض + باستيل)، الثيم، خطوط ودودة، حذف كل "WorkAdventure" من الواجهة، `FALLBACK_LOCALE=ar-SA`، PWA manifest | `MetaTagsBuilder.ts`, `play/public/static/images/*`, `libs/tailwind`, `play/src/front/style/*`, `play/index.html` | لقطات شاشة + `pretty-check` + لا رجوع في الاختبارات |
| **2. أمان الطفل (Hardening)** | `.env` افتراضيات آمنة: `ENABLE_CHAT=false`, `ENABLE_CHAT_UPLOAD=false`, `ENABLE_SAY=true` (فقاعات قرب فقط), `DISABLE_NOTIFICATIONS=true`, `ENABLE_REPORT_ISSUES_MENU=false`, `DISABLE_ANONYMOUS=true`, `SKIP_CAMERA_PAGE=true`, تعطيل PostHog/Sentry/Analytics، whitelist للنطاقات المضمَّنة، `MAX_USERNAME_LENGTH` + سياسة اسم آمنة | `.env.template`, `play/src/pusher/enums/*`, إعدادات pusher | اختبار E2E: لا دردشة خاصة، لا روابط خارجية، لا إشعارات |
| **3. عالم المدرسة** | توليد خرائط Tiled+WAM: المدخل/الاستقبال، 7 فصول، قاعة الإبداع، المكتبة، مختبر العلوم، المسرح، قاعة الإنجازات، الساحة؛ مع `start`/`exit`/`silent`/`maxUsersInArea`/`focusable`/`openWebsite`؛ أصول وتileset طفولي | `maps/ng-academy/*` (مولَّد بسكربت Node) + `map-storage` + `START_ROOM_URL` | الطفل يتجول بين كل المناطق على الهاتف والحاسوب؛ 75 اختبار E2E القائم لا ينكسر |
| **4. جينو + المعلمون + رسائل المناطق** | جينو (بومة زرقاء بقبعة تخرج) كـ**custom entity** + overlay Svelte غير مزعج (يظهر عند الدخول/الوصول لمنطقة/الإنجاز ثم يختفي)؛ NPCs للمعلمين (أستاذة حسيبة…)؛ رسائل عربية عند دخول كل منطقة | `play/public/resources/…/gino.png`, `play/src/front/Components/Gino/*` (جديد), scripting/areas, `play/src/i18n/ar-SA/*` | سيناريو: دخول → ترحيب جينو → "أنت الآن في فصل الرياضيات" → توجيه للحصة |
| **5. ng-academy-api** | خدمة جديدة (workspace) تنفّذ Admin API + API الأكاديمية + Postgres + migrations + اختبارات | `academy/` (جديد)، `docker-compose.yaml`, Helm | `/api/map` و`/api/room/access` و`/api/woka/list` تعمل؛ دخول طالب حقيقي؛ حضور يُسجَّل |
| **6. رحلة الطفل + بطاقة الفصل** | شاشة ما بعد الدخول (5 بطاقات كبيرة)، ولوحة "فصولي" (المادة/المعلم/الموعد/زر دخول الحصة/الدرس القادم/التسجيلات/الأنشطة/الواجبات) كـ**UIWebsite iframe** وليس جداول | `play/src/front/Components/*` (جديد)، `Phaser/Login` | طفل 7 سنوات يصل للحصة في ≤3 نقرات |
| **7. الأنشطة والشارات** | نشاط اليوم/تحدي الأسبوع/مهمة صغيرة، إنجاز → badge + نقاط (غير تنافسية) + ظهور في الملف + تهنئة جينو، وقاعة الإنجازات تعرض الشارات من الخريطة | `academy/` + UIWebsite + `WA.state`/player variables | دورة كاملة: نشاط → تسليم → شارة → قاعة الإنجازات |
| **8. بوابة ولي الأمر + لوحة الإدارة** | تطبيقان/مساران منفصلان بتصميم "تقليدي" (جداول/إحصائيات/فلاتر/تقارير) — بعيدًا عن واجهة الطفل | `academy/apps/parent`, `academy/apps/admin` (جديد) | ولي أمر يرى حضور طفله وشاراته؛ مدير ينشئ دورة ويربط معلمًا ويضيف طلابًا |
| **9. الأداء** | ميزانية أصول، أطلس واحد للـtileset، lazy loading، تعطيل TF.js/MediaPipe، تقليل JS، `MAX_DISPLAYED_VIDEOS`، اختبارات على جهاز ضعيف | vite config، assets، env | زمن تحميل أولي وFPS مقبول على هاتف متوسط |
| **10. الاختبار والتوثيق والنشر** | E2E لرحلة الطفل الكاملة، تحديث README/UPGRADE/docs بعلامة NG Academy، compose/Helm للإنتاج | `tests/`, `docs/` | كل البوابات خضراء + دليل تشغيل |

#### د) قواعد تنفيذ ملتزم بها
1. **لا تعديل على `GameScene.ts` / `RoomConnection.ts` / `back` إلا عند الضرورة القصوى** — الأولوية للمناطق + Scripting API + مكونات Svelte جديدة.
2. **كل مرحلة تنتهي باختبار**: `typecheck` + `svelte-check` + `lint` + `pretty-check` + `vitest` + E2E ذي صلة، ومقارنة بخط الأساس من المرحلة 0.
3. **لا كسر للوظائف القائمة**: 75 اختبار Playwright و163 اختبار وحدة تبقى خضراء.
4. **العربية أولًا + RTL** في كل شاشة جديدة.
5. **لا بيانات شخصية للأطفال في الواجهة**: اسم أول فقط، أفاتار كرتوني، لا بريد/هاتف/صورة حقيقية.

---

## الجزء الثاني: قرارات مطلوبة منك قبل المرحلة 0

1. **حزم التقنية لخدمة `ng-academy-api`**: أقترح Node 24 + TypeScript + Express/Fastify + **Postgres** + Drizzle/Prisma + Zod (متسق مع المستودع). هل توافق؟ أم تفضّل NestJS أو Laravel/PHP؟
2. **بوابة ولي الأمر والإدارة**: داخل نفس الخدمة (SSR/SPA) أم تطبيق SvelteKit منفصل؟
3. **تسجيل دخول الأطفال**: OIDC مبسّط (بريد ولي الأمر) أم "رمز صف + اسم مستخدم" بلا بريد (أسهل وأأمن للأطفال)؟
4. **الفيديو**: LiveKit ذاتي الاستضافة (موصى به) أم Jitsi ذاتي الاستضافة أم "صوت فقط" في البداية؟
5. **أصول الفن**: هل أولّد فنًا (AI) بأسلوب طفولي، أم توفّرون حزمة tileset/شخصيات مرخّصة؟
6. **النطاق الأول للتنفيذ**: هل أبدأ بالمرحلة 0+1 (البناء + الهوية) فورًا بعد ردّك؟

---

### مرفقات مفيدة (مسارات دقيقة للعمل اللاحق)

```
العلامة/الثيم:  play/src/pusher/services/MetaTagsBuilder.ts
                play/public/static/images/{logo.png,logo-wa-2.png,logo-WA-min.png,favicons/*}
                libs/tailwind/style/index.css + play/src/front/style/{index.css,style.css,wa-theme/*}
رحلة الدخول:    play/src/front/Phaser/Login/{EntryScene,LoginScene,SelectCharacterScene,
                SelectCompanionScene,EnableCameraScene}.ts
الأفاتار:       play/src/pusher/data/woka.json + play/public/resources/customisation/*
المرافق(NPC):   play/src/pusher/data/companions.json + play/src/front/Phaser/Companion/*
المناطق/الخصائص:libs/map-editor/src/types.ts + play/src/front/Phaser/Game/AreasPropertiesListener.ts
Scripting:      play/src/iframe_api.ts + play/src/front/Api/Iframe/*
الدردشة/الإشراف:play/src/front/Chat/* + Components/ReportMenu/* + Components/TypeMessage/BanMessage.svelte
الوسوم/الأدوار: play/src/pusher/services/JWTTokenManager.ts + SocketManager.ts + LocalAdmin.ts
البيئة:         .env.template (107 متغيرات) + play/src/pusher/enums/EnvironmentVariable*.ts
اللغة/RTL:      play/src/i18n/ar-SA/* + play/src/front/Utils/locales.ts
الخرائط:        maps/starter/map.json + maps/tests/* + map-storage/tests/assets/maps/*.wam
عقد Admin API:  docs/others/self-hosting/adminAPI.md + libs/messages/src/JsonMessages/{MapDetailsData,MemberData,CapabilitiesData}.ts
```
