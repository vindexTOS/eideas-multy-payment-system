# Eideas Terminal Emulator

Virtual payment terminals for testing the platform's MQTT listener without
hardware. Each one opens its own MQTT connection, publishes events where a
real terminal would, and receives the platform's config and commands. The
listener cannot tell it from a real terminal, except by its uid prefix.

It is a separate app with its own UI, its own database and its own login:

- **Own folder, own stack.** Its own `docker-compose.yml`, `Dockerfile` and
  `.env`. The platform's compose file, server and client know nothing about
  it. Delete `emulator/` and the platform is unchanged.
- **Own database.** A SQLite file (`node:sqlite`, built into Node), not the
  platform's Postgres.
- **Super admin only.** One account, set in the emulator's env. Platform
  logins do not work here, and an emulator session does not work on the
  platform.
- **Cannot impersonate a real terminal.** Every uid starts with
  `EMULATOR_UID_PREFIX` (`EMU-`), so a virtual terminal can never take a real
  terminal's uid and book fake money against a real company. The header shows
  the broker and topic root at all times, so you always know which listener
  you are talking to.

```
emulator/
├─ docker-compose.yml   run it on its own
├─ .env                 its own settings (copy of .env.example)
├─ server/              NestJS: auth, SQLite, one MQTT client per terminal
└─ ui/                  React + Ant Design, served by the server
```

## Run it

### Docker

```bash
cd emulator
docker compose up -d --build
```

That is all it needs. Open http://localhost:8095 and sign in with the login
printed on first boot:

```bash
docker compose logs emulator | grep "super admin login"
```

The generated password is printed once and kept (hashed) in the emulator's
own volume, so it survives restarts and rebuilds. Lost it? Set
`EMULATOR_SUPER_ADMIN_PASSWORD` in `.env`, which always wins, or run
`docker compose down -v` to start over (this also deletes the virtual
terminals).

With no `.env` it talks to the platform's default broker: the Mosquitto on
the same machine (`mqtt://host.docker.internal`, root `Pay`). That is the
right default when it runs on the server next to the platform. To point it
elsewhere (running it on your laptop means `MQTT_URL=mqtt://<server>`),
choose your own password, or change the port, `cp .env.example .env`, edit,
and run `docker compose up -d` again. The broker and root must be the same
as the listener's.

### Local development

```bash
cd emulator && cp .env.example .env
cd server && npm install && npm run start:dev    # API on :8095, reads ../.env
cd ui && npm install && npm run dev              # UI on :5180, proxies /api
```

## Testing the platform with it

1. **Create a device.** It connects and announces its status (`0x82` idle).
2. **In the platform panel**, open *Unregistered devices* and register the
   `EMU-…` uid to a company.
3. **Command it through the platform API** (the panel has no buttons for these
   yet; use Swagger at `/api/docs`, `/api/devices/:id/config` and
   `/api/devices/:id/commands/...`) and watch the frames arrive in the
   device's live log:
   - change its terminal config, which shows up under *Config from the server*;
   - send a set-amount, which the terminal charges and answers;
   - run a reconciliation, which the terminal answers with `0xBB`.
4. **Pay from the emulator.** The payment appears in the panel's payments and
   earnings.

## What a virtual terminal does

| From the server | The terminal |
|---|---|
| `0x01`–`0x08` config | Applies it, shows it under *Config from the server*, and keeps it across restarts. An out-of-spec value is rejected and logged, as strict firmware would |
| `0x50` set amount | Goes busy (`0x82`=1), charges, answers `0x80` amount + `0x81` result, goes idle. A successful charge logs the pulse output it implies (amount ÷ scale factor, at the configured frequency and duty) |
| `0x51` reconcile | Goes busy, answers `0xBB` result, goes idle |

**Auto** mode answers by itself after a delay, with the result you choose.
**Manual** mode waits, like a terminal waiting for a card, until you answer
from the device page with any result: Success, Reject, No Connection, and so
on. In auto mode you can still answer early.

From the device page you can also send, unprompted:

- **Payment:** `0x80` + `0x81`, any amount 0.01–100.00 GEL, any result.
- **Status:** `0x82` idle or busy.
- **Operation:** cancel, wait, return, void or reconciliation, with a result
  and an optional amount.
- **Raw hex:** exact bytes, spec or not. This is how you check what the
  listener does with a malformed or wrong-byte-order frame.

A heartbeat (the current `0x82` on `events/heartbeat`) every 60 s keeps the
terminal online in the panel; it can be changed or turned off per device.

Connections use a stable client id (`emu-<uid>`) and a persistent session,
like hardware: commands the platform sends while a virtual terminal is
disconnected arrive when it reconnects.

## Notes

- **One emulator per database.** Two instances driving the same uids would use
  the same MQTT client ids and keep evicting each other.
- **The protocol is the emulator's own copy**
  (`server/src/protocol/terminal-protocol.ts`), written from the spec rather
  than imported from the platform, so it behaves like firmware built from the
  same document. If the spec changes, change both.
- **Byte order, as the platform currently assumes it:** terminal → server
  frames carry the clock big-endian, server → terminal little-endian, and
  values are little-endian both ways.
- **Removing a device** disconnects it and deletes its log. Whatever the
  platform already recorded (payments, its device row) stays.

## API

All under `/api`, all super admin except `POST /auth/login` and `GET /health`.

| Method | Path |
|---|---|
| POST | `/auth/login` · GET `/auth/me` |
| GET | `/info`, `/protocol`, `/health` |
| GET/POST | `/devices` |
| GET/PATCH/DELETE | `/devices/:id` |
| POST | `/devices/:id/connect`, `/disconnect` |
| POST | `/devices/:id/payment`, `/status`, `/operation`, `/raw`, `/complete` |
| GET/DELETE | `/devices/:id/frames` |
| GET | `/stream`: server-sent events (`frame`, `device`, `removed`); token as `?access_token=` |

## Tests

```bash
cd server && npm test
```
