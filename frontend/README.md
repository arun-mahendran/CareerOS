# CareerOS

CareerOS uses React, TypeScript, TanStack Start, Vite and Tailwind CSS. The frontend uses **npm**, with `package-lock.json` as its only dependency lockfile. No Bun installation is required.

## Windows setup

Install Node.js **22.14.0 or later** (a supported Node 22 release is suitable) and npm **10.9.2 or later**. Open PowerShell in the project folder containing `package.json`. In a downloadable package this folder is `frontend`; in this repository it is the root.

```powershell
node --version
npm --version
npm install
npm run dev
```

Open the local address printed by Vite. Keep that terminal open; stop it with Ctrl+C. Do not install dependencies in `backend` with npm.

## Build, preview and tests

```powershell
npm run build
npm run preview
```

Preview serves the compiled application at the address printed by Vite. Build first. The existing TanStack Start integration and deployment target are unchanged.

```powershell
npm test
npm run test:watch
npm run lint
```

For automated installs use `npm ci`, which installs the committed lockfile without updating it. Commit `package.json` and `package-lock.json` together when dependencies change. The migration resolved dependencies without `--legacy-peer-deps`; do not add that flag unless a future, inspected peer conflict requires it.

## Backend connection and real job updates

Keep the existing frontend environment configuration. If `VITE_API_URL` is configured, CareerOS uses the FastAPI server; without it, the existing built-in backend supports the preview. Set only the public API address in the frontend, for example:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

Follow [backend/README.md](../backend/README.md) for PostgreSQL, migrations, authentication, Google sign-in, AI and server setup. Keep database credentials, JWT secrets, Google client secrets, Gemini keys and SMTP credentials in the backend environment only.

Real listings require configured official company boards and a running FastAPI server. Run `python -m app.worker` from `backend` in a separate terminal for scheduled synchronization. The npm migration does not change job adapters, endpoints, search/filter behavior, notification counts, session handling or the UI. No demo accounts, sample jobs or fabricated platform figures are included; without a server connection, job and admin pages explain that live data is unavailable.

### Integration smoke test

1. Start FastAPI and its worker using the backend instructions, then start the frontend with `npm run dev`.
2. Sign in as an admin, open Job Sources, test a configured board, and sync it. A repeated sync must not create duplicate listings.
3. Sign in as a candidate and open Opportunities. Check real listings, search, filters and official application links.
4. Follow a company, sync newly discovered roles, and check the notification list and unread indicator; mark notifications read.
5. Reload and confirm authentication and saved user data still work.

Google sign-in, AI and email delivery need their existing backend credentials. Successful dependency installation alone does not verify those services.

## Migration validation

- `npm install` and `npm ls --depth=0` succeeded without peer-conflict flags; lockfile matches the declared dependencies.
- `npm run dev` and `npm run preview` started successfully. The sign-in page rendered without browser runtime errors; signed-out Opportunities access redirected to sign-in as expected.
- `npm test`: 24 passed, two existing routing tests failed (home and not-found).
- Managed preview builds passed automatically; `npm run build` was not invoked manually in the managed environment.
- Validation used Linux with Node 22.22.0/npm 10.9.4, not Windows with the exact requested versions.
- Signed-in job retrieval, filters and notification actions remain unverified in this environment: no FastAPI URL or authorized requesting-user session is available.
