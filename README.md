# Eideas Multi Payment System

Payment-terminal platform: one place where Eideas admins and client companies
see and control the money their terminals collect.

- **Server** — NestJS + TypeORM + PostgreSQL, with an MQTT listener for the
  terminals (the successor to the old `davitlift/Express` listener).
- **Client** — React + Vite + Ant Design + TanStack Query.
- **Docker** — one `docker compose up` brings up client + server. The database
  stays **outside** docker, on its own dedicated Postgres host.

```
eideas-multy-payment-system/
├─ docker-compose.yml      one command for the whole platform
├─ .env                    compose + server config (copy of .env.example)
├─ server/                 NestJS API, MQTT listener, earnings engine
└─ client/                 React admin panel
```

## Quick start

### 1. The database (outside docker, once)

```sql
CREATE DATABASE eideas_payments;
\c eideas_payments
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- TypeORM uses uuid_generate_v4()
```

If you have no Postgres handy for local development, a standalone container
is the quickest stand-in. Note it is **not** part of `docker-compose.yml` —
the app still treats it as an external database, exactly like the production
host:

```bash
docker run -d --name eideas-pay-db --restart unless-stopped \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=eideas_payments \
  -p 5432:5432 -v eideas-pay-pgdata:/var/lib/postgresql/data \
  postgres:17-alpine

docker exec eideas-pay-db psql -U postgres -d eideas_payments \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

If the server container crash-loops with `ECONNREFUSED` and the panel shows
**502 Bad Gateway**, this is why: nginx is up but the API cannot reach the
database, so there is nothing to proxy to. Check `docker compose logs server`.

### 2. Configure

```bash
cp .env.example .env     # then edit: DB_*, JWT_*, MQTT_*, SEED_ADMIN_*
```

`DB_HOST=host.docker.internal` reaches a Postgres running on your own machine
(compose maps it to `host-gateway`). In production, put the real database host
there.

### 3. Run everything

```bash
docker compose up -d --build
```

| What | Where |
|---|---|
| Admin panel | http://localhost:8080 |
| API | http://localhost:4000/api |
| Swagger | http://localhost:4000/api/docs |
| Health | http://localhost:4000/api/health |

First boot creates the admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(only when no admin exists yet). **Change that password immediately.**

The browser only ever calls `/api`, which nginx proxies to the server
container — so there is no CORS setup and no per-environment client rebuild.

### Local development (without docker)

```bash
cd server && cp .env.example .env && npm install && npm run start:dev   # :4000
cd client && npm install && npm run dev                                 # :5173
```

Vite proxies `/api` to `localhost:4000` in dev.

## Server architecture

Hard modularity: one module per domain, each owning its entities, DTOs,
service and controller. `shared/` holds the cross-cutting pieces and imports
nothing, so there can be no cycles.

```
server/src/
├─ config/           env parsing + joi validation (nothing reads process.env directly)
├─ database/         TypeORM connection, data-source for migrations
├─ shared/           global module: guards, decorators, DTOs, enums,
│                    CommissionService, AccessScopeService, PasswordService
└─ modules/
   ├─ auth/              login, refresh, /me, JWT strategy
   ├─ users/             accounts & roles
   ├─ companies/         client companies
   ├─ sites/             "objects" (addresses) of a company
   ├─ devices/           terminals, tariffs
   ├─ device-registry/   device ids heard on MQTT but not registered yet
   ├─ payments/          money in (write side)
   ├─ earnings/          monthly aggregation (read side)
   ├─ access/            manager → device assignments (join table only)
   ├─ wallet/            app balances, phase 2
   ├─ mqtt/              broker transport, codec, router, event handlers
   ├─ health/            docker healthcheck
   └─ seed/              first admin
