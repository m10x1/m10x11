-- Mr10x SQL Server preflight — READ ONLY
-- Run in SSMS using the owner/admin connection. Never run this in Supabase.
-- Produces metadata only: no emails, passwords, verification codes or tokens.
USE [Mr10xMail];
GO
SET NOCOUNT ON;

-- The database is known to have been developed on SQL Server 17.x (2025).
-- A native .bak cannot be restored onto an older SQL Server major version.
SELECT
  CAST(SERVERPROPERTY('ProductMajorVersion') AS nvarchar(20)) AS ServerMajorVersion,
  CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(50)) AS ServerVersion,
  CAST(SERVERPROPERTY('Edition') AS nvarchar(200)) AS SqlEdition,
  DB_NAME() AS DatabaseName;

SELECT name AS DatabaseName, compatibility_level AS CompatibilityLevel,
       collation_name AS CollationName, state_desc AS DatabaseState
FROM sys.databases WHERE name=DB_NAME();

SELECT type_desc AS FileType,
       CAST(SUM(size)*8.0/1024 AS decimal(18,2)) AS AllocatedMB
FROM sys.database_files GROUP BY type_desc ORDER BY type_desc;

-- Approximate rows; based on storage metadata, not actual customer records.
SELECT SCHEMA_NAME(t.schema_id) AS SchemaName, t.name AS TableName,
       COALESCE(SUM(CASE WHEN p.index_id IN (0,1) THEN p.rows ELSE 0 END),0) AS ApproxRows
FROM sys.tables t
LEFT JOIN sys.partitions p ON p.object_id=t.object_id
GROUP BY t.schema_id,t.name ORDER BY SchemaName,TableName;

-- Only confirms required guest-delivery column presence.
SELECT
 CASE WHEN OBJECT_ID('dbo.Orders','U') IS NULL THEN 0 ELSE 1 END AS OrdersExists,
 CASE WHEN COL_LENGTH('dbo.Orders','GuestTokenHash') IS NULL THEN 0 ELSE 1 END AS GuestTokenHashExists,
 CASE WHEN COL_LENGTH('dbo.Orders','ServiceEmailCipher') IS NULL THEN 0 ELSE 1 END AS ServiceEmailCipherExists,
 CASE WHEN COL_LENGTH('dbo.Orders','ServicePasswordCipher') IS NULL THEN 0 ELSE 1 END AS ServicePasswordCipherExists;

-- Do not include database passwords, .env, or customer data in any screenshot.
