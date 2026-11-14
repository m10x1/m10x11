# Mr10x deployment status (staging branch)

This public GitHub repository contains frontend pages and Node.js backend source **only**.
It is **not** equivalent to a running hosted backend/database. The hosted app remains
unconfigured until the requirements below are met.

## Completed in the repository
- Latest owner-supplied frontend and backend source staged on `prepare-backend-deploy-2026-11-14`.
- `render.yaml` supplies Render-compatible build, root-directory, branch, and health-check settings, with auto-deploy **off**.
- `backend/.env.example` documents environment **names only**; real secrets stay in Render's private environment.
- `.github/workflows/verify.yml` checks JavaScript syntax, unit tests, and accidental `.env` commits.

## Blocking external setup (not possible by GitHub source changes alone)
1. **Database** — `backend/src/db.js` uses `mssql`, not PostgreSQL. Existing data in the owner's local SQL Server Express `Mr10xMail` is not present on GitHub or Supabase. Host and migrate the original SQL Server data securely (or implement and test a deliberate PostgreSQL migration). The Render service cannot connect to `localhost` on the owner's PC.
2. **Encryption keys** — preserve existing `DATA_ENCRYPTION_KEY` and `CODE_HASH_KEY` during migration. Replacing them makes existing encrypted values unreadable and changes keyed digests. Enter actual values privately in Render; never in GitHub.
3. **Service environment** — add SQL Server connection credentials, Supabase service-role key and URL, the exact deployed `BACKEND_URL`, and any optional OAuth integration credentials inside Render only. Code's production mode enforces HTTPS and trusted TLS for SQL Server.
4. **Frontend API URL** — after Render allocates a real HTTPS service URL, set `HOSTED_API_ORIGIN` in `mail-bridge-config.js` to that exact URL on the deploy branch. Do not guess the URL.
5. **Google/Microsoft OAuth** — update authorized redirect URI to the exact hosted backend callback; verify existing consent/scopes and domain requirements.
6. **GitHub Pages** — current live site is built from `main` and has **not** received this draft branch. Review tests, staging behavior and security, then merge intentionally.
7. **Billing/reliability** — Render Free web services sleep after inactivity, so background polling may not run continuously. Select a production-appropriate plan if continuous availability is required.

## Safety and validation
- Do not make local SQL Server reachable from the public internet without a secure production network design.
- Keep guest links private and scoped per order; use only service-approved verification and delivery workflows.
- Health-check route `/api/health` requires a working SQL connection and therefore reports unhealthy until database hosting is ready.
- Do not deploy to real customers before full integration tests, authorization review, and revocation/expiry tests.


## Hosted SQL Server chosen (2026-11-14)

The owner selected **hosted SQL Server** over a PostgreSQL rewrite. The repository now contains:
- [Read-only local SQL Server preflight](database/READ_ONLY_PREFLIGHT.sql), safe to run in SSMS without exposing customer records.
- [SQL Server hosting and migration runbook](database/HOSTED_SQL_SERVER_RUNBOOK.md), including version compatibility, backup verification, pricing questions, network access and safe cutover.

**Preflight result verified 2026-11-14:** source SQL Server 2025 Express 17.0.1000.7,
`Mr10xMail`, Arabic_CI_AS, five dbo tables each reporting **zero approximate rows**, 
8 MB data + 8 MB log allocated, guest-delivery columns all present. **Do not choose
hosting based on allocated file size; it isn't used data.**

**Preferred lower-cost path:** run [EXACT_ROW_COUNTS.sql](database/EXACT_ROW_COUNTS.sql)
to confirm zero real records, then export **schema only** targeting SQL Server 2022
and review it before deploying an empty hosted SQL Server 2022 Express database.
This avoids native-backup downgrade entirely. Preserve a private local backup.
A native SQL Server 2025 `.bak` **cannot** be restored on SQL Server 2022.
AWS RDS 2025 Express availability cannot be assumed for any given region/instance.

No hosted database has been provisioned or any customer data moved.