```

Dependency direction (every edge points one way — no cycles):

```
auth → users → {companies, devices, access}
devices → {companies, sites, device-registry, earnings, access}
sites → {companies, earnings, access}
companies → earnings
payments → {devices, access}       wallet → payments
mqtt → {devices, payments, device-registry}
earnings, access, device-registry → (nothing)
```

Two deliberate splits are what keep that graph acyclic:

- **`earnings` is read-only.** It owns the `Payment` repository for
  aggregation only. Because it depends on nothing, companies/sites/devices can
  all import it for their "this month" figures.
- **`access` holds only the manager→device join table.** Both `users` and
  `devices` need it; it needs neither.

## The money model

A payment lands on exactly one device, and that device decides the commission:

```
commission = max(minTariff, amount × percentTariff / 100)   capped at amount
net        = amount − commission
```

- Implemented once, in `shared/services/commission.service.ts`.
- Computed **per payment** and frozen onto the row at insert time — editing a
  tariff never rewrites history.
- A month runs from the **1st at 00:00:00.000 UTC to the last day at
  23:59:59.999 UTC**, inclusive (`shared/utils/month-range.util.ts`). Every
  chart month is present even when it has no payments, so a quiet month
  renders as a zero column instead of disappearing.

Two inbound money paths, one `payments` table:

1. **Terminal** — a frame arrives over MQTT → straight into that device's earnings.
2. **App balance** (phase 2) — a user tops up, then spends; the spend creates a
   payment on the device, so it shows up in exactly the same numbers. The
   `wallet` module is scaffolded with row-locked balance moves and no public
   controller yet.

Reversal flips a payment's status instead of deleting it: earnings only sum
`success`, so the audit trail survives.

## Roles

| | Admin | Company | Manager |
|---|---|---|---|
| Companies | full CRUD | own, read-only | own, read-only |
| Objects (sites) | full CRUD | create/edit own | only those holding their devices |
| Devices | full CRUD | read own | only assigned ones |
| Earnings / payments | everything | own company | assigned devices |
| Users | all | own managers | — |
| Unregistered devices, MQTT | yes | — | — |

Scoping is enforced server-side in every query (`AccessScopeService` plus the
per-module filters), not in the UI. Asking for another company's device id
returns zeros or a 404, never someone else's money.

## MQTT

Topic layout (root is configurable via `MQTT_ROOT_TOPIC`, so staging and
production can share a broker without hearing each other):

```
inbound    {root}/{deviceUid}/events/{event}      subscribed as {root}/+/events/#
outbound   {root}/{deviceUid}/commands/{command}
```

Pipeline: **decode → identify → audit → dispatch**

1. `FrameCodec` decodes the frame: the timestamp, then the terminal
   protocol's `[VID][len][value]` records (next section). A JSON payload (the
   simulator) is parsed as JSON. Nothing is ever dropped — the raw hex is
   always kept.
2. An unknown device id is recorded in **unregistered devices**, which is the
   dropdown the create-device form picks from. Onboarding is self-service:
   plug the terminal in, it talks, it appears in the admin inbox.
3. Every frame is appended to `device_messages` (topic, hex, decoded records
   by name, handler, error) — the audit trail. A frame a handler failed on, or
   one that looked like VID records but did not decode, is kept even with
   `MQTT_LOG_RAW=false`.
4. Typed handlers claim VIDs. Every handler claiming a VID in the frame runs
   once, independently (one failing does not stop the others). JSON frames
   are routed by the topic's event segment instead. Adding an event means
   adding a file:

```ts
@Injectable()
export class TamperHandler implements DeviceEventHandler {
  readonly event = 'tamper';     // JSON / simulator route
  readonly vids = [0xc0];        // terminal-protocol route
  readonly name = 'tamper';
  async handle(message: MqttInboundMessage) { /* message.frame.records */ }
}
```

…then listing it in `mqtt.module.ts`. No growing if/else chain, which is what
the old Express listener became.

Frames from one terminal are applied in the order it sent them (dispatch is
chained per device), so `busy` then `idle` never lands as `idle` then `busy`.
Different terminals still run in parallel.

Idempotency: QoS 1 is at-least-once, so a payment carries a unique
`externalRef`. A redelivered frame returns the existing payment instead of
double-counting money. The terminal protocol has no transaction id, so the
key is `{deviceUid}:{device clock}-{hash of the frame}`: a redelivery is
byte-identical, and one terminal cannot take two payments in the same second.
When the device clock is not believable (unset, or counting from boot) there
is no key at all — a double count can be reversed, a real payment dropped as
a "duplicate" cannot.

### Terminal protocol (VIDs)

Defined once, in `server/src/modules/mqtt/protocol/terminal-protocol.ts`, and
served as JSON from `GET /api/mqtt/protocol`. Both directions use the same
frame:

```
[timestamp 4B] [VID 1B][len 1B][value] [VID 1B][len 1B][value] ...
```

A one-record frame is byte-for-byte the lift terminals' `[ts][cmd][len][payload]`
with the VID in the command byte. Multi-byte values are little-endian.

| VIDs | Direction | What the server does |
|---|---|---|
| `0x01`–`0x08` configs | server → terminal | Saved per device (`devices.config`, spec defaults until set) and pushed all together in one frame on every change |
| `0x50` set amount (tetri) | server → terminal | `POST /devices/:id/commands/amount` |
| `0x51` reconciliation | server → terminal | `POST /devices/:id/commands/reconcile`; the answer is `0xBB` |
| `0x80` amount + `0x81` payment | terminal → server | **Success** / **Partly Success** books a payment (amount ÷ 100 = GEL). Any other result is recorded on the device, not booked |
| `0x82` payment status | terminal → server | `devices.terminal_state.paymentStatus` = `idle` / `busy` |
| `0x84` `0x95` `0x9A` `0x9D` `0xB5` `0xBB` | terminal → server | Recorded as `terminal_state.lastOperation` (and `lastReconciliation`) |

Every outbound value is range-checked against the spec before it is sent
(the API answers 400 first, and the encoder refuses as a second line). An
inbound amount outside 1–10000 tetri is not booked and is logged with the
reason, which is also what a byte-order mismatch looks like.

A successful **void / return / cancel does not reverse a payment by itself.**
With no transaction id, picking "which payment" would be a guess, and a wrong
guess silently removes real money from a company's earnings. It is logged as
a warning; reverse the payment from the payments page.

**To confirm with the firmware author** — each is one constant to change:

1. Several records in one frame, with `0x80` in the same frame as its `0x81`
   (a `0x81` without an amount is refused, not paired with an earlier frame).
2. Little-endian `UINT16` (`VALUE_BYTE_ORDER`). The device clock is accepted
   in either byte order.
3. Partly Success: is `0x80` then the approved amount? It is booked at `0x80`,
   flagged `partial` on the row (`BOOKABLE_RESULTS` in the parser).
4. `0x84` and `0x9A` are both called "Cancel Transaction" in the spec.
5. Operation Mode lists 1–7 but the range column says 32; 1–7 is enforced.
6. "Country Code" defaults to `0x3D5` = 981, which is the ISO 4217 code of
   the lari, not a country code (Georgia's is 268). Harmless if the firmware
   just expects that value.
7. There is no device acknowledgement. "Sent" means the broker accepted the
   frame; `configSentAt` is the broker's word, not the terminal's.

### Testing the pipeline with no device and no broker

```bash
curl -X POST http://localhost:4000/api/mqtt/simulate \
  -H 'Authorization: Bearer <admin token>' \
  -H 'Content-Type: application/json' \
  -d '{"deviceUid":"TERM-0001","records":[{"vid":128,"value":1250},{"vid":129,"value":1}]}'
