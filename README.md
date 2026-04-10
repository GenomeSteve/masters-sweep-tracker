# Masters Sweep Tracker

This is a deployable web app for Vercel.

## What it does
- serves a static front end from `index.html`
- uses `data/teams.json` built from your uploaded workbook
- calls `api/live-scores.js` on the same origin for live Masters scores
- calculates each team's best 4 of 6 in the browser
- applies missed-cut penalties only once the cut is finalised

## Deploy on Vercel
1. Create a new GitHub repository and upload these files.
2. In Vercel, import that repository.
3. Set the project Node version to `22.x`.
4. Deploy and use **Refresh live scores**.

## Notes
- The live endpoint uses ESPN's PGA scoreboard feed server-side.
- The browser calls `./api/live-scores`; it does not call ESPN directly.
- If live data fails, the front end falls back to the workbook seed scores.
- If ESPN changes its payload shape, only `api/live-scores.js` should need updating.
