# NG Academy — عالم المدرسة (School world)

خرائط العالم الافتراضي لـ«أكاديمية الجيل الجديد»: **13 خريطة** بصيغة
Tiled (`*.tmj`) + WorkAdventure Map (`*.wam` v2.1.0)، مولَّدة برمجيًا وبشكل
قابل للتكرار (معرفات UUID مشتقة من الأسماء، فلا فروقات عشوائية بين التشغيلات).

| الخريطة | المكان | ملاحظات |
| --- | --- | --- |
| `entrance.wam` | المدخل + الاستقبال + الساحة | المحور (hub): 12 بابًا لكل أماكن المدرسة |
| `classroom-arabic/english/math/science/chess/reading/communication.wam` | الفصول السبعة | غرفة LiveKit صوتية لكل فصل (`disableChat: true`, فيديو مطفأ افتراضيًا) |
| `library.wam` | المكتبة | منطقة صامتة (`silent`) + رفوف وأرائك قراءة |
| `science-lab.wam` | مختبر العلوم | طاولات تجارب + جلسة صوتية |
| `theater.wam` | المسرح | خشبة (جلسة صوتية للعروض) + مقاعد جمهور |
| `creativity-hall.wam` | قاعة الإبداع | طاولات عمل ومجلس |
| `achievements-hall.wam` | قاعة الإنجازات | جدار عرض الشارات — تشجيع بلا منافسة |

## التصميم

- **tileset طفولي مرسوم برمجيًا**: `assets/ng-tileset.png` (16 بلاطة 32px بألوان
  الهوية: سماوي `#38b6ff`، أبيض، أصفر دافئ، أخضر الساحة) — يُرسم من مخزن بكسلات
  داخل المولّد، ويُquantize عبر sharp إن وُجد وإلا فمرمّز PNG مدمج.
- **طبقات العلامات تحت الأرضية** (`start`/`collisions`/`silent`/`exit_*`/`from_*`)
  كي لا تظهر مربعات `Special_Zones` الملونة داخل اللعبة (نفس حيلة خريطة starter).
- **الأبواب**: طبقة `exit_<...>` بخاصية `exitUrl` نحو `*.wam#<spawn>`، ولكل خريطة
  طبقة ولادة مسماة (`start` + `from_*` بخاصية `startLayer: true`).
- **مناطق WAM**: `livekitRoomProperty` (حصص صوتية بلا دردشة) و`tooltipPropertyData`
  بلافتات عربية تظهر عند الاقتراب.
- **أمان الطفل**: لا أي URL خارجي في أي خريطة (تحقق اختبارات المرحلة 3)، وكل غرف
  الحصص `disableChat: true` و`startWithVideoMuted: true`.

## إعادة التوليد

```bash
node maps/ng-academy/generate.mjs
```

## التحقق (بوابة القبول)

`play/tests/maps/ngAcademyMaps.test.ts` (45 اختبارًا): مطابقة كل `*.wam` لمخطط
`docs/schema/2.1.0/wam.json` (Ajv)، سلامة شبكات TMJ وصور الـtileset على القرص،
انغلاق مخطط الأبواب (كل `exitUrl` يشير لملف موجود وكل `#spawn` له طبقة ولادة)،
وإلزاميات أمان الطفل أعلاه.
