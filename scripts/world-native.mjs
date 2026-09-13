#!/usr/bin/env node
/*
 * NG Academy — run the walkable school world WITHOUT docker.
 *
 * Starts the four node processes the world needs, wired together on
 * localhost (or any public base you provide via env, e.g. a preview proxy):
 *
 *   1. a tiny static server for ./maps            (port 3101)
 *   2. map-storage  (map metadata / validation)   (port 3000, gRPC 50053)
 *   3. back         (rooms, proximity, sockets)   (port 8080, gRPC 50051)
 *   4. play         (the Vite front you walk in)  (port 3104)
 *
 * Usage:  npm run world:native
 * Env overrides (only needed behind proxies / previews):
 *   MAPS_PUBLIC_URL, MAP_STORAGE_PUBLIC_URL, BACK_PUBLIC_URL, PLAY_PUBLIC_URL,
 *   NG_PLAY_PORT, NG_BACK_HTTP_PORT
 * Then open PLAY_PUBLIC_URL (default http://localhost:3104), pick a name and
 * a cartoon avatar, and walk into the school. No Redis, no Postgres, no
 * LiveKit and no docker required: voice bubbles simply stay off until a
 * LiveKit host is configured.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* .env (created by bootstrap.sh) supplies SECRET_KEY & tuning defaults. */
const base = {};
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
        if (m) base[m[1]] = m[2].replace(/^"|"$/g, "");
    }
}

const ports = {
    maps: Number(process.env.NG_MAPS_PORT || 3101),
    ms: Number(process.env.NG_MS_HTTP_PORT || 3000),
    back: Number(process.env.NG_BACK_HTTP_PORT || 8080),
    play: Number(process.env.NG_PLAY_PORT || 3104),
};
const grpc = { back: 50051, ms: 50053 };
const pub = {
    maps: process.env.MAPS_PUBLIC_URL || `http://localhost:${ports.maps}`,
    ms: process.env.MAP_STORAGE_PUBLIC_URL || `http://localhost:${ports.ms}`,
    back: process.env.BACK_PUBLIC_URL || `http://localhost:${ports.back}`,
    play: process.env.PLAY_PUBLIC_URL || `http://localhost:${ports.play}`,
};
const secret = base.SECRET_KEY || "ng-academy-dev-secret";

/* ---------------------------------------------------------------- static maps */
const MIME = {
    ".wam": "application/json",
    ".tmj": "application/json",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".css": "text/css",
    ".js": "text/javascript",
};
const mapsDir = path.join(root, "maps");
http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const file = path.join(mapsDir, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(mapsDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { "access-control-allow-origin": "*" }).end("not found");
        return;
    }
    res.writeHead(200, {
        "content-type": MIME[path.extname(file)] || "application/octet-stream",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
}).listen(ports.maps, "0.0.0.0", () => console.log(`[maps]        static ./maps on :${ports.maps}`));

/* ------------------------------------------------------------------- children */
const children = [];
function run(tag, cwd, args, extra) {
    const child = spawn(args[0], args.slice(1), {
        cwd: path.join(root, cwd),
        env: { ...process.env, ...base, ...extra },
        stdio: ["ignore", "pipe", "pipe"],
    });
    const prefix = (stream) => (data) => {
        for (const line of data.toString().split("\n")) if (line.trim()) console.log(`[${tag}] ${line}`);
        void stream;
    };
    child.stdout.on("data", prefix("out"));
    child.stderr.on("data", prefix("err"));
    child.on("exit", (code) => console.log(`[${tag}] exited with ${code}`));
    children.push(child);
    return child;
}

run("map-storage", "map-storage", ["npx", "tsx", "src/index.ts"], {
    NODE_ENV: "development",
    ESBK_TSCONFIG_PATH: "tsconfig-node.json",
    API_URL: `127.0.0.1:${grpc.back}`,
    PUSHER_URL: pub.play,
    SECRET_KEY: secret,
    PATH_PREFIX: "",
    MAP_STORAGE_API_TOKEN: "ng-local-mapstorage-token",
    ENABLE_BASIC_AUTHENTICATION: "false",
    ENABLE_BEARER_AUTHENTICATION: "false",
    WHITELISTED_RESOURCE_URLS: "",
});

run("back", "back", ["npx", "tsx", "src/server.ts"], {
    NODE_ENV: "development",
    PLAY_URL: pub.play,
    FRONT_URL: pub.play,
    SECRET_KEY: secret,
    SECRET_JITSI_KEY: "",
    JITSI_URL: "",
    JITSI_ISS: "",
    BBB_URL: "",
    BBB_SECRET: "",
    ENABLE_MAP_EDITOR: "false",
    ADMIN_API_URL: "",
    ADMIN_API_TOKEN: "",
    ALLOW_ARTILLERY: "false",
    MINIMUM_DISTANCE: base.MINIMUM_DISTANCE || "50",
    GROUP_RADIUS: base.GROUP_RADIUS || "80",
    MAX_PER_GROUP: base.MAX_PER_GROUP || "20",
    REDIS_HOST: "",
    STORE_VARIABLES_FOR_LOCAL_MAPS: "true",
    PROMETHEUS_AUTHORIZATION_TOKEN: "",
    MAP_STORAGE_URL: `127.0.0.1:${grpc.ms}`,
    PUBLIC_MAP_STORAGE_URL: pub.ms,
    INTERNAL_MAP_STORAGE_URL: `http://127.0.0.1:${ports.ms}`,
    PLAYER_VARIABLES_MAX_TTL: base.PLAYER_VARIABLES_MAX_TTL || "86400000",
    ENABLE_CHAT: "false",
    ENABLE_CHAT_UPLOAD: "false",
    ENABLE_CHAT_ONLINE_LIST: "false",
    ENABLE_CHAT_DISCONNECTED_LIST: "false",
    HTTP_PORT: String(ports.back),
    GRPC_PORT: String(grpc.back),
    PROMETHEUS_PORT: "0",
    ENABLE_TELEMETRY: "false",
});

run("play", "play", ["npx", "vite", "--port", String(ports.play)], {
    NODE_ENV: "development",
    PUSHER_URL: pub.back,
    FRONT_URL: pub.play,
    UPLOADER_URL: pub.play,
    ICON_URL: pub.play,
    OPENID_LOGOUT_REDIRECT_URL: "",
    SECRET_KEY: secret,
    ADMIN_API_URL: "",
    API_URL: `127.0.0.1:${grpc.back}`,
    MAP_STORAGE_URL: `127.0.0.1:${grpc.ms}`,
    PUBLIC_MAP_STORAGE_URL: pub.ms,
    INTERNAL_MAP_STORAGE_URL: `http://127.0.0.1:${ports.ms}`,
    START_ROOM_URL: `${pub.maps}/ng-academy/entrance.wam`,
    DEBUG_MODE: "false",
    ENABLE_CHAT: "false",
    ENABLE_MAP_EDITOR: "false",
    ENABLE_OPENID: "false",
    WOKA_TURN_SOUND: "false",
});

console.log("");
console.log("  NG Academy world (no docker) is starting…");
console.log(`  walk in : ${pub.play}`);
console.log(`  maps    : ${pub.maps}/ng-academy/entrance.wam`);
console.log("");

for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
        for (const child of children) child.kill(sig);
        process.exit(0);
    });
}
