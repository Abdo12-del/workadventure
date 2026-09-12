# تحليل مشروع WorkAdventure

> تاريخ التحليل: 2026-09-12 — الفرع: `arena/01a096db-workadventure` — آخر commit: `6112395` (`feat(analytics): add generic analytics pipeline (#6185)`)

---

## 1) نظرة عامة

**WorkAdventure** منصّة مفتوحة المصدر لبناء عوالم افتراضية تعاونية (metaverse) ثنائية الأبعاد:
 أفاتار يتحرك داخل خريطة مبنية بـ Tiled، ومحادثات فيديو/صوت تُفعَّل تلقائيًا عند الاقتراب من شخص آخر.
 المنصّة مُوجّهة للمكاتب الافتراضية، التوظيف، التدريب، والفعاليات، وتدّعي التوافق مع GDPR.

| البند | القيمة |
| --- | --- |
| اللغة الأساسية | TypeScript (بنسبة ~100%) |
| حجم الكود | ~275,000 سطر في ~2,294 ملف `.ts`/`.svelte` (بدون `node_modules` والملفات المولّدة) |
| بنية المستودع | Monorepo عبر **npm workspaces** |
| الترخيص | مخصص (`SEE LICENSE IN LICENSE.txt`) لكل حزمة |
| الحالة في هذه النسخة | clone **shallow** بعمق commit واحد فقط (لا يوجد سجل تاريخي محلي) |

---

## 2) البنية المعمارية (Microservices)

```
                 ┌──────────────┐
   المتصفح ─────▶│  Traefik v3  │  (reverse-proxy / TLS / *.workadventure.localhost)
                 └──────┬───────┘
        ┌───────────────┼────────────────┬───────────────┬──────────────┐
        ▼               ▼                ▼               ▼              ▼
   ┌─────────┐    ┌───────────┐    ┌──────────────┐ ┌──────────┐  ┌──────────┐
   │  play   │    │   back    │    │ map-storage  │ │ uploader │  │  maps    │
   │ front + │    │ gRPC API  │    │  WAM maps +  │ │ ملفات    │  │ خرائط    │
   │ pusher +│    │ (Worlds/  │    │  محرر خرائط  │ │ مؤقتة    │  │ جاهزة    │
   │ room-api│    │  Rooms)   │    │  (Svelte UI) │ │ Redis/S3 │  │ (Apache) │
   └────┬────┘    └─────┬─────┘    └──────────────┘ └──────────┘  └──────────┘
        │  WebSocket/gRPC│
        └────────────────┘
             ▲                    ┌──────────────┐   ┌───────────────┐
             └── Redis 6 ─────────│  Synapse     │   │ oidc-server-  │
                 (pub/sub, cache) │  (Matrix)    │   │ mock (تسجيل   │
                                  │  الدردشة     │   │  الدخول)      │
                                  └──────────────┘   └───────────────┘
```

- **الاتصال بين الخدمات**: gRPC + Protobuf (`messages/protos`: `messages.proto`, `room-api.proto`, `services.proto`)، والكود المولَّد يُكتب في `libs/messages/src/ts-proto-generated/` (غير مضمَّن في git — يجب توليده محليًا).
- **الصوت/الفيديو**: وضعان — WebRTC P2P عبر `@workadventure/simple-peer`، أو **LiveKit** (SFU) مع `livekit-config.yaml` وwebhook.
- **الدردشة**: Matrix (Synapse) + دردشة "قرب" (Proximity) محلية.
- **المصادقة**: OIDC (مع خادم mock للتطوير)، وJWT (`jose`)، وAdmin API.
- **المراقبة**: Sentry (front/pusher/back/map-storage)، Prometheus (`prom-client` + `PrometheusController`)، PostHog، وخط تحليلات جديد (انظر §6).

---

## 3) حزم المستودع (Workspaces)

