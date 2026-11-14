-- Mr10x: exact row-count verification (READ ONLY).
-- This returns counts only: no customer, email, password or OTP content.
USE [Mr10xMail];
GO
SELECT 'dbo.EmailAccounts' AS TableName, COUNT_BIG(*) AS ExactRows FROM dbo.EmailAccounts
UNION ALL SELECT 'dbo.EmailProcessingLogs', COUNT_BIG(*) FROM dbo.EmailProcessingLogs
UNION ALL SELECT 'dbo.OAuthStates', COUNT_BIG(*) FROM dbo.OAuthStates
UNION ALL SELECT 'dbo.Orders', COUNT_BIG(*) FROM dbo.Orders
UNION ALL SELECT 'dbo.VerificationCodes', COUNT_BIG(*) FROM dbo.VerificationCodes;