```

`records` is encoded into a real terminal frame (`0x80` = 1250 tetri, `0x81` =
Success). `payloadHex` sends exact bytes instead, for malformed frames, and
`payload` sends JSON (`{"amount":12.5,"ref":"A-1001"}`).

This runs the real path: decode → registry → handler → payment → earnings.
Call it once for an unknown id to make it appear under **Unregistered
devices**, register it in the UI, then call it again to see the money land on
the device's charts. `GET /api/mqtt/status` shows the broker connection and
dispatch counters; `GET /api/mqtt/messages` is the raw frame log.

## API map

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/refresh` | public |
| GET | `/api/auth/me` | any |
| GET/POST/PATCH/DELETE | `/api/companies` | read: any · write: admin |
| GET/POST/PATCH/DELETE | `/api/sites` | write: admin, company |
| GET/POST/PATCH/DELETE | `/api/devices` | write: admin |
| GET | `/api/devices/:id/earnings` | any (scoped) |
| GET | `/api/devices/:id/config` | any (scoped) |
| PATCH / POST | `/api/devices/:id/config`, `/config/push` | admin |
| POST | `/api/devices/:id/commands/amount`, `/commands/reconcile` | admin |
| GET | `/api/earnings`, `/api/earnings/devices/:id`, `/api/earnings/sites/:id` | any (scoped) |
| GET/POST | `/api/payments`, `PATCH /:id/reverse` | read: any · write: admin |
| GET/POST/PATCH/DELETE | `/api/users` | admin, company |
| GET/PATCH/DELETE | `/api/unregistered-devices` | admin |
| GET/POST | `/api/mqtt/status`, `/messages`, `/simulate`, `/publish` | admin |
| GET | `/api/mqtt/protocol` | any |
| GET | `/api/health` | public |