| المسار | الحزمة | الدور | الحجم التقريبي |
| --- | --- | --- | --- |
| `play/` | `workadventure-play` | الواجهة (Svelte 5 + Phaser 4) + **Pusher** (WebSocket/HTTP) + **Room API** | ~160 ألف سطر (`front` 143k، `pusher` 17k، `room-api` 0.4k) |
| `back/` | `workadventureback` | منطق العوالم والغرف (gRPC + Express 5 + uWebSockets) | ~13 ألف سطر |
| `map-storage/` | `map-storage` | تخزين خرائط WAM + محرر خرائط ويب + S3 | ~5.5 ألف سطر |
| `uploader/` | `workadventureuploader` | رفع ملفات مؤقت (Redis / S3) | ~700 سطر |
| `libs/messages` | `@workadventure/messages` | كود Protobuf المولَّد + مخططات **Zod** للرسائل JSON (Admin API, Analytics, Chat…) | ~3 آلاف سطر |
| `libs/map-editor` | `@workadventure/map-editor` | منطق تحرير الخرائط، أوامر (Commands)، هجرات (Migrations)، صلاحيات | ~3 آلاف سطر |
| `libs/shared-utils`, `store-utils`, `math-utils`, `tailwind`, `eslint-config` | `@workadventure/*` | أدوات مشتركة | صغيرة |
| `libs/room-api-clients/room-api-client-js` | `@workadventure/room-api-client` | عميل JS لـ Room API (يُنشر على npm) | — |
| `messages/` | `workadventure-messages` | ملفات `.proto` + سكربتات التوليد (**ليس workspace** — يُثبَّت بشكل منفصل) | — |
| `tests/` | `workadventure-e2e-tests` | اختبارات Playwright من الطرف إلى الطرف | 75 ملف `.spec.ts` |
| `benchmark/` | `workadventure-artillery` | اختبارات حمل بـ Artillery | — |
| `maps/`, `desktop/`, `contrib/`, `docs/`, `cd/`, `synapse/` | — | خرائط جاهزة، تطبيق Electron، Docker/Helm/أدوات، توثيق، نشر مستمر | — |

**أهم التبعيات**: `phaser 4.2.0` (مع patch محلي `patches/phaser+4.2.0.patch`)، `svelte 5` + runes، `vite`، `zod 3`، `rxjs 7`، `hyper-express` + `uWebSockets.js`، `@grpc/grpc-js`، `livekit-client/server-sdk`، `matrix-js-sdk`، `quill`، `typesafe-i18n`، `@tensorflow/tfjs` + `@mediapipe` (خلفيات افتراضية/تشويش)، `tailwindcss 4`.

---

## 4) سير العمل والجودة

- **CI** (`.github/workflows/continuous_integration.yml`): وظائف منفصلة لكل حزمة (play, back, uploader, map-editor, store-utils…) وتنفّذ بالترتيب:
  `npm ci` → توليد protobuf → توليد i18n → `build` → `typecheck` → `svelte-check` → `lint` → `pretty-check` → `vitest`.
  Node **24** في CI (الساندبوكس هنا Node 22).
- **workflows أخرى**: CodeQL (أمان)، بناء صور Docker متعددة المعماريات، نشر Helm chart، نشر `iframe-api` و`room-api-client` على npm، بناء تطبيق سطح المكتب، تنظيف البيئات القديمة، و`claude.yml` (أتمتة وكيل).
- **الاختبارات**:
  - وحدة (Vitest): **163 ملف `.test.ts`** — `play` 127، `back` 23، `libs` 7، `map-storage` 6، `uploader` 3.
  - E2E (Playwright): **75 spec** + طبقة `tests/tests/utils/*` منظمة (Page Objects).
  - Bench: `play/tests/pusher/AnalyticsEventCatalog.bench.ts` + مجلد `benchmark/`.
- **Pre-commit**: Husky + lint-staged (eslint --fix، prettier، svelte-check على ملفات `.svelte`).
- **التوثيق الموجّه للوكلاء**: `AGENTS.md` في الجذر وكل حزمة، مع `docs/agent/*` (dev-setup, testing-vitest, typescript-style, error-handling, svelte, i18n, lint-format, common-issues, devtools) — و`CLAUDE.md` مجرد reference إلى `AGENTS.md`، و`.claude/skills` رابط إلى `.codex/skills`.
- **الترجمة**: 17 لغة عبر `typesafe-i18n` + فحص اكتمال الترجمة في CI (`npm run i18n:check`).
- **توثيق متغيرات البيئة**: `docs/others/self-hosting/env-variables.md` **مولَّد آليًا** من مخططات Zod عبر `contrib/tools/generate-env-docs` (مع `check-env-docs` في CI) — 107 متغيرات في `.env.template`.

