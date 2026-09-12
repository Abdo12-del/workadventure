#!/usr/bin/env bash
#
# NG Academy / WorkAdventure — developer bootstrap
#
# Prepares a workstation so the TypeScript workspaces can be typechecked, linted and tested.
# The repository does not commit the code generated from `messages/protos/*.proto`
# (see libs/messages/src/ts-proto-generated/.gitignore), so generating it is a hard
# prerequisite for almost every check.
#
# Resolution order for the Protobuf compiler:
#   1. `protoc` already on PATH (this is what CI provides via arduino/setup-protoc)
#   2. `docker compose` -> the `messages` service generates the files for you
#   3. the `protoc` npm package (an unmodified redistribution of the official protoc
#      binary, Apache-2.0) installed into the git-ignored `.bootstrap-tools/` directory
#
# Usage:
#   npm run bootstrap                # full bootstrap
#   npm run bootstrap -- --proto-only   # only make sure the protobuf messages exist
#
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$ROOT_DIR/.bootstrap-tools"
GENERATED_DIR="$ROOT_DIR/libs/messages/src/ts-proto-generated"
PROTO_DIR="$ROOT_DIR/messages/protos"

# Kept in sync with messages/package.json (ts-proto) so locally generated code matches CI.
TS_PROTO_VERSION="2.11.8"
PROTOC_NPM_VERSION="36.0.0"

PROTO_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --proto-only) PROTO_ONLY=1 ;;
        -h|--help)
            sed -n '2,25p' "${BASH_SOURCE[0]}"
            exit 0
            ;;
        *) echo "bootstrap: unknown option '$arg' (try --help)" >&2; exit 2 ;;
    esac
done

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
ok() { printf '\033[1;32m  ok\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m  warn\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m  fail\033[0m %s\n' "$1" >&2; }

cd "$ROOT_DIR" || exit 1

# ---------------------------------------------------------------------------
# 0. Sanity checks
# ---------------------------------------------------------------------------
if ! command -v npm >/dev/null 2>&1; then
    fail "npm is required but was not found on PATH."
    exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 22 ]; then
    warn "Node $NODE_MAJOR detected. CI runs Node 24; Node >= 22 is strongly recommended."
fi

if [ ! -f "$ROOT_DIR/.env" ]; then
    info "Creating .env from .env.template"
    cp "$ROOT_DIR/.env.template" "$ROOT_DIR/.env"
    ok ".env created (review it before running docker compose)"
fi

# ---------------------------------------------------------------------------
# 1. Protobuf messages
# ---------------------------------------------------------------------------
messages_already_generated() {
    [ -s "$GENERATED_DIR/messages.ts" ] && [ -s "$GENERATED_DIR/services.ts" ]
}

