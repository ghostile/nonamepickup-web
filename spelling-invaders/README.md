# Spelling Invaders

Spelling Invaders is a local-first, tablet-friendly spelling arcade game for fifth graders. Players listen to weekly spelling words, type their answer, and defend Earth with a neon ship.

## Features

- Arcade, Practice, and Friday Spelling Test modes
- Built-in Web Speech API replay and contextual sentence audio
- 20-word demonstration fifth-grade list
- Parent Zone editor with duplicate removal, activation, analytics, JSON backup/restore, and reset controls
- Protected shared Parent Zone scoreboard showing named player Arcade, Practice, and Friday Test summaries
- Persistent progress, streaks, coins, achievements, test history, and cosmetic ship bay via versioned LocalStorage
- Responsive landscape and portrait layouts with large touch targets and reduced-motion compatibility

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL. For a production build, use `npm run build` and `npm run preview`.

The production build is configured for the hosted path `/spelling/` and writes the deployable static files to the repository's top-level `spelling/` directory.

## Hosted server setup

Keep these server-only values in `api/.env`:

```dotenv
SPELLING_ADMIN_USER=ricky
SPELLING_ADMIN_PASSWORD=your-parent-zone-password
SPELLING_LISTS_FILE=/root/tfcbot/spelling-lists.json
SPELLING_SCORES_FILE=/root/tfcbot/spelling-scores.json
```

After pulling a release, restart the API with PM2:

```bash
cd /var/www/tfcbot
git pull --ff-only origin main
cd api
set -a && . ./.env && set +a
pm2 restart tfcapi --update-env
pm2 save
```

Nginx should protect both `/spelling/parent/` and `/api/spelling/admin/`. Public clients submit summaries to `/api/spelling/scores`; Parent Zone reads them from `/api/spelling/admin/scores`.

## Testing

`npm test` runs the pure spelling/domain tests. `npm run build` performs TypeScript checking and the production bundle build. Browser interaction and speech output still need human verification because speech synthesis and touch behavior depend on the browser/device.

## Weekly lists and backups

Open Parent Zone, edit the list name and words, then choose **Save & Activate**. Words can be pasted one per line or separated by commas. Use **Back Up Data** before changing devices and **Restore Data** to import the JSON file. Player progress, answer history, coins, and achievements remain in each browser's LocalStorage and are not synced between devices. Completed session summaries are sent to the protected Parent Zone scoreboard when the API is available. Names and results are self-reported, not verified accounts.

## Speech limitations

Speech uses the browser's built-in `speechSynthesis`. Voice availability varies by browser and operating system. Audio is only started after a player action; if speech is unavailable, Practice Mode remains usable with visible feedback, while Arcade/Test never reveal a target word before submission.

## Known limitations

This release uses lightweight procedural Canvas effects rather than external artwork or a service worker. The educational flow, persistence, editor, analytics, scoring, and responsive controls are complete; speech voice selection is intentionally left to the browser's default for reliable tablet support.

The Parent Zone is a separate `/spelling/parent/` page intended to sit behind server-side HTTP Basic Auth. Configure the web server to protect that path; do not put a password in the client bundle.

The active weekly list is server-backed through `/api/spelling/active`. The Parent Zone saves through `/api/spelling/admin/list`; configure `SPELLING_ADMIN_USER` and `SPELLING_ADMIN_PASSWORD` in the API's private `.env` and protect the admin API path with the same nginx Basic Auth.

The server stores up to the most recent 2,000 score summaries in `SPELLING_SCORES_FILE`. Clearing shared results removes only scoreboard summaries; it does not erase weekly lists or player browser progress.