---

## 5) أحدث تغيير: خط التحليلات العام (Analytics Pipeline)

آخر commit يضيف معمارية تحليلات موحّدة بدل قائمة خاصة بجودة الفيديو:

- `libs/messages/src/JsonMessages/AnalyticsEventCatalog.ts` (~1,613 سطر): كتالوج أحداث معرَّف بـ Zod، يشتق منه `AnalyticsEventName`، والأحداث الزمنية (`TIMED_ANALYTICS_EVENT_NAMES`)، ومخطط دفعة الأحداث.
- `AnalyticsEventsBatch.ts` + `AnalyticsPostHogKeys.ts`: صيغة الدفعة (schemaVersion 1) ومفاتيح PostHog.
- Pusher: `AnalyticsEventsQueue.ts` (طابور + دفعات + إعادة محاولة مع jitter + تصريف عند الإيقاف عبر `ShutdownDrains`)، `AnalyticsReportMessageHandler.ts`، `AnalyticsTimedEventTracker.ts`.
- Front: `Administration/AnalyticsClient.ts`، `TimedAnalyticsEvent.ts`، `CowebsiteAnalyticsProperties.ts`، `WebRtc/VideoQualityAnalytics.ts`، `WebRtc/JitsiMeetingAnalytics.ts`.
- **تغييرات كاسرة** موثّقة في `UPGRADE.md`: إعادة تسمية `VIDEO_ANALYTICS_*` → `ANALYTICS_*` (بدون قراءة الأسماء القديمة أو تحذير)، وإحالة قدرة `api/analytics/video-quality-batch` واستبدالها بـ `api/analytics/events-batch`.
- **ملاحظات خصوصية جيدة**: تجريد query string وhash من روابط co-website (قد تحمل توكنات) قبل إرسالها، وحدّ أقصى 8KB لحجم الخصائص محسوب بالبايت (`Buffer.byteLength`) لا بعدد الأحرف.
- اختبار ذكي: `AnalyticsEventCatalog.test.ts` يقرأ مصادر `src/front` عبر `import.meta.glob(..., ?raw)` ويتحقق أن كل اسم حدث مستخدم في الكود موجود في الكتالوج (تكلفة: تضمين ~5MB من المصدر في حزمة الاختبار).

---

## 6) نقاط قوة

1. **فصل نظيف للخدمات** مع عقود قوية الأنواع (Protobuf + Zod) وتوليد مخطط OpenAPI للمستودع الإداري.
2. **انضباط جودة عالٍ**: typecheck + svelte-check + eslint + prettier + i18n check + اختبارات وحدة وE2E في كل PR.
3. **توثيق ممتاز للمساهمين والوكلاء** (AGENTS.md متدرّج حسب الأقرب للملف + أدلة مشتركة).
4. **وعي أمني/خصوصي**: SECURITY.md، CodeQL، تجريد التوكنات من بيانات التحليلات، حدود حجم الحمولة.
5. **مساران للنشر الذاتي**: Docker Compose (عدة تركيبات: no-oidc، single-domain، livekit، rustfs، e2e) وHelm chart.
6. **قابلية توسعة عالية**: Scripting API عبر iframe (`play/packages/iframe-api-typings`)، وحدات خارجية، Room API، محرر خرائط مدمج.

---

## 7) ملاحظات ومخاطر (مرتبة حسب الأهمية)

