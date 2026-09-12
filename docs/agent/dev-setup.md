# Development Setup

## Initial setup
```bash
cp .env.template .env
npm install
npm run prepare
docker-compose up
```

## One-command bootstrap (no Docker required)

```bash
npm run bootstrap
```

`./bootstrap.sh` prepares a workstation for the checks that CI runs, in this order:

1. creates `.env` from `.env.template` if missing;
2. makes sure `libs/messages/src/ts-proto-generated/` exists (see below);
3. installs the `play`, `back` and `libs` workspaces with `npm ci`;
4. generates the `typesafe-i18n` files (`play/src/i18n/i18n-*.ts`).

Use `npm run bootstrap -- --proto-only` to only (re)generate the protobuf messages.

### Why the protobuf step is not optional

The generated TypeScript for `messages/protos/*.proto` is **not committed**
(`libs/messages/src/ts-proto-generated/.gitignore`). Every workspace imports
`@workadventure/messages`, so without it you get:

```
Error: Cannot find module './ts-proto-generated/messages' imported from libs/messages/src/index.ts
```

and `typecheck`/`vitest` fail in `play`, `back`, `map-storage` and `libs/*`.

`bootstrap.sh` resolves the compiler in this order:

1. `protoc` on `PATH` — what CI uses (`arduino/setup-protoc@v3`);
2. the `docker compose` **messages** service (`npm run proto:watch`), then `./wait-proto.sh`;
3. the [`protoc`](https://www.npmjs.com/package/protoc) npm package — an unmodified
   redistribution of the official `protoc` binary (Apache-2.0) — installed together with
   `ts-proto` into the git-ignored `.bootstrap-tools/` directory.

Fallback 3 exists because `messages/package.json` drives `grpc_tools_node_protoc` from the
`grpc-tools` npm package, whose prebuilt binary is downloaded from GitHub releases at install
time. That download fails on machines without GitHub access and the source build fails on
recent Node versions, which makes `npm ci` inside `messages/` impossible there.

> Note: `.bootstrap-tools/` is a local convenience. CI and the Docker `messages` service keep
> using `grpc_tools_node_protoc`, so the committed toolchain is unchanged.

### Sandboxed / restricted networks

`play` depends on native modules (`node-datachannel`, `uWebSockets.js` from a Git tag). When
those cannot be fetched or built, `bootstrap.sh` retries the install with
`--ignore-scripts --strict-ssl=false`. That is enough for `typecheck`, `lint`, `prettier` and
`vitest`, but **not** enough to actually run the pusher: use `docker compose up` for that.

## Verifying your setup

```bash
cd play && npm run typecheck && npm run lint && npm run pretty-check && npm test
cd back && npm run typecheck && npm test
cd libs/map-editor && npm test
```
