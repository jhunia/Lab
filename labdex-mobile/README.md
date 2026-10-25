# LabDex Mobile

The native Android and iOS version of LabDex, built with **Expo SDK 57 (React Native)**.

> Pinned to SDK 57 because the store version of Expo Go doesn't support SDK 58 yet. Once it does, run `npx expo install expo@latest --fix` to upgrade.

It uses the same data engine as the desktop app, so validation rules, versioning, seed data and the CSV format are identical on both. The engine lives in [`../labdex/src/shared`](../labdex/src/shared) and is copied into [`shared/`](shared) so cloud builds are self-contained. After changing the originals, run `npm run sync-shared`.

## Try it on your phone (no build needed)

1. Install **Expo Go** on your phone from the Google Play Store or the Apple App Store.
2. Make sure the phone and this PC are on the **same Wi-Fi network**.
3. On the PC:
   ```bash
   cd C:\Users\Jnr\Desktop\Lab\labdex-mobile
   npx expo start
   ```
4. Scan the QR code that appears in the terminal:
   - **Android:** scan it from inside the Expo Go app.
   - **iPhone:** scan it with the normal Camera app, then tap the banner.

If the phone can't connect (on some office or hospital networks), use `npx expo start --tunnel`.

## Build a real installable app

Builds run in Expo's cloud (EAS), so you don't need Android Studio or a Mac. You need a free Expo account.

This project is already linked to the Expo account **chris_jnr** ([dashboard](https://expo.dev/accounts/chris_jnr/projects/labdex)).

```bash
# Android .apk you can send to any Android phone (syncs shared code first)
npm run build:apk

# iOS (needs an Apple Developer account, US$99/year)
eas build --platform ios --profile production
```

`eas submit` uploads finished builds to Google Play or the App Store.

## Features

| Screen | What it does |
|---|---|
| **Directory** | Typo-tolerant search, filters for department, drafts/archived and storage temperature, test cards with tube stubs, and a **+** button for a new test |
| **Test detail** | Specimen label header, specimen, storage and stability, turnaround timeline, patient prep, collection tips, rejection criteria. Edit, duplicate, archive and restore. Deleting permanently requires typing the test code. |
| **History** | Every version with what changed. Tap to restore an earlier one. |
| **Edit / New** | Five-section form with a live preview card, a visual tube picker in order of draw, and storage tiles. Validation matches the desktop app. |
| **Planner** | Pick tests → tubes in CLSI order of draw, patient preparation, handling, slowest TAT |
| **Settings** | Light, dark or system theme. CSV import and export through the phone's share sheet. Container and department reference list. |

Haptic feedback confirms saves, deletes and selections.

## Data

Tests are stored **on the phone** (AsyncStorage). To move data between the desktop app and phones, use **Export CSV** and **Import CSV**. Rows are matched by test code, so re-importing updates tests instead of duplicating them.

For several phones and PCs to share one live directory, the next step is a shared backend (for example Supabase). See the roadmap in `../PROJECT_SPEC.md`.

## Project layout

```
src/
  app/                  Expo Router screens
    (tabs)/index.tsx      Directory
    (tabs)/planner.tsx    Collection planner
    (tabs)/settings.tsx   Theme, CSV, lookups
    test/[id].tsx         Test detail + history
    test/edit.tsx         Create / edit / duplicate (modal)
  components/           TubeIcon, StorageBadge, TatBar, TestCard, ListEditor, UI primitives
  lib/data.tsx          Data provider: shared LabCore + AsyncStorage
  lib/theme.tsx         "Specimen Rack" tokens (light/dark) and fonts
shared/                 Copy of ../labdex/src/shared (npm run sync-shared)
scripts/sync-shared.js  The copy script
```

## Checks

```bash
npx tsc --noEmit                       # typecheck
npx expo export --platform android     # full production bundle
npx expo start --web                   # quick look in a browser
```
