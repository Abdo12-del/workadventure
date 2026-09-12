/**
 * Child safety policy — NG Academy (أكاديمية الجيل الجديد)
 *
 * The platform targets children (6-12). When child-safe mode is enabled (the default),
 * the front refuses to navigate to, or embed, any URL outside a strict allowlist:
 *
 *   - same-origin URLs (the academy itself);
 *   - hosts of the platform's own services (pusher, uploader, icon server, Jitsi/LiveKit…);
 *   - the host serving the currently loaded map and its assets;
 *   - domains explicitly allowlisted by the deployment (EMBEDDED_DOMAINS_WHITELIST).
 *
 * Everything else is blocked: external `openTab` links, co-websites, `WA.ui.website`
 * iframes, embedded in-map websites and `goToPage` navigations. Non-http(s) schemes
 * (`javascript:`, `data:`, `blob:`…) are always refused.
 *
 * Blocked attempts are silent for the child (nothing opens) and logged with
 * `console.warn` so a teacher or developer inspecting the session can understand
 * why a curated resource did not show up.
 */
import {
    CHILD_SAFE_MODE,
    EMBEDDED_DOMAINS_WHITELIST,
    ICON_URL,
    JITSI_URL,
    PUSHER_URL,
    UPLOADER_URL,
} from "../Enum/EnvironmentVariable";

export class ChildSafetyBlockedError extends Error {
    constructor(
        public readonly context: string,
        public readonly blockedUrl: string,
    ) {
        super(`[child-safety] ${context}: URL "${blockedUrl}" is not allowed for children.`);
        this.name = "ChildSafetyBlockedError";
    }
}

/** Hosts trusted because they belong to the platform itself (computed once from the front config). */
const serviceHosts = new Set<string>();
/** Hosts registered at runtime (e.g. the map server of the currently loaded map). */
const runtimeTrustedHosts = new Set<string>();

function hostOf(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
        return new URL(url, window.location.origin).hostname.toLowerCase();
    } catch {
        return undefined;
    }
}

for (const candidate of [PUSHER_URL, UPLOADER_URL, ICON_URL, JITSI_URL]) {
    const host = hostOf(candidate);
    if (host) serviceHosts.add(host);
}

/** Child-safe mode is ON by default: this is a children's platform. */
export function childSafeModeEnabled(): boolean {
    return CHILD_SAFE_MODE;
}

/** Adds a domain (without scheme/path) to the deployment allowlist at runtime. Mainly useful for tests. */
export function trustHost(host: string): void {
    const clean = host.toLowerCase().trim();
    if (clean) runtimeTrustedHosts.add(clean);
}

/**
 * The deployment allowlist: reuses the existing EMBEDDED_DOMAINS_WHITELIST setting
 * ("domains allowed for embedded iframes") so administrators keep a single knob.
 */
export function configuredAllowedDomains(): string[] {
    return EMBEDDED_DOMAINS_WHITELIST ?? [];
}

function matchesAllowedHost(hostname: string, allowed: string): boolean {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
}

/**
 * Whether the given URL may be opened or embedded while child-safe mode is enabled.
 * Relative URLs are resolved against the current origin and therefore allowed.
 */
export function isUrlAllowedForChildren(rawUrl: string | URL): boolean {
    if (!childSafeModeEnabled()) return true;

    let url: URL;
    try {
        url = new URL(String(rawUrl), window.location.origin);
    } catch {
        return false;
    }

    // Only plain web resources: no javascript:, data:, blob:, file:…
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    if (hostname === window.location.hostname) return true;
    if (serviceHosts.has(hostname) || runtimeTrustedHosts.has(hostname)) return true;

    return configuredAllowedDomains().some((allowed) => matchesAllowedHost(hostname, allowed));
}

/** Logs a blocked attempt (silent for the child, visible for teachers/developers). */
export function warnBlocked(context: string, url: string | URL): void {
    console.warn(`[child-safety] ${context}: blocked "${String(url)}" (not in the allowed domains for children).`);
}

/** Throws a ChildSafetyBlockedError when the URL is not embeddable. */
export function assertEmbeddableForChildren(context: string, url: string | URL): void {
    if (!isUrlAllowedForChildren(url)) {
        warnBlocked(context, url);
        throw new ChildSafetyBlockedError(context, String(url));
    }
}
