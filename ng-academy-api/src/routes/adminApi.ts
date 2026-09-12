/**
 * NG Academy — أكاديمية الجيل الجديد
 * The WorkAdventure Admin API contract consumed by the pusher
 * (play/src/pusher/services/AdminApi.ts): capabilities, map, room/access, room/tags.
 * Everything else (woka lists, save-*, ban) is intentionally NOT advertised in
 * capabilities, so the pusher keeps its local behaviour for those.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isMapDetailsData } from "@workadventure/messages/src/JsonMessages/MapDetailsData";
import type { AppDeps } from "../app.js";
import { verifyJwt } from "../auth/jwt.js";

/** playUri like http://play.workadventure.localhost/ng-academy/entrance -> entrance */
export function roomSlugFromPlayUri(playUri: string): string {
  const path = playUri.replace(/\/+$/, "");
  return path.split("/").pop() ?? "entrance";
}

const SCHOOL_ROOMS: Record<string, string> = {
  entrance: "entrance.wam",
  "classroom-arabic": "classroom-arabic.wam",
  "classroom-english": "classroom-english.wam",
  "classroom-math": "classroom-math.wam",
  "classroom-science": "classroom-science.wam",
  "classroom-chess": "classroom-chess.wam",
  "classroom-reading": "classroom-reading.wam",
  "classroom-communication": "classroom-communication.wam",
  library: "library.wam",
  "science-lab": "science-lab.wam",
  theater: "theater.wam",
  "creativity-hall": "creativity-hall.wam",
  "achievements-hall": "achievements-hall.wam",
};

export function registerAdminApiRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  const { config, repo } = deps;

  const checkAdminToken = (authorization: string | undefined): boolean =>
    authorization === config.ADMIN_API_TOKEN;

  app.get("/api/capabilities", async (_req, reply) => {
    // We implement only the mandatory endpoints; optional ones stay local.
    return reply.send({});
  });

  app.get("/api/map", async (req, reply) => {
    if (!checkAdminToken(req.headers.authorization)) {
      return reply.code(401).send({
        status: "error",
        type: "error",
        title: "Unauthorized",
        subtitle: "",
        image: "",
        code: "UNAUTHORIZED",
      });
    }
    const query = z
      .object({ playUri: z.string(), userId: z.string().optional() })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({
        status: "error",
        type: "error",
        title: "Bad request",
        subtitle: "",
        image: "",
        code: "BAD_REQUEST",
      });
    }
    const slug = roomSlugFromPlayUri(query.data.playUri);
    const wam = SCHOOL_ROOMS[slug];
    if (!wam) {
      return reply.code(404).send({
        status: "error",
        type: "error",
        title: "غرفة غير موجودة",
        subtitle: "This room does not exist in the NG Academy school.",
        image: "",
        code: "ROOM_NOT_FOUND",
      });
    }
    const details = isMapDetailsData.parse({
      wamUrl: `${config.NG_MAPS_BASE_URL}/${wam}`,
      group: "ng-academy/school",
      metaTags: {
        title: "أكاديمية الجيل الجديد",
        description: "مدرسة افتراضية آمنة وممتعة للأطفال من 6 إلى 12 سنة.",
      },
      mucRooms: {},
      authTags: [],
      editable: false,
      canReport: false,
      canEdit: false,
      loadingCowebsiteLogo: undefined,
      iframeScripts: [],
    });
    return reply.send(details);
  });

  app.get("/api/room/access", async (req, reply) => {
    if (!checkAdminToken(req.headers.authorization)) {
      return reply.code(401).send({
        status: "error",
        type: "error",
        title: "Unauthorized",
        subtitle: "",
        image: "",
        code: "UNAUTHORIZED",
      });
    }
    const query = z
      .object({
        userIdentifier: z.string(),
        playUri: z.string(),
        accessToken: z.string().optional(),
      })
      .safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({
        status: "error",
        type: "error",
        title: "Bad request",
        subtitle: "",
        image: "",
        code: "BAD_REQUEST",
      });
    }
    const { userIdentifier, playUri, accessToken } = query.data;

    let userId = userIdentifier;
    if (accessToken) {
      const payload = verifyJwt(accessToken, config.JWT_SECRET);
      if (payload) userId = payload.sub;
    }
    const user = await repo.getUserById(userId);
    if (!user) {
      return reply.code(403).send({
        status: "error",
        type: "error",
        title: "دخول غير مصرّح",
        subtitle: "Ask a parent or the school admin to invite you.",
        image: "",
        code: "ROOM_ACCESS_DENIED",
      });
    }

    // Attendance is invisible to the child (requirement 10): entering a
    // classroom room records an "enter" event server-side, silently.
    const slug = roomSlugFromPlayUri(playUri);
    const classes = await repo.listClassesForUser(user);
    const matching = classes.find((c) => c.roomUrl.includes(slug));
    if (matching && user.role === "student") {
      await repo.recordAttendance({
        studentUserId: user.id,
        classId: matching.id,
        kind: "enter",
        at: new Date().toISOString(),
        recordedBy: undefined,
      });
    }

    return reply.send({
      status: "ok",
      email: user.email,
      username: user.displayName,
      userUuid: user.id,
      tags: [`ng-${user.role}`],
      visitCardUrl: null,
      isCharacterTexturesValid: true,
      characterTextures: [],
      isCompanionTextureValid: true,
      companionTexture: null,
      messages: [],
      userRoomToken: "",
      activatedInviteUser: false,
      canEdit: false,
      world: "ng-academy",
      canRecord:
        user.role === "teacher" ||
        user.role === "admin" ||
        user.role === "owner",
      analyticsEventsEnabled: false,
    });
  });

  app.get("/api/room/tags", async (req, reply) => {
    if (!checkAdminToken(req.headers.authorization)) {
      return reply.code(401).send([]);
    }
    // No tag-restricted rooms yet: every authenticated account may enter.
    return reply.send([]);
  });
}
