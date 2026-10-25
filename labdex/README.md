# LabDex

A native desktop app (Windows, with macOS and Linux possible) for managing a laboratory's test directory. It tracks each test's specimen type and volume, container, storage and stability, turnaround time, a short description, and collection tips.

See [`../PROJECT_SPEC.md`](../PROJECT_SPEC.md) for the full product spec.

## Run it

```bash
npm install
npm run dev        # development, with hot reload
npm run build      # production bundles in out/
npm run dist       # Windows installer in release/
```

> If `npm install` skips Electron's binary download (the `electron` command fails with "Electron failed to install correctly"), run `node node_modules/electron/install.js` once.

## Features

| Area | What you get |
|---|---|
| **CRUD** | Create, edit, duplicate, archive (soft delete), restore. Permanent delete only works on archived tests and you must type the test code to confirm. |
| **Version history** | Every save records a snapshot and the list of fields that changed. Any earlier version can be restored. |
| **Search** | Typo-tolerant search across code, name, synonyms and sample type (`glucoze` finds Glucose). |
| **Filters** | Department (sidebar), storage temperature, container, drafts and archived. Sort by name, code, fastest TAT or recently updated. |
| **Views** | Rack (cards) or dense table. The app remembers which one you used. |
| **Collection Planner** | Pick the tests ordered for a patient to see the tubes in CLSI order of draw, patient preparation, handling and the expected result time. It can be printed. |
| **Lookups** | Edit containers (cap colour, additive, size, draw order) and departments (colour). Anything still used by a test can't be deleted. |
| **CSV import and export** | Load an existing spreadsheet on day one. Rows are matched by test code, so a re-import updates tests instead of duplicating them. |
| **Print** | Prints a single test as a bench card, or the collection plan. |
| **Theme** | Light, dark or follow the system. The native title bar matches. |

### Keyboard

| Keys | Action |
|---|---|
| `Ctrl K` | Command palette: jump to any test or run a command |
| `Ctrl N` | New test |
| `Ctrl E` | Edit the selected test |
| `Ctrl S` | Save (inside the form) |
| `/` | Focus search |
| `Esc` | Close |

## CSV format

Export once to get a template. List fields use ` | ` as the separator.

| Column | Example |
|---|---|
| `code`, `name` | `CHEM-UE`, `Urea & Electrolytes` |
| `synonyms` | `U&E \| Renal profile` |
| `department`, `container` | Matched by name. Unknown names are created automatically. |
| `volume`, `volumeUnit`, `minVolume`, `paedVolume` | `4`, `mL`, `1`, *(blank)* |
| `storageTemp` | `ROOM`, `FRIDGE`, `FROZEN` or `DEEP_FROZEN` |
| `stability` | `ROOM:8h \| FRIDGE:2d` |
| `tatRoutine`, `tatUrgent` | `2h`, `45min` (units are `min`, `h`, `d`, `wk`) |
| `protectFromLight` | `yes` / `no` |
| `suggestions`, `rejectionCriteria` | Lists separated by ` \| ` |
| `status` | `PUBLISHED`, `DRAFT` or `ARCHIVED` |

## Where the data lives

All data stays on this computer in one JSON file:

```
%APPDATA%\LabDex\labdex-data.json
```

The folder button at the bottom of the sidebar opens it. Every save is written atomically (to a temporary file, then renamed) and the previous version is kept as `labdex-data.json.bak`. If the file is ever corrupted, it is set aside instead of being overwritten.

The 15 seed tests are **illustrative only**. Replace them with your laboratory's own validated requirements.

## Project layout

```
src/
  shared/      types and validation used by both processes
  main/        Electron main process: window, IPC, JSON store, CSV, seed data
  preload/     secure bridge (contextIsolation + sandbox; no Node in the UI)
  renderer/    React UI
    components/  TubeIcon, StorageBadge, TatBar, TestCard, TestDetail, TestForm, CommandPalette…
    views/       CatalogView, PlannerView, LookupsView
    styles.css   "Specimen Rack" design system (tokens, light and dark)
```

## Roadmap (from the spec)

- User accounts and roles (Admin / Editor / Viewer) and an approval workflow
- "Review due" reminders (annual document review)
- QR code per test and a PDF handbook export
- Test panels (LFT, U&E as groups)
- Moving from the JSON store to SQLite or a shared server database for multi-PC use
