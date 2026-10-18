# Calorie Diary

A calm, personal calorie and food diary, built as an iPhone-optimised web app.
Keep a menu of foods you eat often, then log them by meal in a few taps.

Live at **https://girayozil.github.io/eatme/** once GitHub Pages is switched on (see below).

## Using it on iPhone

1. Open the link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the Home Screen. It runs full screen, works offline, and keeps its data.

The first time, create an account with email and password. After that the app stays signed in.

Data is saved to a private account in Firebase (Firestore) and kept on the phone too, so it works offline and
syncs when back online. It survives a lost phone and can be used from more than one device.
**Settings → Save a backup** and **Export** still work as an extra safety net.

Anything saved by the earlier on-phone-only version is moved into the account automatically on first sign-in.

## How it differs from the original native brief

The brief was written for a SwiftUI app. As a web app:

| Brief | Web app |
| --- | --- |
| SwiftData storage, covered by iCloud backup, no account | Firestore with an email and password account, offline cache on the phone, plus backup/restore file |
| Local notification for the daily reminder | Web apps can't schedule alerts on iPhone without a server, so Settings adds a repeating **Calendar event with an alert** at the chosen time |
| Swift Charts | Hand-built bar charts matching the mockups |
| Dynamic Type, VoiceOver | Text follows the iPhone text size setting (`-apple-system-body`); icon buttons have labels; content behind sheets is hidden from VoiceOver |

Small additions not in the mockups: tapping a diary row edits or removes it (with Undo), menu foods can be deleted from the edit sheet as well as by swiping, and the 30-day chart lets you tap a bar to read its value.

## Firebase

Project: `eatme-d825b`. Config is in `src/lib/firebase.ts` (it identifies the project and is not a secret).

One-time setup in the [Firebase console](https://console.firebase.google.com/project/eatme-d825b):

1. **Firestore Database**: create it (done), then on the **Rules** tab paste the contents of
   [`firestore.rules`](firestore.rules) and **Publish**. These rules let each person read and write only their own data.
2. **Authentication → Sign-in method**: enable **Email/Password**.
3. Once the account is created, optionally turn off new sign-ups:
   **Authentication → Settings → User actions →** untick **Enable create (sign-up)**.

Data layout: `users/{uid}/foods/{id}`, `users/{uid}/entries/{id}`, `users/{uid}/notes/{YYYY-MM-DD}`, `users/{uid}/meta/settings`.
Only the last 45 days are kept live, so each app launch reads a few hundred documents at most. Older days load when you
browse back to them, and exports fetch everything once. One person's daily use is well under 1% of the free tier.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests for the logging and trends rules
npm run build    # production build into dist/
```

To develop without touching the real project, run the Firebase emulators
(`npx firebase-tools emulators:start --only auth,firestore`, needs Java) and start the app with
`VITE_EMULATORS=1 npm run dev`. In development, `?demo` fills an empty account with sample data.

Stack: Vite, React, TypeScript, Firebase (Auth and Firestore), vite-plugin-pwa.

```
src/
  lib/types.ts     data model (Food, DiaryEntry, Settings)
  lib/logic.ts     logging rules, totals, trends, formatting
  lib/firebase.ts  Firebase setup
  lib/store.ts     sync with Firestore, actions, moving old on-phone data
  lib/files.ts     CSV export, backup, calendar reminder
  screens/         Today, Log food, Menu, Add/Edit food, Trends, Settings
  components/      Sheet, controls, icons
```

## Deploying with GitHub Pages

1. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow by hand from the Actions tab).

The build uses relative paths, so it works under `/eatme/` or on a custom domain.
