# Mr10x — Hosted Microsoft SQL Server migration plan

**Status:** PREPARATION ONLY; no database migration or production deployment has occurred.

## Architecture for both website and future Windows software

- Web: GitHub Pages frontend (Mr10x).
- Future Windows client: talks to the **same authenticated HTTPS backend API**, never directly to SQL Server, Supabase service-role credentials, or mailbox access.
- Node.js / Express backend: Render or similar always-on Node host.
- Database: hosted Microsoft SQL Server `Mr10xMail` reachable securely from the API.
- Supabase Auth: keep existing identities and store registration data in Supabase; do not duplicate auth records by copying SQL tables.

## Important: source SQL Server major version

Earlier local SSMS screenshots show **SQL Server 17.0.x (SQL Server 2025)**.
Execute `database/READ_ONLY_PREFLIGHT.sql` to verify the actual database server version and size.

**Native SQL backups are NOT backward compatible.** A backup from SQL Server 2025 cannot be restored to SQL Server 2022. However, the November 14 read-only preflight shows **0 approximate rows in each of the five application tables**. If [exact row counts](EXACT_ROW_COUNTS.sql) also equal zero and the schema can be scripted for the older engine, use a **schema-only deployment on SQL Server 2022 Express** instead of restoring a 2025 .bak. This is a new, empty database deployment, not an in-place backup downgrade; verify DDL/index support and the application's queries before cutover. Keep a separate local full backup.

### Host candidates

1. **Amazon RDS for SQL Server**: managed SQL Server; may be suitable for a compatible 2025 edition. Native SQL Server `.bak` restore is supported through Amazon S3 and an RDS option group (SQLSERVER_BACKUP_RESTORE). Verify the specific **2025 + Express** edition/region/instance-size combination before purchasing. AWS's July 2026 launch announcement for 2025 specifically named Enterprise, Standard, and Developer editions; do **not** assume 2025 Express availability. SQL Server **2022 Express** is a viable candidate for schema-only setup after compatibility testing. If only Standard is available, obtain the true pricing first. Relevant: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.Concepts.General.VersionSupport.html and https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.SQLServer.Options.BackupRestore.html
2. **Azure SQL Database**: managed SQL platform and possible lower-cost development alternative, but not an identical full SQL Server instance. Requires compatibility assessment; BACPAC/schema-and-data migration rather than assuming a native full-server backup restore; user previously had sign-in difficulties. https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import
3. A SQL Server 2025-capable managed provider or appropriately licensed VM: confirm patching, encrypted backups, SQL authentication, firewall rules, TLS certificate verification, SLA and monthly fee first.

AWS RDS pricing: https://aws.amazon.com/rds/sqlserver/pricing/. Pricing depends on edition, region, instance, storage, and backup; no specific price is guaranteed here.

## Safe migration sequence

1. **COMPLETED:** Ran `READ_ONLY_PREFLIGHT.sql` against local **Mr10xMail** on 2026-11-14. Source was SQL Server 2025 Express 17.0.1000.7, database collation `Arabic_CI_AS`, compatibility level 170, five dbo tables, each with **zero approximate rows**, 8 MB ROWS + 8 MB LOG allocated. Guest-delivery columns present. Run [EXACT_ROW_COUNTS.sql](EXACT_ROW_COUNTS.sql) to confirm all five tables truly contain zero rows; it returns only counts. If any count is nonzero, stop and review data-migration needs.
2. Take an **independent full backup** using SSMS: right-click `Mr10xMail` → Tasks → Back Up → Full → save `.bak` outside the GitHub repo. Verify it can be read and keep it privately encrypted. Never upload `.bak` to a public repository or conversation.
3. **Preferred if all exact counts are 0:** In SSMS, right-click `Mr10xMail` → Tasks → Generate Scripts; select the five `dbo` tables; in **Advanced** set `Types of data to script = Schema only`, `Script for server version = SQL Server 2022`, `Script Indexes = True`, `Script Foreign Keys = True`, `Script Primary Keys = True`, `Script Unique Keys = True`, and enable triggers if any. Save one UTF-8 or Unicode `.sql` file **locally** for review. Do not upload scripts with credentials/user logins or data. Review generated DDL for permissions and compatibility before applying in a blank hosted SQL Server 2022 Express database; preserve the Arabic_CI_AS collation when creating that database.
4. If data exists, or scripts contain unportable SQL Server 2025 features, do not assume schema-only migration is sufficient: revert to a verified 2025-compatible destination or a tested export/import route. Native backup downgrade remains unsupported.
5. Choose cost and create hosted SQL instance **only with owner consent**. Prefer a private network; if using managed SQL reachable from the Internet, use network allowlisting limited to Render outbound addresses, SQL authentication with least privilege, and verified TLS. **Never open port 1433 globally (0.0.0.0/0)**, including on the user's home PC.
6. RDS path only (native-backup migration only): create encrypted S3 bucket and correctly scoped IAM restore role, configure backup/restore option group, upload the `.bak` privately and restore to a staging DB. Validate restored schema/table counts and application SQL queries before cutover.
7. Keep old SQL Server database unchanged. Configure the Render **private environment** with `SQL_SERVER`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DATABASE=Mr10xMail`, `SQL_PORT`, `SQL_ENCRYPT=true`, and `SQL_TRUST_SERVER_CERTIFICATE=false`.
8. Preserve original `DATA_ENCRYPTION_KEY` and `CODE_HASH_KEY` in Render. Those keys are required to decrypt/verify data migrated from the previous backend. Never regenerate or disclose them in GitHub.
9. Configure other Render environment variables, including Supabase service role key, FRONTEND_ORIGIN, FRONTEND_SITE_URL, and exact `BACKEND_URL` HTTPS value. OAuth redirect URIs must use that deployed URL.
10. Test the API health endpoint and all merchant authorization paths, backend connectivity, order isolation, encrypted records, old and new data, revocation, and guest links on **staging**. Do not expose any customer's email codes or account details during testing.
11. After the hosted API is proven, set `HOSTED_API_ORIGIN` in `mail-bridge-config.js` to the real Render HTTPS URL, test GitHub Pages, and **only then** merge the draft PR. Keep a rollback plan.

## Render considerations

- Render Free Web Services spin down after inactivity; they are not reliable for unattended periodic mailbox polling. Before serving real customers, choose an appropriate always-on plan or restructure work into a dedicated reliable worker.
- `/api/health` checks DB access; failed health until a live SQL Server is reachable is expected.
- Render outbound IP ranges can be allowed by the database firewall. Review actual ranges of the deployed service; they can be shared/changed. https://render.com/docs/outbound-ip-addresses

## What GitHub cannot do by itself

It cannot access the owner's SQL Server on the PC, supply cloud account billing authorization, allocate a paid managed database, read or migrate existing data, or inject undisclosed credentials into Render. These are separate owner-controlled infrastructure actions.

**Sources (vendor docs):**
- https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/backup-restore/backup-restore-operations
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.Procedural.Importing.Native.Using.html
- https://aws.amazon.com/about-aws/whats-new/2026/07/rds-sqlserver-supports-sqlserver-2025/
- https://render.com/docs/free
