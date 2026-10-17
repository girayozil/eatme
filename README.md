# Calorie Diary

A calm, personal calorie and food diary, built as an iPhone-optimised web app.
Keep a menu of foods you eat often, then log them by meal in a few taps.

Live at **https://girayozil.github.io/eatme/** once GitHub Pages is switched on (see below).

## Using it on iPhone

1. Open the link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the Home Screen. It runs full screen, works offline, and keeps its data.

Data lives only on the phone (IndexedDB in the Home Screen app). There is no account and no server.
It is **not** in the iCloud backup, so use **Settings → Save a backup** now and then and keep the file in Files/iCloud Drive.
**Restore from a backup** brings it back, for example on a new phone.

Add `?demo` to the URL on an empty install to load sample data for a quick look.

## How it differs from the original native brief

The brief was written for a SwiftUI app. As a web app:

| Brief | Web app |
| --- | --- |
| SwiftData storage, covered by iCloud backup | IndexedDB on the device, plus manual backup/restore file |
| Local notification for the daily reminder | Web apps can't schedule alerts on iPhone without a server, so Settings adds a repeating **Calendar event with an alert** at the chosen time |
| Swift Charts | Hand-built bar charts matching the mockups |
| Dynamic Type, VoiceOver | Text follows the iPhone text size setting (`-apple-system-body`); icon buttons have labels; content behind sheets is hidden from VoiceOver |

Small additions not in the mockups: tapping a diary row edits or removes it (with Undo), menu foods can be deleted from the edit sheet as well as by swiping, and the 30-day chart lets you tap a bar to read its value.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests for the logging and trends rules
npm run build    # production build into dist/
```

Stack: Vite, React, TypeScript, vite-plugin-pwa. No runtime dependencies beyond React.

```
src/
  lib/types.ts     data model (Food, DiaryEntry, Settings)
  lib/logic.ts     logging rules, totals, trends, formatting
  lib/store.ts     in-memory state persisted to IndexedDB
  lib/files.ts     CSV export, backup, calendar reminder
  screens/         Today, Log food, Menu, Add/Edit food, Trends, Settings
  components/      Sheet, controls, icons
```

## Deploying with GitHub Pages

1. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow by hand from the Actions tab).

The build uses relative paths, so it works under `/eatme/` or on a custom domain.
