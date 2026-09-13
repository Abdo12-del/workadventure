/**
 * NG Academy — أكاديمية الجيل الجديد
 * Phase 7 — the in-world half of activities/badges/achievements (requirement 9):
 * a gentle poller of the child's own celebration feed. When the ng-academy-api
 * reports a badge the child has not seen celebrated yet, Gino congratulates
 * them once. No ranking, no other children's data, no nagging:
 *   - disabled entirely unless NG_API_URL is configured AND the child holds a
 *     session token (`ng-token`) obtained through the parent magic-link flow;
 *   - the very first poll only records what already exists (silent), so a
 *     returning child is not spammed with old badges;
 *   - failures (offline, API down) are silent for the child — console only.
 */
import { NG_API_URL } from "../Enum/EnvironmentVariable";
import { ngCelebrate } from "./GinoStore";

/** Requirement 17: weak devices — one gentle request per minute at most. */
export const NG_ACHIEVEMENTS_POLL_MS = 60_000;

const NG_TOKEN_KEY = "ng-token";
const NG_SEEN_KEY = "ng-achievements-seen";

let timer: ReturnType<typeof setInterval> | undefined;
let inFlight = false;

function readSeen(): Set<string> | null {
    const raw = window.localStorage.getItem(NG_SEEN_KEY);
    if (raw === null) return null; // never polled before
    try {
        const parsed: unknown = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
    } catch {
        return new Set();
    }
}

function persistSeen(seen: Set<string>): void {
    window.localStorage.setItem(NG_SEEN_KEY, JSON.stringify([...seen]));
}

async function pollOnce(apiUrl: string): Promise<void> {
    if (inFlight) return;
    const token = window.localStorage.getItem(NG_TOKEN_KEY);
    if (!token) return; // no session: nothing to celebrate, nothing to send
    inFlight = true;
    try {
        const response = await fetch(`${apiUrl.replace(/\/$/, "")}/ng/my/achievements`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const body = (await response.json()) as { achievements: { id: string; badgeName: string }[] };
        if (!Array.isArray(body.achievements)) return;

        const seen = readSeen();
        if (seen === null) {
            // First ever poll: remember everything silently (no celebration storm).
            persistSeen(new Set(body.achievements.map((a) => a.id)));
            return;
        }
        const fresh = body.achievements.filter((a) => !seen.has(a.id));
        if (fresh.length === 0) return;
        for (const achievement of fresh) seen.add(achievement.id);
        persistSeen(seen);

        const [first, ...rest] = fresh;
        const extra = rest.length > 0 ? ` و${rest.length} شارة أخرى` : "";
        ngCelebrate(`مبروك يا بطل! حصلت على شارة «${first?.badgeName ?? ""}»${extra} 🏅`);
    } catch (e) {
        // Offline or API unreachable: the child must never see an error.
        console.warn("NG achievements poll failed (ignored for the child):", e);
    } finally {
        // eslint-disable-next-line require-atomic-updates -- module-level guard reset is intentional; polls are serialised by this very flag
        inFlight = false;
    }
}

/** Start the gentle poller. Call once (see NgAreaWatcher); extra calls are ignored. */
export function ngAchievementsStart(options?: { apiUrl?: string; intervalMs?: number }): void {
    const apiUrl = options?.apiUrl ?? NG_API_URL;
    if (!apiUrl || timer) return;
    const intervalMs = options?.intervalMs ?? NG_ACHIEVEMENTS_POLL_MS;
    timer = setInterval(() => {
        pollOnce(apiUrl).catch((e) => console.warn(e));
    }, intervalMs);
    pollOnce(apiUrl).catch((e) => console.warn(e));
}

export function ngAchievementsStop(): void {
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}

/** Tests only. */
export function ngAchievementsResetForTests(): void {
    ngAchievementsStop();
    inFlight = false;
}

/** Tests only: run one poll cycle and wait for it. */
export function ngAchievementsPollNow(apiUrl: string): Promise<void> {
    return pollOnce(apiUrl);
}
