# Voice Intake

A voice AI agent that registers new patients over a real U.S. phone number, persists their demographics to Postgres, and exposes them through a REST API and a web dashboard.

## How it works

```
 Caller ──PSTN──▶ Retell AI (telephony, speech-to-text, GPT-5.6 Luna, ElevenLabs text-to-speech)
                     │
                     │  signed webhooks: custom-function calls, call_started / call_ended / call_analyzed
                     ▼
              Fastify API (Railway)  ◀──── REST ────  Dashboard (Next.js, Vercel)
                     │
                     │  PatientService / AppointmentService / CallRepository
                     ▼
               PostgreSQL (Railway)
```

1. Retell answers the call and runs the conversation. The agent definition, including the system prompt and tool schemas, lives in this repo and is pushed to Retell by a script, so Retell holds no hand-edited configuration.
2. Whenever the agent needs data it calls a custom function. Retell POSTs it to `/webhooks/retell/tools`; the API verifies the signature, validates the arguments with the same Zod schemas the REST API uses, invokes the service layer, and returns a JSON result the model speaks from.
3. Nothing is written until the caller confirms. `register_patient` is the only write on the happy path, and the agent is told to only report success when the tool says so.
4. When the call ends, Retell posts `call_ended` (transcript, timings, why it ended) and then `call_analyzed` (summary). Both are stored on a `calls` row linked to the patient that was registered or updated during that call.
5. The dashboard and the REST API read the same tables through the same repositories.

## Repository layout

```
apps/
  api/                       Fastify REST API + Retell webhooks (Railway, Docker)
    src/
      app.ts                 Composition root: plugins, services, routes
      config.ts              Environment parsing (fails fast on bad config)
      db/                    Drizzle schema, connection, migrations runner, error helpers
      http/                  Envelope helpers, error classes, error handler
      patients/              Repository → service → routes
      appointments/          Mock scheduling: open slots + booking
      calls/                 Transcript/summary storage per call
      voice/                 Everything Retell-facing
        system-prompt.md     The agent's system prompt (documented below)
        agent.ts             Retell LLM + agent definitions pushed by the sync script
        tools.ts             Custom-function (tool) schemas the model sees
        tool-handlers.ts     Tool implementations on top of the services
        messages.ts          Zod schemas for Retell's function-call and call-event payloads
        signature.ts         Signature verification via the Retell SDK
        webhook.ts           POST /webhooks/retell/tools and /webhooks/retell/events
      index.ts / migrate.ts / seed.ts   Entry points (server, migrations, seed data)
    scripts/sync-retell.ts   Idempotent provisioning of LLM, agent, and phone number
    drizzle/                 Generated SQL migrations
    test/                    Vitest integration tests against PGlite (real Postgres engine)
  dashboard/                 Next.js read-only dashboard (Vercel)
packages/
  shared/                    Domain contract: Zod schemas, types, normalizers, U.S. states
```

The three layers are kept separate, one set of directories each: telephony and LLM concerns are confined to `apps/api/src/voice`, the data layer to `db/` plus the repositories, and the REST API to the `routes.ts` files. Services are the only thing both the webhooks and the REST routes talk to.

## Tech stack and why

