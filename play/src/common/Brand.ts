/**
 * NG Academy — أكاديمية الجيل الجديد
 *
 * Single source of truth for the product identity. The virtual school platform is a
 * fork of the WorkAdventure engine, but children (and their parents) must never see
 * the engine's branding: every user-facing default (document title, PWA manifest,
 * theme colour, Open Graph cards) reads from here.
 *
 * Visual language (see brand/ in the repository root):
 *  - primary sky blue  #38b6ff  (Gino the owl, app mark, primary actions)
 *  - white + soft pastels, rounded shapes, friendly icons
 *  - clean, uncrowded layouts; no "techy" or overly commercial look
 */

export const BRAND_NAME = "NG Academy";

export const BRAND_NAME_AR = "أكاديمية الجيل الجديد";

/** Very short label, for PWA home screens and space-constrained UI. */
export const BRAND_SHORT_NAME = "NG";

export const BRAND_DESCRIPTION =
    "NG Academy — أكاديمية الجيل الجديد: مدرسة افتراضية آمنة وممتعة للأطفال. ادخل مدرستك، تجوّل بين فصولها ومكتبتها ومسرحها، وتعلّم باللعب مع أصدقائك ومعلميك.";

export const BRAND_AUTHOR = "NG Academy";

export const BRAND_PROVIDER = "NG Academy";

/** Primary identity colour (sky blue). */
export const BRAND_THEME_COLOR = "#38b6ff";

/** Splash / install background: clean white for a calm, child-friendly feel. */
export const BRAND_BACKGROUND_COLOR = "#ffffff";

/** Default document language of the academy. RTL is handled by play/src/front/Utils/locales.ts. */
export const BRAND_DEFAULT_LANG = "ar";

export const BRAND_FAVICON = "/static/images/favicons/favicon-512x512.svg";

export const BRAND_ICON_512 = "/static/images/favicons/icon-512x512.png";

export const BRAND_CARD_IMAGE = "/static/images/ng/icon-1024.png";

/** Gino, the academy owl guide (character art, transparent background). */
export const BRAND_MASCOT = "/static/images/ng/gino.png";
