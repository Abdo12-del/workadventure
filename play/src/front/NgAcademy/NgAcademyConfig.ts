/**
 * NG Academy — أكاديمية الجيل الجديد
 * Configuration of the in-world companions: Gino the owl guide and the teachers.
 *
 * Everything here is keyed by WAM *area names* (see maps/ng-academy/generate.mjs),
 * so the world maps stay the single source of truth for WHERE things happen,
 * while this file decides WHO speaks and WHAT they say.
 *
 * Child-safety & comfort rules baked in:
 *  - no free text chat anywhere: children only ever READ short curated bubbles;
 *  - Gino never nags: explanations appear once per session per area, one bubble
 *    at a time, auto-dismissed, and always dismissible;
 *  - all strings are short, warm Arabic a 6-year-old can parse without help.
 */

export interface NgTeacher {
    /** Display name shown on the bubble. */
    name: string;
    /** One-line role, e.g. "معلمة اللغة العربية". */
    role: string;
    /** Cartoon portrait (never a real photo). */
    portrait: string;
    /** What the teacher says when a child approaches, once per session. */
    greeting: string;
}

const TEACHER_PORTRAITS = {
    hasiba: "/static/images/ng/teachers/hasiba.png",
    meryem: "/static/images/ng/teachers/meryem.png",
    sami: "/static/images/ng/teachers/sami.png",
} as const;

export const GINO_PORTRAIT = "/static/images/ng/gino.png";

/** Teacher zones: area name (in the classroom WAMs) -> teacher identity. */
export const NG_TEACHERS: Record<string, NgTeacher> = {
    "teacher-arabic": {
        name: "أستاذة حسيبة",
        role: "معلمة اللغة العربية",
        portrait: TEACHER_PORTRAITS.hasiba,
        greeting: "أهلًا بك يا بطل! اقترب من السبورة لنقرأ معًا 📖",
    },
    "teacher-reading": {
        name: "أستاذة حسيبة",
        role: "معلمة القراءة والكتابة",
        portrait: TEACHER_PORTRAITS.hasiba,
        greeting: "مرحبًا! اليوم نكتب كلمة جديدة حلوة… جهّز قلمك الخيالي ✏️",
    },
    "teacher-english": {
        name: "أستاذة مريم",
        role: "معلمة اللغة الإنجليزية",
        portrait: TEACHER_PORTRAITS.meryem,
        greeting: "Hello hello! سعيدة برؤيتك، اليوم نتعلم كلمة FRIEND أي صديق 🤝",
    },
    "teacher-communication": {
        name: "أستاذة مريم",
        role: "معلمة مهارات التواصل",
        portrait: TEACHER_PORTRAITS.meryem,
        greeting: "أهلًا! اليوم نتدرب على التحية والاستماع الجميل 👂💙",
    },
    "teacher-math": {
        name: "أستاذ سامي",
        role: "معلم الرياضيات",
        portrait: TEACHER_PORTRAITS.sami,
        greeting: "يا مرحبا! عندنا لغز أرقام اليوم… جاهز تكشفه معي؟ 🔢",
    },
    "teacher-science": {
        name: "أستاذ سامي",
        role: "معلم العلوم",
        portrait: TEACHER_PORTRAITS.sami,
        greeting: "أهلًا بعالم صغير! اليوم نجري تجربة مدهشة 🔬",
    },
    "teacher-chess": {
        name: "أستاذ سامي",
        role: "مدرب الشطرنج",
        portrait: TEACHER_PORTRAITS.sami,
        greeting: "مرحبًا أيها البطل! رقعة الشطرنج تنتظر حركة ذكية ♟️",
    },
};

/**
 * Gino's one-time explanations, keyed by area name.
 * Areas not listed here still get the small "you are here" banner.
 */
export const NG_GINO_EXPLAIN: Record<string, string> = {
    reception: "هذا الاستقبال! هنا نبدأ يومنا، ومن هنا تعرف أين تذهب 🏫",
    yard: "هذه الساحة! العب واسترح مع أصدقائك بين الحصص 🌳",
    lesson: "هنا الحصة! اضغط زر «دخول الحصة» لتسمع صوت معلمك وتتحدث معه 🎧",
    reading: "ركن هادئ للقراءة… افتح كتابًا تخيليًا واستمتع 📚",
    lab: "طاولات التجارب! اقترب مع معلمك لتشاهد العلوم بأم عينيك 🔬",
    stage: "خشبة المسرح! هنا تعرض إنجازك ويقصف لك الجميع 🎭",
    audience: "مقاعد الجمهور… صفّق لأصدقائك بحرارة 👏",
    makerspace: "مساحة الإبداع! ارسم وابنِ وابتكر مع أصدقائك 🎨",
    trophies: "جدار إنجازاتك! كل شارة تحصل عليها تُعلَّق هنا بفخر 🏆",
    carpet: "ساحة التكريم… يومًا ما سيقف اسمك هنا لامعًا ⭐",
};

export const NG_WELCOME_MESSAGE =
    "مرحبًا بك في أكاديمية الجيل الجديد 👋 أنا جينو، بومتك المرشد! امشِ في المدرسة، وعندما تقترب من مكان جديد سأهمس لك بسرّه — مرة واحدة فقط، أعدك 🦉";

/** Small banner shown when the child moves between places (throttled). */
export const NG_LOCATION_PREFIX = "أنت الآن في";