| Layer     | Choice                                          | Why                                                                                                                                                                                                        |
| --------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telephony | Retell AI with a Retell-provisioned U.S. number | Provisioning, STT, TTS, barge-in, and turn-taking are handled by the platform, leaving the time budget for the prompt, tools, and backend. Buying a number needs a card on file and identity verification. |
| LLM       | OpenAI `gpt-5.6-luna` via Retell LLM            | Used for both the conversation and the post-call summary. Reliable tool calling and low first-token latency matter more on a phone call than raw reasoning. Swapping models is one line in `agent.ts`.     |
| STT / TTS | Retell "accurate" STT, ElevenLabs flash voice   | Accurate mode favours names and digit sequences; the ElevenLabs model is multilingual, so Spanish replies are spoken naturally. The agent is configured for English and Spanish.                           |
| API       | Fastify 5 + Zod 4 (`fastify-type-provider-zod`) | Schema validation and serialization come from one Zod definition, types flow end to end, and the OpenAPI document at `/docs` is generated from the same schemas.                                           |
| Database  | PostgreSQL + Drizzle ORM                        | Real constraints (enum, CHECK, unique, FK) enforced in the database, not just in code; SQL migrations are generated and committed.                                                                         |
| Tests     | Vitest + PGlite                                 | Integration tests run the real migrations against an in-process Postgres engine, so constraint behaviour is tested without Docker or a network.                                                            |
| Dashboard | Next.js 16 (App Router) + Tailwind 4            | Server components fetch straight from the API; no client state, no API keys in the browser.                                                                                                                |
| Hosting   | Railway (API + Postgres), Vercel (dashboard)    | One command deploys each. The API applies pending migrations at startup and exposes `/health` for Railway's health check.                                                                                  |

## Running locally

Prerequisites: Node 22+, pnpm 10 (`corepack enable`), and a Postgres instance.

```bash
pnpm install

# Postgres, if you do not have one
docker run --name voice-intake-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=voice_intake -p 5432:5432 -d postgres:16

cp apps/api/.env.example apps/api/.env       # fill DATABASE_URL and RETELL_API_KEY
pnpm --filter @voice-intake/api db:migrate
pnpm --filter @voice-intake/api db:seed        # optional: two demo patients
pnpm --filter @voice-intake/api dev            # http://localhost:3000, docs at /docs

cp apps/dashboard/.env.example apps/dashboard/.env.local
pnpm --filter @voice-intake/dashboard dev      # http://localhost:3001 (or next free port)
```

Quality checks:

```bash
pnpm test          # shared unit tests + API integration tests (PGlite)
pnpm typecheck
pnpm format:check
```

To receive real Retell webhooks locally, expose the API with a tunnel (for example `ngrok http 3000`) and run the sync script with `API_BASE_URL` set to the tunnel URL.

## Deploying

**API (Railway).** The Dockerfile at `apps/api/Dockerfile` builds from the repository root. Service settings (builder, Dockerfile path, health check, restart policy) are applied with `railway environment edit`, which is Railway's typed config API. Migrations run when the container starts, so a deploy is a single upload.

```bash
railway link                                  # once
railway add --database postgres               # once
railway add --service api                     # once
railway environment edit --json <<'JSON'    # once: service settings
{"services":{"<api service id>":{"build":{"builder":"DOCKERFILE","dockerfilePath":"apps/api/Dockerfile"},"deploy":{"healthcheckPath":"/health","healthcheckTimeout":120,"restartPolicyType":"ON_FAILURE","restartPolicyMaxRetries":5}}}}
JSON
railway variable set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' NODE_ENV=production PORT=3000 RETELL_API_KEY=... --service api
railway domain --service api --port 3000      # once: public URL
railway up --service api --detach
railway ssh --service api -- node dist/seed.js   # optional demo data
```

The service id comes from `railway service list --json`. With the health check in place, Railway only switches traffic to a new deploy once the API can reach the database.

**Dashboard (Vercel).** Root directory is `apps/dashboard`.

```bash
vercel link --project voice-intake-dashboard    # once
vercel env add API_BASE_URL production
vercel --prod
```

**Voice agent (Retell).** Idempotent: finds the agent by name and updates its LLM and settings, or creates both; publishes the new version; then finds the phone number by nickname or buys one and binds it to the agent.

```bash
pnpm --filter @voice-intake/api retell:sync
```

## Environment variables

