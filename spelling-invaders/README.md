# Spelling Invaders

Spelling Invaders is a local-first, tablet-friendly spelling arcade game for fifth graders. Players listen to weekly spelling words, type their answer, and defend Earth with a neon ship.

## Features

- Arcade, Practice, and Friday Spelling Test modes
- Built-in Web Speech API replay and contextual sentence audio
- 20-word demonstration fifth-grade list
- Parent Zone editor with duplicate removal, activation, analytics, JSON backup/restore, and reset controls
- Persistent progress, streaks, coins, achievements, test history, and cosmetic ship bay via versioned LocalStorage
- Responsive landscape and portrait layouts with large touch targets and reduced-motion compatibility

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL. For a production build, use `npm run build` and `npm run preview`.

## Testing

`npm test` runs the pure spelling/domain tests. `npm run build` performs TypeScript checking and the production bundle build. Browser interaction and speech output still need human verification because speech synthesis and touch behavior depend on the browser/device.

## Weekly lists and backups

Open Parent Zone, edit the list name and words, then choose **Save & Activate**. Words can be pasted one per line or separated by commas. Use **Back Up Data** before changing devices and **Restore Data** to import the JSON file. Progress is stored only in this browser's LocalStorage and is not synced between devices.

## Speech limitations

Speech uses the browser's built-in `speechSynthesis`. Voice availability varies by browser and operating system. Audio is only started after a player action; if speech is unavailable, Practice Mode remains usable with visible feedback, while Arcade/Test never reveal a target word before submission.

## Known limitations

This release uses lightweight procedural Canvas effects rather than external artwork or a service worker. The educational flow, persistence, editor, analytics, scoring, and responsive controls are complete; speech voice selection is intentionally left to the browser's default for reliable tablet support.