Full schema with request/response shapes: `/api/docs`.

## Tests

```bash
cd server && npm test        # builds, then runs node --test
```

50 checks over the rules the money depends on: the commission choice, the
month-window boundaries (including leap February), topic parsing, the frame
codec, the terminal protocol (record decoding, range checks, idempotency
keys, declined and malformed payments), VID routing, and config merging. They run against the compiled output, so there
is no test-runner dependency in the tree.

## Languages

Georgian and English, switchable from the globe button in the header (and on
the login screen, before signing in). The choice is remembered in
localStorage.

- Strings live in `client/src/i18n/locales/` — `en.ts` is the source of truth
  and `ka.ts` is typed as `Resources`, so **adding a key to `en.ts` breaks the
  build until it is translated**. No silently missing strings.
- Switching also moves Ant Design's own component text (pagination, empty
  states, confirmations) via `antd/locale/ka_GE`, and dayjs, which formats the
  chart month labels and the relative "x ago" strings.
- **Georgian is the default** and the browser language is deliberately ignored,
  so the panel always opens in Georgian rather than flipping to English on an
  en-US machine.
- Georgian wording follows the client's own brief wherever it supplied a term
  (კომპანია, ობიექტი, დევაისი, საკომისიო, გამომუშავება, მინიმალური ტარიფი).
  Worth a read-through by the client, since the rest was translated by hand.

## Assumptions made (worth confirming with the client)

The brief left a few things open (the terminal protocol's open points are
listed under [Terminal protocol](#terminal-protocol-vids)). Where a decision was needed, this is what was chosen and why:

1. **The minimum tariff is a floor per payment, not per month.** "Deducts the
   minimum from the incoming total" reads both ways. Per-payment is what a
   terminal fee normally means, and it is the only reading that lets the
   commission be frozen on the row. If it turns out to be a monthly floor,
   `CommissionService` is the only file that changes.
2. **Terminal money is booked only from what the spec defines** — a `0x81`
   result under which money moved, with its `0x80` amount in range. Anything
   else is kept in `device_messages` with the reason, never guessed at.
3. **Payments from an unregistered device are stored but not booked.** They
   cannot be attributed to a company. The frame is in `device_messages` and
   the id is in the unregistered pool, so nothing is lost — but the money only
   appears in the charts after an admin registers the terminal. Worth deciding
   whether it should be back-filled on registration.
4. **Currency is GEL throughout**, as a column rather than a constant, so
   multi-currency is possible later.
5. **Device type** is an enum (car wash / barrier / parking / vacuum / other)
   **plus** a free-text label, since the real op-mode list is still pending.
   Free text is used whenever the type is `other`.
6. **The Georgian address database is not wired in.** Addresses are free text,
   and `latitude`/`longitude` columns are already there for the map view.
7. **Deletes are soft** for companies, sites, devices and users — payment
   history must survive. Unregistered-device rows are hard-deleted (they are
   just noise).
8. **`deviceUid` and a device's company are immutable** after registration:
   either would corrupt the earnings history. Delete and re-register instead.
9. **Company users have read-only access** to their objects and devices, per
   the brief, except that they may create objects and manager accounts — that
   is the one thing the brief asks for explicitly ("so a company can hire an
   employee"). Everything else stays admin-only until the client says more.

## Still to do

- `DB_SYNCHRONIZE=true` is fine while the schema moves; switch to `false` and
  generate the first migration (`npm run migration:generate`) before going
  live.
- Confirm the terminal-protocol open points with the firmware author.
- Admin UI for terminal config and commands (the API is there:
  `/devices/:id/config`, `/devices/:id/commands/*`, `/mqtt/protocol`).
- Push the config automatically when a terminal is registered (today it is
  pushed on save, or with `POST /devices/:id/config/push`).
- Earnings export (xlsx/csv) and a date-range picker beyond "last N months".
- Wallet controller + the mobile app's top-up flow (phase 2).
- Map view of objects, once addresses are geocoded.