| Variable                 | Used by                  | Purpose                                                                                                                |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | API, migrate, seed       | Postgres connection string                                                                                             |
| `RETELL_API_KEY`         | API, `retell:sync`       | Retell private key. The server uses it to verify the signature on every webhook; the sync script uses it to provision. |
| `PORT`, `HOST`           | API                      | Listen address (defaults `3000`, `0.0.0.0`)                                                                            |
| `LOG_LEVEL`, `NODE_ENV`  | API                      | Logging verbosity; pretty logs in development                                                                          |
| `API_BASE_URL`           | `retell:sync`, dashboard | Public URL of the API, used as the webhook target and as the dashboard's data source                                   |
| `RETELL_PHONE_AREA_CODE` | `retell:sync`            | Area code for the provisioned number, default `415`                                                                    |
| `RETELL_VOICE_ID`        | `retell:sync`            | Retell voice id, default `11labs-Myra`; the script lists alternatives if it is unavailable                             |

No secret is hardcoded; `config.ts` refuses to start without the required values.

## REST API

All responses use the envelope `{ "data": ..., "error": null }` on success and `{ "data": null, "error": { "code", "message", "details?" } }` on failure. Interactive documentation: `/docs`.

| Method | Path                         | Status | Description                                                                                                                             |
| ------ | ---------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/patients`                  | 200    | List active patients. Filters: `last_name` (case-insensitive exact), `date_of_birth` (MM/DD/YYYY), `phone_number` (any U.S. formatting) |
| GET    | `/patients/:id`              | 200    | Fetch one patient by UUID                                                                                                               |
| POST   | `/patients`                  | 201    | Create a patient                                                                                                                        |
| PUT    | `/patients/:id`              | 200    | Partial update; send only the fields to change, `null` clears optional ones                                                             |
| DELETE | `/patients/:id`              | 200    | Soft delete (sets `deleted_at`); the row stays, reads stop returning it                                                                 |
| GET    | `/patients/:id/calls`        | 200    | Voice calls linked to the patient, with transcript and summary                                                                          |
| GET    | `/patients/:id/appointments` | 200    | Booked appointments                                                                                                                     |
| POST   | `/patients/:id/appointments` | 201    | Book `{ scheduled_at, reason? }`                                                                                                        |
| GET    | `/appointments/slots`        | 200    | Open slots the agent offers                                                                                                             |
| GET    | `/health`                    | 200    | Liveness plus a database round-trip (503 if the database is down)                                                                       |

Status codes: `400` malformed input (bad JSON, bad UUID, unknown query parameter), `404` unknown or deleted patient, `409` appointment slot already taken, `422` body fails validation (with one `details` entry per field), `500` unexpected.

Validation rules are enforced twice: in the API with Zod (`packages/shared/src/patient.ts`) and in Postgres with CHECK constraints. Notable normalizations: phone numbers are stored as 10 digits (`+1 (555) 010-1234` → `5550101234`), states are upper-cased and checked against the 50 states plus DC, dates are accepted and returned as `MM/DD/YYYY`, and `preferred_language` defaults to `English`. `sex` is one of `male`, `female`, `other`, `decline_to_answer`. Unknown fields are rejected rather than ignored.

```bash
API=https://api-production-785c.up.railway.app

curl -s -X POST $API/patients -H 'content-type: application/json' -d '{
  "first_name": "Jane", "last_name": "Davis", "date_of_birth": "03/15/1985",
  "sex": "female", "phone_number": "(555) 010-1234",
  "address_line_1": "123 Main Street", "city": "Springfield", "state": "IL", "zip_code": "62701"
}'