| # | الملاحظة | التفصيل / الأثر | الاقتراح |
| --- | --- | --- | --- |
| 1 | **حاجز دخول قوي: توليد Protobuf إلزامي** | كل الحزم تقريبًا تستورد `libs/messages` الذي يعتمد على `src/ts-proto-generated/messages` (غير موجود في git). جرّبت فعليًا: `npm test` في `libs/map-editor` يفشل بـ `Cannot find module './ts-proto-generated/messages'`، و`npm ci` في `messages/` يفشل لأن `grpc-tools` (node-pre-gyp) لا يُبنى على Node 22/24 في بيئات حديثة. | توثيق مسار بديل يعتمد على `protoc` النظام (الذي تُثبته CI أصلًا) بدل `grpc_tools_node_protoc`، أو نشر حزمة `@workadventure/messages` مولَّدة مسبقًا، أو إضافة سكربت `bootstrap` يفحص وجود protoc ويعطي رسالة خطأ إرشادية. |
| 2 | **ملفات ضخمة (God objects)** | `play/src/front/Phaser/Game/GameScene.ts` = **4,670 سطر**، `MatrixChatRoom.ts` 2,442، `RoomConnection.ts` 2,389، `MatrixChatConnection.ts` 2,195، `AreasPropertiesListener.ts` 2,111، `MediaStore.ts` 1,689. | تفكيك تدريجي باستخدام الأنماط الموجودة أصلًا (ECS في `Phaser/ECS`، Stores، Services) مع اختبارات Characterization قبل النقل. |
| 3 | **`postinstall` مع `patch-package` يُنتج خطأً في التثبيت الجزئي** | عند `npm ci --workspace=...` يظهر `Patch file found for package phaser which is not present at node_modules/phaser`؛ الرسالة مُعالجة بـ `|| echo` لكنها تُربك المطورين الجدد وتُخفي أخطاء patch حقيقية. | جعل السكربت يتخطى بصمت عند غياب `node_modules/phaser` (فحص وجود الملف قبل `patch-package`) مع إبقاء الفشل الحقيقي ظاهرًا. |
| 4 | **`CHANGELOG.md` قديم جدًا** | آخر الإدخالات تعود لحقبة v1.5.x بينما `UPGRADE.md` يوثّق v1.33 → v1.34. مصدران للحقيقة يسببان لبسًا. | إما تجميد CHANGELOG رسميًا والإشارة إلى GitHub Releases + `UPGRADE.md`، أو توليده آليًا (release-please / changesets). |
| 5 | **أرقام إصدارات غير مفيدة** | كل الحزم `"version": "1.0.0"`، وHelm chart `0.0.9-dev1`. يصعّب تتبع التوافق بين الخدمات والصور. | اعتماد إصدار موحّد من المستودع (tag) وحقنه في وقت البناء. |
| 6 | **تكرار/أخطاء صغيرة في التوثيق** | `libs/AGENTS.md` يكرر قسم "Related guides" ويحتوي مسارات مكسورة (`docs/agent/...` بدل `../../docs/agent/...`). `README.md` يحتوي badge مكسورًا `username={username}`. | تنظيف سريع (يمكن دمجه في PR واحد صغير). |
| 7 | **`play/src/front/external-modules/`** | فارغ في المستودع المفتوح، ويُربط رمزيًا بمستودع SaaS؛ اختبارات التحليلات تتجاوزه صراحةً بسبب قيود Vite على `?raw`. | توثيق السلوك في `play/AGENTS.md` حتى لا يُفاجأ المساهمون بفشل الاختبارات عند ربط المجلد. |
| 8 | **ازدواجية تقنيات الخادم في `play`** | `express 5` + `hyper-express` + `uWebSockets.js` (مثبَّت من GitHub بـ tag) في نفس الحزمة → سطح أخطاء/تحديثات أوسع وقفل على مصدر خارج npm. | توحيد على طبقة واحدة، أو على الأقل تثبيت `uWebSockets.js` من إصدار مُثبَّت في lockfile مع توثيق سبب الاختيار. |
| 9 | **لا يوجد Node engines محدد** | لا `"engines"` في أي `package.json`؛ CI يستخدم Node 24 بينما قد يعمل المطورون على إصدارات أقدم (فشل `grpc-tools` مثال عملي). | إضافة `"engines": { "node": ">=24" }` في الجذر والحزم الخدمية. |
| 10 | **تغطية اختبارات غير متوازنة** | 127 ملف اختبار في `play` مقابل 6 في `map-storage` و7 في `libs` (بينما `map-editor` يحمل منطق هجرات وصلاحيات حساس). | رفع التغطية على `libs/map-editor` (Migrations/Permissions) و`map-storage` قبل أي إعادة هيكلة. |

