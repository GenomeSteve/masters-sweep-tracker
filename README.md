# Masters Sweep Tracker

This is a deployable web app for Vercel.

## What it does
- serves a static front end from `index.html`
- uses `data/teams.json` built from your uploaded workbook
- calls `api/leaderboard.js` on the same origin for live Masters scores
- calculates each team's best 4 of 6 in the browser

## Deploy on Vercel
1. Create a new GitHub repository and upload these files.
2. In Vercel, import that repository.
3. Deploy with the default settings.
4. Open the deployed site and use **Refresh live scores**.

## Notes
- The live endpoint uses ESPN's PGA scoreboard and summary feeds server-side.
- Because the fetch runs inside the serverless function, the browser no longer has the CORS problem that broke the HTML-only version.
- If ESPN changes its payload shape, only `api/leaderboard.js` should need updating.