generate_with_protoc() {
    # $1 = path to a protoc binary
    local protoc_bin="$1"
    local plugin_path

    mkdir -p "$GENERATED_DIR"
    if [ ! -x "$TOOLS_DIR/node_modules/.bin/protoc-gen-ts_proto" ] &&
        [ ! -f "$TOOLS_DIR/node_modules/.bin/protoc-gen-ts_proto.cmd" ]; then
        info "Installing the ts-proto toolchain into .bootstrap-tools/ (git-ignored)"
        mkdir -p "$TOOLS_DIR"
        if [ ! -f "$TOOLS_DIR/package.json" ]; then
            printf '{"name":"wa-bootstrap-tools","private":true,"version":"1.0.0"}\n' >"$TOOLS_DIR/package.json"
        fi
        (
            cd "$TOOLS_DIR" &&
                npm install --no-audit --no-fund --ignore-scripts \
                    "ts-proto@$TS_PROTO_VERSION" "protoc@$PROTOC_NPM_VERSION" >/dev/null
        ) || {
            fail "could not install ts-proto@$TS_PROTO_VERSION into .bootstrap-tools/"
            return 1
        }
    fi

    plugin_path="$TOOLS_DIR/node_modules/.bin/protoc-gen-ts_proto"
    info "Generating TypeScript messages with $($protoc_bin --version 2>/dev/null || echo protoc)"
    PATH="$TOOLS_DIR/node_modules/.bin:$PATH" "$protoc_bin" \
        --plugin="protoc-gen-ts_proto=$plugin_path" \
        --ts_proto_out="$GENERATED_DIR" \
        --ts_proto_opt=outputServices=grpc-js \
        --ts_proto_opt=oneof=unions \
        --ts_proto_opt=esModuleInterop=true \
        -I "$PROTO_DIR" \
        "$PROTO_DIR"/*.proto || {
        fail "protoc could not generate the messages"
        return 1
    }

    # Same post-processing as `messages/package.json > ts-proto`: the generated files are
    # not type-checked, they are consumed as-is by the workspaces.
    sed -i '1i\//@ts-nocheck' "$GENERATED_DIR"/*.ts 2>/dev/null ||
        find "$GENERATED_DIR" -maxdepth 1 -name '*.ts' -exec sed -i '' '1i\
//@ts-nocheck
' {} \;
    ok "generated $(ls -1 "$GENERATED_DIR"/*.ts | wc -l | tr -d ' ') file(s) in libs/messages/src/ts-proto-generated/"
}

if messages_already_generated; then
    ok "protobuf messages already generated (delete libs/messages/src/ts-proto-generated/*.ts to force a rebuild)"
elif command -v protoc >/dev/null 2>&1; then
    generate_with_protoc "$(command -v protoc)"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    info "No protoc on PATH — asking the docker compose 'messages' service to generate it"
    warn "run './wait-proto.sh' (or re-run bootstrap) once the container is up"
    docker compose up -d messages >/dev/null 2>&1 &&
        "$ROOT_DIR/wait-proto.sh" &&
        ok "generated by the docker compose 'messages' service"
else
    info "No protoc and no docker — falling back to the npm 'protoc' package"
    generate_with_protoc "$TOOLS_DIR/node_modules/.bin/protoc"
fi

if ! messages_already_generated; then
    warn "protobuf messages are still missing; 'npm run typecheck' will fail until they exist."
fi

if [ "$PROTO_ONLY" -eq 1 ]; then
    exit 0
fi

# ---------------------------------------------------------------------------
# 2. Dependencies
# ---------------------------------------------------------------------------
install_workspaces() {
    local extra_flags="$1"
    npm ci --workspace=workadventure-play \
        --workspace=workadventureback \
        --workspace=@workadventure/messages \
        --workspace=@workadventure/shared-utils \
        --workspace=@workadventure/map-editor \
        --include-workspace-root --no-audit --no-fund $extra_flags
}

if [ ! -d "$ROOT_DIR/node_modules" ] || [ ! -d "$ROOT_DIR/node_modules/typescript" ]; then
    info "Installing npm workspaces (play, back, libs)"
    if ! install_workspaces ""; then
        warn "full install failed (native modules such as node-datachannel/uWebSockets.js need a toolchain or network access)"
        info "retrying with --ignore-scripts --strict-ssl=false"
        if install_workspaces "--ignore-scripts --strict-ssl=false"; then
            ok "dependencies installed without lifecycle scripts"
            warn "native modules were NOT built: the pusher server and WebRTC runtime need a full install (or docker compose) to run."
            npx --no-install patch-package >/dev/null 2>&1 && ok "phaser patch applied"
        else
            fail "could not install dependencies. On a normal machine, run: npm install"
            exit 1
        fi
    else
        ok "dependencies installed"
    fi
else
    ok "node_modules already present (delete it to force a reinstall)"
fi

# ---------------------------------------------------------------------------
# 3. Generated i18n files
# ---------------------------------------------------------------------------
if [ -x "$ROOT_DIR/node_modules/.bin/typesafe-i18n" ] || [ -f "$ROOT_DIR/node_modules/.bin/typesafe-i18n" ]; then
    info "Generating i18n types (play)"
    (cd "$ROOT_DIR/play" && npm run typesafe-i18n >/dev/null 2>&1) &&
        ok "play/src/i18n/i18n-*.ts generated" ||
        warn "typesafe-i18n failed; run 'cd play && npm run typesafe-i18n' manually"
else
    warn "typesafe-i18n not installed — skipping i18n generation"
fi

# ---------------------------------------------------------------------------
# 4. Summary
# ---------------------------------------------------------------------------
cat <<'EOF'

Bootstrap finished. Useful next steps:

  cd play && npm run typecheck && npm run lint && npm test
  cd back && npm run typecheck && npm test
  cd libs/map-editor && npm test

  cp .env.template .env && docker compose up      # full local stack
  open http://play.workadventure.localhost/       # (add the /etc/hosts entries from README.md)

EOF