---

## 8) الصحة الحالية في بيئة التحليل (قياس فعلي)

| الفحص | النتيجة |
| --- | --- |
| `git status` | نظيف، لا تعديلات محلية |
| اعتماديات مثبّتة؟ | لا (`node_modules` غير موجود أصلًا) |
| `npm ci --workspace=@workadventure/messages --workspace=@workadventure/shared-utils --include-workspace-root` | ✅ نجح (518 حزمة) مع تحذير `patch-package` (ملاحظة #3) |
| `npm ci` داخل `messages/` | ❌ فشل في بناء `grpc-tools` عبر `node-pre-gyp` (ملاحظة #1) |
| `tsc --noEmit` في `libs/messages` | ❌ خطأان فقط، كلاهما بسبب غياب الكود المولَّد (TS2307) |
| `npm test` في `libs/map-editor` | ❌ 6 ملفات اختبار فشلت عند الاستيراد لنفس السبب |
| تشغيل التطبيق / E2E | غير ممكن هنا: يحتاج Docker Compose كامل + protoc + تثبيت كامل (Playwright/Phaser/uWebSockets) |

> الخلاصة: **لا يوجد دليل على كود مكسور في المستودع**؛ كل الإخفاقات أعلاه سببها خطوة توليد Protobuf المفقودة في البيئة، وهي متطلّب موثّق في CI.

---

## 9) توصيات عملية (خارطة طريق مقترحة)

**سريعة (أقل من يوم)**
1. إصلاح `libs/AGENTS.md` (المسارات والتكرار) وbadge الـREADME المكسور.
2. إضافة `"engines"` وتوضيح إصدار Node المطلوب في `docs/agent/dev-setup.md`.
3. جعل `postinstall` يتجاهل patch بصمت عند تثبيت جزئي.
4. حسم مصير `CHANGELOG.md` (تجميد + إشارة إلى `UPGRADE.md`/Releases).

**متوسطة (أسبوع)**
5. توفير `npm run bootstrap` يشغّل: فحص protoc → توليد الرسائل → typesafe-i18n → تثبيت workspaces، مع رسائل فشل إرشادية.
6. إضافة تحذير (deprecation warning) عند وجود `VIDEO_ANALYTICS_*` في البيئة، بدل الصمت الموصوف في `UPGRADE.md`.
7. رفع تغطية `libs/map-editor` (Migrations/Permissions) و`map-storage`.

**هيكلية (شهر+)**
8. تفكيك `GameScene.ts` و`MatrixChatRoom.ts` إلى وحدات أصغر مع اختبارات حماية.
9. توحيد طبقة HTTP/WS في `play` وتقليل الاعتماد على حزم مثبّتة من Git.
10. توحيد إصدارات الحزم وربطها بـ tags المستودع وHelm chart.

---

## 10) أوامر مفيدة (مرجع سريع)

```bash
# الإعداد الكامل
cp .env.template .env
npm install                     # جذر المستودع (كل الـworkspaces)
cd messages && npm install && npm run ts-proto && cd ..   # توليد Protobuf (يتطلب protoc)
docker-compose up               # التشغيل المحلي (يتطلب إدخالات /etc/hosts)

# فحوصات play
cd play
npm run typecheck && npm run svelte-check && npm run lint && npm run pretty-check
npm test -- --run tests/front/Utils/TokenBucket.test.ts

# فحوصات back
cd back && npm run typecheck && npm run lint && npm test

# docs
npm run generate-env-docs       # توليد توثيق متغيرات البيئة
npm run check-env-docs          # التحقق من تزامنه
```

الوصول بعد التشغيل: `http://play.workadventure.localhost/` (مستخدم تجريبي `User1` / `pwd`)، ولوحة Traefik على `http://traefik.workadventure.localhost`.
