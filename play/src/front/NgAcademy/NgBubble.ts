/** A single speech bubble shown to the child by Gino, a teacher, or the location banner. */
export interface NgBubble {
    /** gino = the owl guide, teacher = an NPC teacher, location = the small "you are here" pill. */
    kind: "gino" | "teacher" | "location";
    /** Name shown above the text (empty for the location pill). */
    speaker: string;
    /** Optional one-line role, e.g. "معلمة اللغة العربية". */
    role?: string;
    /** The message itself: short, warm Arabic. */
    text: string;
    /** Cartoon portrait path (never a real photo); empty for the location pill. */
    portrait: string;
    /** Auto-dismiss delay in milliseconds. */
    duration: number;
}