curl -s "$API/patients?last_name=davis"
curl -s -X PUT $API/patients/<patient_id> -H 'content-type: application/json' -d '{"email":"jane@example.com"}'
curl -s -X DELETE $API/patients/<patient_id>
```

## Voice agent design

**Prompt.** `apps/api/src/voice/system-prompt.md` is the complete system message (Retell's `general_prompt`). It is organised into sections the model can navigate: identity and voice style, accuracy rules (spell names, confirm each value once in a short question as it is given, never infer or fill in a value), what to collect and in which order, returning-patient handling, the validation rules in plain language, the mandatory read-back before saving, how to interpret each tool result, appointment offering, corrections and restarts, language switching, how to end the call, and boundaries. Retell fills `{{user_number}}` and `{{current_time_America/New_York}}` at call start so the agent can offer the caller ID as a default phone number and reason about "not in the future".

**Tools.** The model only ever changes state through tools (Retell custom functions), and every tool validates with the same schemas as the REST API. All custom functions post to one endpoint with the function name in the body, and none of them retry (`max_retry: 0`), so a slow network can never turn one confirmed registration into two records.

| Tool                              | Purpose                                                          | Result shape                                                                                       |
| --------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `lookup_patient_by_phone`         | Duplicate detection as soon as a phone number is known           | `{ found: true, patient }` or `{ found: false }`                                                   |
| `register_patient`                | The confirmed save                                               | `{ ok: true, patient_id, first_name }` or `{ ok: false, validation_errors: [{ field, message }] }` |
| `update_patient`                  | Returning callers who want to change details                     | `{ ok: true, patient }` or `{ ok: false, ... }`                                                    |
| `get_available_appointment_slots` | Mock scheduling: next business days, fixed clinic hours, Eastern | `{ slots: [{ scheduled_at, label }] }`                                                             |
| `book_appointment`                | Books one of the offered slots; a slot can only be booked once   | `{ ok: true, appointment }` or `{ ok: false, error }`                                              |
| `end_call` (Retell built-in)      | Hang up after the goodbye                                        |                                                                                                    |

**Behaviour under failure.**

- Invalid data (3-digit phone, 02/30/1990, future date, unknown state): the prompt teaches the rules, and if something still slips through, the tool returns `validation_errors` naming the exact fields. The prompt instructs the agent to re-ask only those fields and confirm again before retrying. Nothing is saved.
- Database write fails or the API is unreachable: the saving tools speak a fixed line while they run ("One moment while I save that."), so the caller never gets dead air, and a failure comes back to the model as `{ ok: false, error }` (or as a failed function if the API is down) so it can offer one retry and otherwise ask them to call back. The agent is explicitly told never to claim success without `ok: true`.
- Caller hangs up or the line drops mid-call: nothing is persisted until the confirmed `register_patient` call, so there are no half-records. The `call_ended` event is still stored with its `disconnection_reason` and logged.
- Caller wants to start over: the prompt discards everything and restarts from the name; since no write has happened yet, there is nothing to undo.
- Corrections and out-of-order answers: the prompt accepts corrections at any point, confirms only the corrected item, and captures multiple fields given at once without re-asking. Names are spelled and confirmed once, letter by letter; only a letter the agent is unsure of is checked with a word ("B as in boy?"). Numbers are read back once as they are given, ambiguous dates get an either-or question, and a confirmed value is not repeated until the final read-back. The agent never saves an unconfirmed value.
- Interruptions and accuracy: Retell handles barge-in natively. `interruption_sensitivity` is set slightly below maximum so brief acknowledgements do not cut the agent off, and dynamic responsiveness lets the agent reply quickly while still waiting when a caller spells or reads digits slowly. "Accurate" STT mode favours names and digit sequences, common insurer names are boosted keywords, model temperature is 0.1, and callers can type numbers on the keypad (ending with #) when speech recognition struggles.
- Returning callers: once a phone number is known the agent looks it up and offers "It looks like we already have a record for … Would you like to update your information instead?".
- Spanish: the agent is configured for English and Spanish and the prompt lists Spanish as supported, so "Hablo español" switches the whole flow.

**Webhook security.** Retell signs every request to the API (custom-function calls and call events) with an HMAC-SHA256 of the raw body plus a timestamp, keyed by the account's API key, in the `x-retell-signature` header. The API verifies it with the official SDK's `Retell.verify` over the raw request body before any handler runs; the SDK rejects signatures older than five minutes.

## Data model

| Table          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patients`     | All patient fields with matching column types: `uuid` PK (`gen_random_uuid()`), `varchar` with the specified lengths, `date`, Postgres enum `sex`, `char(10)` phones, `char(2)` state, `timestamptz` audit columns, nullable `deleted_at`. CHECK constraints guard phone digits, ZIP format, state code, non-blank names/city, and date-of-birth range. Indexed on phone, last name, and date of birth. `updated_at` is maintained by the ORM on every update. |
| `calls`        | One row per call: `provider_call_id` (Retell's call id, unique), optional FK to `patients`, caller number, `ended_reason`, `summary`, `transcript`, timings.                                                                                                                                                                                                                                                                                                   |
| `appointments` | FK to `patients`, `scheduled_at` (unique, so a slot cannot be double-booked), optional `reason`.                                                                                                                                                                                                                                                                                                                                                               |

Migrations are generated from `apps/api/src/db/schema.ts` with drizzle-kit, committed under `apps/api/drizzle`, and applied by the API on startup (or explicitly with `node dist/migrate.js`). Drizzle records applied migrations, so restarts are no-ops.

## Observability

Structured JSON logs (pino) go to stdout and are visible in Railway. Every tool call is logged with its arguments, every successful registration or update logs the full saved patient payload, and every `call_ended` / `call_analyzed` event logs the disconnection reason, summary, and transcript. In development the same logs are pretty-printed.

## Testing

`pnpm test` runs 53 tests: unit tests for the normalizers and schemas in `packages/shared`, and integration tests in `apps/api/test` that boot the real Fastify app against PGlite with the committed migrations. They cover every REST endpoint and status code, soft delete semantics, database CHECK constraints bypassing the API, webhook signature rejection (wrong key, tampered body, missing header), every voice tool including validation feedback and double-booking, and transcript and summary storage from the call lifecycle events. Separate tests assert that the tool schemas shown to the model stay in sync with the API's Zod schema and that no write tool is retried.

## Known limitations and trade-offs

- **Name rule.** Names allow letters, hyphens, and apostrophes only, so multi-word names such as "de la Cruz" are rejected; the agent would need to hyphenate. Relaxing this is a one-line regex change in `packages/shared`.
- **Phone validation** checks for ten digits (with an optional leading 1) and does not apply NANP area-code rules, so test inputs like 123-456-7890 are accepted.
- **Dates** are compared in UTC; a caller born "today" in a timezone ahead of UTC is still accepted.
- **Appointments are mock.** Slots are a fixed weekday schedule in U.S. Eastern time with no providers, durations, or cancellation.
- **No authentication on the REST API**, deliberately out of scope for this build. In production the dashboard and API would sit behind an identity provider, and PHI would never be logged.
- **No pagination** on `GET /patients`; the list is filtered instead.
- **Tool status lines are English** ("One moment while I save that."); the model's own replies switch to Spanish, so a Spanish-speaking caller hears one English interjection while a save is in flight.
- **Call recordings** are kept by Retell under its default storage setting; only transcripts and summaries are copied into this database.
- **Migrations run at startup** rather than as a separate deploy step. That is correct for a single instance (Drizzle takes a lock and skips applied migrations) but would move to a pre-deploy job before scaling out. Railway service settings are applied through `railway environment edit` rather than a config file: the CLI marks `railway.json` as deprecated and it was not honoured for CLI uploads, and the TypeScript IaC SDK did not evaluate with the current CLI.
- Single region, single instance.

## Next steps

- Greet returning callers by name from caller ID using Retell's inbound-call webhook to inject dynamic variables before the first message.
- Idempotency keys on `register_patient` so a replayed request cannot create two records even if retries were enabled.
- Localised tool status lines via Retell's prompt-generated execution messages.
- API keys or OAuth for the REST API and dashboard, rate limiting on the webhooks, pagination.
- Retell test cases for scripted end-to-end call regression, and CI running `pnpm test` plus a Docker build.
