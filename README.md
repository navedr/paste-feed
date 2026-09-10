### Introduction

**Paste Feed** is a personal micro feed where you can post snippets of
text or images.

The primary use case is to share information between computers when you don't
have the possibility to copy/paste, like on a restricted VDI environment.

Open the feed on your local computer, and the remote one, then everything will
be kept in sync when you add or remove items.

### Concepts

On Paste Feed home page, you are invited to create a feed with a unique name.

Once on a feed, you can paste data in it, text or images, they will be
displayed with the newest items at the top.

Paste anywhere outside editable fields, use the toolbar upload icon to choose
multiple files, or drop files onto the feed. Each
file shows its own progress and is marked saved after the server confirms it.
Failed files show an explanation and a Retry button. Files upload in sequence;
the upload size limit applies to each file. Leaving the feed cancels pending
uploads, so keep it open until the queue finishes.

The connection badge shows connecting, syncing, connected, reconnecting, or
offline, alongside the last sync time. Reconnecting fetches the current feed.

You can then decide to share the feed two different ways :

- Copy a secret link to the feed, that you can paste on a different computer,
you will be automatically authenticated
- Set a temporary 4 digit PIN. You then go to another computer and open the
feed. You will be prompted for the PIN to unlock it.

### Screenshot

![Screenshot](assets/screenshot.png)

### Caveats

This is just a side project I'm working on, so there is probably lots of issues.

Feel free to open GitHub issues to reuest features or bug fixes.

Here are some I already identified :

- Paste might not work over non secured connections (https), this is a
limitation as a security measure with some web browsers
- Paste Feed relies on a cookie to authenticate a session, if the cookie is lost
there is no easy way to retrieve the feed (you can get it back from the
`config.json` file in the feed directory)
- Most modern browser won't honor long cookie lifetime, you might have to
recover the secret from `config.json` if it happens.
- Security could probably be improved, tokens and PINs are stored in clear on
the filesystem
- No rate control or capacity limits, quite exposed to flooding as it is

### Run with Docker

Build and start from this checkout (requires Docker with Compose):

```sh
mkdir -p data
docker compose -f docker-compose-prod.yml up -d --build
```

Open http://localhost:8090. The image contains both the UI and TypeScript
server. Compose mounts `./data` at `/data`; feed files, configuration, and push
notification keys survive container replacement. Back up that directory before
upgrading from the Go version, and keep it mounted at `/data`.

Check startup and health:

```sh
docker compose -f docker-compose-prod.yml ps
docker compose -f docker-compose-prod.yml logs --tail=100
```

To build an image and run it directly:

```sh
docker build --secret id=npmrc,src="$HOME/.npmrc" -t paste-feed:latest .
docker run -d --name paste-feed --restart unless-stopped \
  -p 8090:8080 -v "$(pwd)/data:/data" paste-feed:latest
```

The registry requires authentication in your user `~/.npmrc`. Compose and the
build command pass that file as a BuildKit secret; credentials are not copied
into the image.

The image runs the test suite during its build, installs locked production
dependencies, and checks `/api` for health. Put it behind an HTTPS reverse proxy
for browser clipboard and push notification support; forward `/ws` WebSocket
upgrades as well as ordinary HTTP traffic.

`docker-compose.yml` is the alternative configuration for the prebuilt
`navedrangwala/paste-feed:latest` image. Building locally does not update that
registry image.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FEED_DATA_DIR` | `/data` in Docker; `./data` locally | Persistent feed and configuration directory. |
| `FEED_HTTP_PORT` | `8080` | Server TCP port. |
| `FEED_LISTEN_ADDR` | `0.0.0.0` | Bind address. |
| `FEED_MAX_UPLOAD_SIZE` | `5` | Maximum file size in MiB; one file per upload. |
| `MASTER_PIN` | unset | Optional four-digit PIN that unlocks every feed. |

Set overrides in Compose's `environment` section or with `docker run -e`.
`PUID`, `PGID`, and `UMASK` are not interpreted by this Node image. If you need a
specific container identity, use Compose `user: "uid:gid"` and give that identity
write access to the mounted data directory.

### Local development

Use Node.js 22 and install from the repository root. The project uses
`https://npm.ecar1.us/` via `.npmrc`:

```sh
npm ci --legacy-peer-deps
npm run dev
```

In another terminal, run `npm run dev:ui` and open http://localhost:5173.
The Vite server forwards API and WebSocket requests to port 8080.

```sh
npm test
npm run build
npm start
```

The built server serves the UI at http://localhost:8080. Tests use temporary
storage and do not touch your local feeds. Docker smoke tests can be run with
`npm run test:docker` after building `paste-feed:latest`; they create and remove
an isolated container and volume to verify startup, uploads, and persistence.

### WebSocket recovery

The browser requests a fresh snapshot on every connection and retries dropped
connections after one second. It sends a heartbeat every 25 seconds and
reconnects if no reply arrives within 10 seconds. Opening handshakes also have
a 10-second deadline. Leaving the feed cancels retries and heartbeat timers.

The server checks ping/pong liveness every 30 seconds and terminates clients
that miss a response. Outgoing queued data, including the next message, is
limited to 8 MiB per connection; this also limits a single feed snapshot to
8 MiB. Connections exceeding that bound are terminated. SIGTERM and SIGINT
close WebSockets before draining HTTP requests, with a 10-second shutdown limit.
