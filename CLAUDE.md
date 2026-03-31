# travel-together — Claude operating instructions

## Stack
- **Server**: Node.js + Express + PostgreSQL (in `server/`)
- **Client**: React + Vite (in `client/`)
- **Deploy**: Render (web service, root dir = `server/`, build = `npm install`, start = `node index.js`)
- **DB migrations**: SQL files in `server/db/schema/` — run locally with `psql $DATABASE_URL -f <file>`

## Workflow — always follow this for every request

### 1. Break the request into feature stories first
Before writing any code, list the discrete features as user stories:
```
Story 1: [verb] [thing] — [acceptance criteria]
Story 2: ...
```
Get confirmation if the scope is large or unclear. Small/obvious requests can proceed directly.

### 2. Write a test for each story before implementing
- **Server routes**: add a test in `server/tests/` using the existing Jest setup (`npm test` in `server/`)
- **Client components**: add a test in `client/src/tests/` using Vitest (`npm test` in `client/`)
- Tests should cover the happy path + at least one failure/edge case per story
- Tests should be runnable without the database (mock `db.query` at the module level)

### 3. Implement the feature
- One story at a time
- Server changes: routes, migrations, services
- Client changes: components, hooks, CSS

### 4. Run tests — must pass before committing
```bash
cd server && npm test       # Jest
cd client && npm test       # Vitest
```
Do not commit if tests fail.

### 5. Commit with a story reference
```
feat: [story summary]

Story 1: ...done
Story 2: ...done
Tests: server/tests/foo.test.js, client/src/tests/Foo.test.jsx
```

### 6. Push and confirm Render deploy is `live`
Check via Render API or dashboard. Do not declare done until deploy status = `live`.

---

## Test setup

### Server (Jest)
```bash
cd server && npm test
```
Test files live in `server/tests/*.test.js`.
Mock DB with `jest.mock('../db')`.

### Client (Vitest)
```bash
cd client && npm test
```
Test files live in `client/src/tests/*.test.jsx`.
Use `@testing-library/react`.

---

## Render deploy
- Service ID: `srv-d62go2e8alac73dds3f0`
- URL: `https://travel-together-jsgy.onrender.com`
- API key env var: `RENDER_API_KEY` (check `~/.claude.json` for key)
- After push, poll until status = `live`:
  ```bash
  curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services/srv-d62go2e8alac73dds3f0/deploys?limit=1" \
    | python3 -c "import json,sys; d=json.load(sys.stdin)[0].get('deploy',{}); print(d.get('status'))"
  ```

## DB migrations
- File naming: `server/db/schema/NNN_description.sql`
- Run locally: `psql postgresql://pjloury@localhost:5432/travel_together -f server/db/schema/NNN_file.sql`
- Render picks up schema changes at runtime (server applies `ALTER TABLE IF NOT EXISTS` style)

## Common gotchas
- Auth middleware is a **default export**: `require('../middleware/auth')` — NOT `{ authenticateToken }`
- All new server routes must be registered in `server/index.js`
- `server/package.json` must be committed when adding new npm dependencies
- Google Places key: `GOOGLE_PLACES_KEY` in `server/.env` (and Render env vars)
