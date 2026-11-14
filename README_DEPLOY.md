# Mr10x deployment notes

This branch contains the local Mr10x frontend and Node.js backend snapshot provided by the project owner.

## Frontend
The static HTML/CSS/JS frontend is suitable for GitHub Pages once links to the deployed API are configured. Current `mail-bridge-config.js` uses `http://localhost:4000` for **local development only**.

## Backend
- Application root: `backend/`
- Start: `npm ci && npm start`
- Required Node.js: 22 or higher
- Entry: `backend/src/server.js`

## Required production setup before deployment
1. Host the Node.js API over HTTPS. Never serve the API from GitHub Pages.
2. Migrate SQL Server data securely to a reachable database with trusted TLS certificates.
3. Configure all required secrets from `backend/src/config.js` in the hosting provider's **private environment**. Never commit `.env` files or secret values.
4. Configure public frontend origin, backend origin, CORS, OAuth redirects, and Gmail / Outlook provider credentials.
5. Test authorization, rate limits, order isolation, token expiry, and deletion/revocation before enabling customer traffic.
6. Verify all mail handling follows the respective email and third-party service policies.

## Status
Snapshot for review **only**. Not production-ready. Do not merge to main or expose the API to real customers until configuration, security review and end-to-end tests pass.
