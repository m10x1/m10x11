-- Mr10x SQL Server 2022 Express — SCHEMA ONLY (NO DATA).
-- Source: Owner's SSMS Generate Scripts export from SQL Server 2025 Express
-- reviewed 2026-11-14. No logins, customer records or secrets are included.
-- CAUTION: Run ONCE, only on a NEW empty hosted database named Mr10xMail.
-- In SSMS connect to the TARGET server and select the TARGET Mr10xMail database
-- from the database dropdown. Do NOT run against the owner's local/source server.
-- This script deliberately omits USE [Mr10xMail] so the target is chosen explicitly.
-- Static syntax/features review only; actual SQL Server 2022 execution is pending.
IF DB_NAME() <> N'Mr10xMail'
    THROW 50001, 'Select the TARGET Mr10xMail database before running this script.', 1;
IF EXISTS (SELECT 1 FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo'))
    THROW 50002, 'The target database already has tables. Refusing schema setup.', 1;
GO
/****** Object:  Table [dbo].[EmailAccounts]    Schema export ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmailAccounts](
	[Id] [uniqueidentifier] NOT NULL,
	[StoreId] [uniqueidentifier] NOT NULL,
	[OwnerUserId] [uniqueidentifier] NOT NULL,
	[Provider] [varchar](12) NOT NULL,
	[ProviderAccountId] [nvarchar](200) NOT NULL,
	[EmailAddress] [nvarchar](254) NOT NULL,
	[TokenCipher] [nvarchar](max) NOT NULL,
	[ConnectionStatus] [varchar](20) NOT NULL,
	[ConnectedAt] [datetime2](3) NOT NULL,
	[LastSyncAt] [datetime2](3) NULL,
	[LastError] [nvarchar](250) NULL,
	[PollLeaseUntil] [datetime2](3) NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[UpdatedAt] [datetime2](3) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_EmailAccounts_Provider] UNIQUE NONCLUSTERED 
(
	[Provider] ASC,
	[ProviderAccountId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmailProcessingLogs]    Schema export ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmailProcessingLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[MailboxId] [uniqueidentifier] NOT NULL,
	[ProviderMessageId] [nvarchar](300) NOT NULL,
	[MessageReceivedAt] [datetime2](3) NOT NULL,
	[ProcessedAt] [datetime2](3) NOT NULL,
	[Status] [varchar](30) NOT NULL,
	[OrderId] [uniqueidentifier] NULL,
	[Note] [varchar](80) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_EmailLog_Message] UNIQUE NONCLUSTERED 
(
	[MailboxId] ASC,
	[ProviderMessageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OAuthStates]    Schema export ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OAuthStates](
	[StateHash] [char](64) NOT NULL,
	[StoreId] [uniqueidentifier] NOT NULL,
	[OwnerUserId] [uniqueidentifier] NOT NULL,
	[Provider] [varchar](12) NOT NULL,
	[VerifierCipher] [nvarchar](400) NOT NULL,
	[ExpiresAt] [datetime2](3) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[StateHash] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Orders]    Schema export ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Orders](
	[Id] [uniqueidentifier] NOT NULL,
	[CustomerPageId] [uniqueidentifier] NOT NULL,
	[StoreId] [uniqueidentifier] NOT NULL,
	[CustomerEmail] [nvarchar](254) NOT NULL,
	[MailboxId] [uniqueidentifier] NOT NULL,
	[ServiceName] [nvarchar](100) NOT NULL,
	[AllowedSender] [nvarchar](254) NOT NULL,
	[MatchMode] [varchar](12) NOT NULL,
	[MatchValue] [nvarchar](254) NOT NULL,
	[CreatedAt] [datetime2](3) NOT NULL,
	[ExpiresAt] [datetime2](3) NOT NULL,
	[GuestTokenHash] [char](64) NULL,
	[ServiceEmailCipher] [nvarchar](max) NULL,
	[ServicePasswordCipher] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Orders_Match] UNIQUE NONCLUSTERED 
(
	[MailboxId] ASC,
	[AllowedSender] ASC,
	[MatchMode] ASC,
	[MatchValue] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Orders_Page] UNIQUE NONCLUSTERED 
(
	[CustomerPageId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VerificationCodes]    Schema export ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VerificationCodes](
	[Id] [uniqueidentifier] NOT NULL,
	[OrderId] [uniqueidentifier] NOT NULL,
	[EmailLogId] [bigint] NOT NULL,
	[CodeCipher] [nvarchar](300) NOT NULL,
	[CodeDigest] [char](64) NOT NULL,
	[ReceivedAt] [datetime2](3) NOT NULL,
	[ExpiresAt] [datetime2](3) NOT NULL,
	[ViewedAt] [datetime2](3) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[OrderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[EmailLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [IX_EmailAccounts_Store]    Schema export ******/
CREATE NONCLUSTERED INDEX [IX_EmailAccounts_Store] ON [dbo].[EmailAccounts]
(
	[StoreId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_EmailLogs_Processed]    Schema export ******/
CREATE NONCLUSTERED INDEX [IX_EmailLogs_Processed] ON [dbo].[EmailProcessingLogs]
(
	[ProcessedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Orders_GuestTokenHash]    Schema export ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_Orders_GuestTokenHash] ON [dbo].[Orders]
(
	[GuestTokenHash] ASC
)
WHERE ([GuestTokenHash] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_Orders_Mailbox]    Schema export ******/
CREATE NONCLUSTERED INDEX [IX_Orders_Mailbox] ON [dbo].[Orders]
(
	[MailboxId] ASC,
	[ExpiresAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[EmailAccounts] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[EmailAccounts] ADD  DEFAULT ('connected') FOR [ConnectionStatus]
GO
ALTER TABLE [dbo].[EmailAccounts] ADD  DEFAULT (sysutcdatetime()) FOR [ConnectedAt]
GO
ALTER TABLE [dbo].[EmailAccounts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmailAccounts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[EmailProcessingLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ProcessedAt]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VerificationCodes] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[VerificationCodes] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[EmailProcessingLogs]  WITH CHECK ADD FOREIGN KEY([MailboxId])
REFERENCES [dbo].[EmailAccounts] ([Id])
GO
ALTER TABLE [dbo].[EmailProcessingLogs]  WITH CHECK ADD FOREIGN KEY([OrderId])
REFERENCES [dbo].[Orders] ([Id])
GO
ALTER TABLE [dbo].[Orders]  WITH CHECK ADD FOREIGN KEY([MailboxId])
REFERENCES [dbo].[EmailAccounts] ([Id])
GO
ALTER TABLE [dbo].[VerificationCodes]  WITH CHECK ADD FOREIGN KEY([EmailLogId])
REFERENCES [dbo].[EmailProcessingLogs] ([Id])
GO
ALTER TABLE [dbo].[VerificationCodes]  WITH CHECK ADD FOREIGN KEY([OrderId])
REFERENCES [dbo].[Orders] ([Id])
GO
ALTER TABLE [dbo].[EmailAccounts]  WITH CHECK ADD CHECK  (([ConnectionStatus]='disconnected' OR [ConnectionStatus]='error' OR [ConnectionStatus]='needs_reauth' OR [ConnectionStatus]='connected'))
GO
ALTER TABLE [dbo].[EmailAccounts]  WITH CHECK ADD CHECK  (([Provider]='outlook' OR [Provider]='gmail'))
GO
ALTER TABLE [dbo].[EmailProcessingLogs]  WITH CHECK ADD CHECK  (([Status]='error' OR [Status]='duplicate' OR [Status]='delivered' OR [Status]='ambiguous' OR [Status]='unmatched' OR [Status]='no_code' OR [Status]='ignored'))
GO
ALTER TABLE [dbo].[OAuthStates]  WITH CHECK ADD CHECK  (([Provider]='outlook' OR [Provider]='gmail'))
GO
ALTER TABLE [dbo].[Orders]  WITH CHECK ADD CHECK  (([MatchMode]='recipient' OR [MatchMode]='reference'))
GO
ALTER TABLE [dbo].[Orders]  WITH CHECK ADD  CONSTRAINT [CK_Orders_Expiry] CHECK  (([ExpiresAt]>[CreatedAt]))
GO
ALTER TABLE [dbo].[Orders] CHECK CONSTRAINT [CK_Orders_Expiry]
GO