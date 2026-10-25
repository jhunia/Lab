# LabDex: Lab Test Directory and Specimen Guide

> Working name: **LabDex**. Rename it freely.
> Status: concept and specification, before any code. Date: 2026-10-20.

---

## 1. The Idea in One Paragraph

LabDex is a fast, searchable catalogue of the tests a laboratory offers. For every test it records what the bench and the phlebotomist need to know: the specimen type and volume, which tube or container to use, how to store and transport it, the turnaround time (TAT), a short description, and practical tips. Lab staff can **create, view, edit, update, and delete** tests. Everyone else (clinicians, nurses, phlebotomists, front desk) gets an answer to "what do I collect for this test, and how?" in under five seconds.

---

## 2. The Problem It Solves

| Pain today | How LabDex fixes it |
|---|---|
| Test requirements live in binders, PDFs, Excel sheets, or one senior tech's memory | One searchable source of truth |
| Wrong tube or wrong volume leads to rejected samples and recollection | Visual tube colour chips, minimum volumes, and rejection criteria on every test |
| Information goes stale, and nobody knows who changed what | Version history, audit trail, and a "last reviewed" date |
| Clinicians call the lab to ask simple questions | A read-only public or ward view they can search |
| New staff take a long time to learn the menu | Clear test cards plus "specific suggestions" written by experienced staff |

---

## 3. Users and Roles

| Role | Can do |
|---|---|
| **Admin / Lab Manager** | Everything, plus managing users, approving changes, and editing lookup lists (containers, sample types) |
| **Editor / Senior Scientist** | Create and edit tests and submit them for review |
| **Viewer / Clinician / Phlebotomist** | Search and view tests, print collection labels and guides |
| **Public (optional)** | A read-only test menu that can be embedded on the lab's website |

---

## 4. Data Model

### 4.1 Your required fields, made more precise

Several of your fields hold more than one value. "Sample type and volume" is really two to four values. Storing them as **structured** fields instead of free text is what makes filtering, validation, and printing possible later.

| Your field | Structured fields | Type / example |
|---|---|---|
| **ID** | `id` (internal UUID), `code` (human code) | `code`: `HAEM-001`, `CHEM-GLU` (unique, shown in monospace) |
| **Name** | `name`, `synonyms[]`, `abbreviation` | "Full Blood Count", synonyms: "CBC", "FBC", "Hemogram" |
| **Sample type and volume** | `sample_type`, `volume_value`, `volume_unit`, `min_volume_value`, `paediatric_volume` | Whole blood, 3, mL, min 1 mL, paeds 0.5 mL |
| **Container** | `container_id` → lookup table (name, cap colour, additive, size) | Lavender top, K2-EDTA, 4 mL |
| **Storage condition** | `storage_temp` (enum), `stability[]` (temperature + duration), `light_protect`, `transport_notes` | Refrigerated 2–8 °C; stable 24 h RT / 72 h fridge; protect from light |
| **TAT** | `tat_routine` (value + unit), `tat_urgent`, `tat_notes`, `days_performed` | Routine 4 h, STAT 1 h, run Mon–Fri |
| **Brief info** | `description` (short, about 300 characters max), `clinical_use` | "Measures the cells in blood…" |
| **Specific suggestions** | `collection_instructions`, `patient_prep`, `special_notes` | "Invert 8–10×", "Fasting 8–12 h", "Do not refrigerate" |

### 4.2 Recommended extra fields

These are standard in professional test directories such as Mayo and ARUP.

| Field | Why it matters |
|---|---|
| `department` / `section` | Haematology, Chemistry, Micro, Immunology… Used for filtering and colour coding |
| `rejection_criteria[]` | Haemolysed, clotted, under-filled, unlabelled, wrong tube. **Reduces recollections.** |
| `reference_range` | Optional, with sex and age bands |
| `units` | e.g. mmol/L, g/dL |
| `method` | Analyzer or method name, e.g. "Photometric", "PCR" |
| `loinc_code` | International standard test code. Prepares the app for future LIS/EHR integration. |
| `cpt_code` / local billing code | If billing matters |
| `price` | Optional, for a public price list |
| `order_of_draw` | Derived from container, for multi-test collections |
| `is_active` / `status` | Draft → In Review → Published → Archived (prefer **soft delete**) |
| `is_referral` + `referral_lab` | For tests sent out to another lab |
| `tags[]` | e.g. "fasting", "STAT available", "send-out" |
| `attachments[]` | Request forms, consent forms, collection diagrams |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `last_reviewed_at`, `version` | Audit and accreditation (ISO 15189 / CAP require document control) |

### 4.3 Lookup tables (admin-editable)

- **Containers**: name, cap colour (hex), additive, volume, order-of-draw position, image
- **Sample types**: whole blood, serum, plasma, urine (random/24 h), CSF, swab, stool, tissue…
- **Departments**
- **Storage conditions**: Room temp (15–25 °C), Refrigerated (2–8 °C), Frozen (−20 °C), Deep frozen (−70 °C)

### 4.4 Entity sketch

```
Test ──┬── Container (many-to-one, or many-to-many for multi-tube tests)
       ├── SampleType
       ├── Department
       ├── StabilityRule[]   (temp, duration, unit)
       ├── RejectionCriterion[]
       ├── Attachment[]
       └── TestVersion[]     (full snapshot on every save → history and restore)

TestPanel ── Test[]           (e.g. "Lipid Profile" = TC + HDL + LDL + TG)
AuditLog  (who, what, when, before/after diff)
User ── Role
```

---

## 5. Features

### 5.1 MVP (version 1)

1. **Full CRUD** for tests, with form validation
2. **Instant search** by name, code, synonym, or abbreviation (typo-tolerant, so "glucoze" finds Glucose)
3. **Filters**: department, sample type, container, storage temperature, TAT band, status
4. **Test detail card**: everything on one screen, printable
5. **Soft delete and restore** (an Archived state, never hard delete by default)
6. **Audit trail**: who changed what and when
7. **Lookup management** for containers, sample types, and departments
8. **Import/Export** to CSV/Excel, so an existing spreadsheet can be loaded on day one
9. **Authentication and roles** (Admin / Editor / Viewer)
10. **Responsive layout**: phlebotomists use phones and tablets at the bedside

### 5.2 Vital "pro" features (version 2)

| Feature | Value |
|---|---|
| **Version history with diff and restore** | Required for accreditation; recovers mistakes |
| **Review / approval workflow** | Editor submits, Manager approves, then the test is Published |
| **"Review due" reminders** | Flags tests not reviewed in 12 months (a common QA requirement) |
| **Collection Planner** | Pick several tests and get the minimum set of tubes, in **CLSI order of draw**, with total volume. *This is the standout feature.* |
| **Test panels / profiles** | Group tests (LFT, U&E, Lipid profile) |
| **Printable bench cards / PDF test menu** | One click produces a lab handbook PDF |
| **QR code per test** | Stick it on the fridge or bench; scanning opens the test card |
| **Public read-only menu** | Embed on the lab's website for clinicians |
| **Offline mode (PWA)** | Works in wards with bad Wi-Fi |
| **Keyboard command palette** | `Ctrl+K`, type "ferr", press Enter. Power users love it. |
| **Dark mode** | Night shift friendly |

### 5.3 Future (version 3 and later)

- LOINC lookup and auto-fill
- FHIR `ActivityDefinition` / `SpecimenDefinition` export for LIS/EHR integration
- Multi-site support (different labs, different TATs)
- Multi-language
- Analytics: most-viewed tests, most-rejected sample types
- Assistant-style search, e.g. "what tube for HbA1c in a child?"

---

## 6. Frontend Design Direction: Not Generic

The goal is to **avoid the default admin-template look** (a grey sidebar, blue buttons, and a plain table). The design should feel like a precision instrument built for a lab.

### 6.1 Concept: "Specimen Rack"

The UI borrows from the physical lab: **tube caps, specimen labels, and the analyzer screen**.

- **Tube cap colour system as the core visual language.** Every test shows a small rendered tube icon in its real cap colour (lavender, gold/SST, light blue, grey, green, red, royal blue, yellow, pink). People recognise it before they read anything.
- **Test codes look like printed specimen labels**: monospace font, a subtle barcode strip, and a perforated-edge card shape.
- **Department colour rails**: a thin vertical colour band on each card (Haematology = crimson, Chemistry = amber, Micro = teal, Immunology = violet, Molecular = indigo).
- **Storage temperature as a visual thermometer badge**: a snowflake for frozen, a droplet for fridge, a sun for room temperature, each with its own tint.
- **TAT shown as a small timeline bar** rather than plain text: routine vs STAT on one scale.

### 6.2 Typography

| Use | Font | Why |
|---|---|---|
| Headings | **Space Grotesk** or **Sora** | Technical and modern, but not cold |
| Body | **Inter** or **IBM Plex Sans** | Highly legible at small sizes |
| Codes, IDs, volumes | **JetBrains Mono** or **IBM Plex Mono** | A lab-label, instrument-readout feel |

### 6.3 Colour palette

```
Background (light)   #F6F7F4  warm "lab paper" off-white
Surface              #FFFFFF
Ink                  #14181F  near-black, not pure black
Muted ink            #5B6472
Primary accent       #0E7C66  deep clinical teal (not generic blue)
Accent 2             #E2B33C  biohazard-amber, used sparingly
Danger               #C2412D
Grid lines           #E4E7E1

Dark mode background #0D1117 with a faint 24px graph-paper grid
```

### 6.4 Signature layouts

1. **Home / Search**: a large, centred search bar (like a lab-wide command line) with recent tests and department "racks" underneath.
2. **Test grid**: cards arranged like tubes in a rack. Toggle to a dense **table view** for power users.
3. **Test detail**: split layout.
   - Left: a "specimen label" header (code, name, tube icon, department rail)
   - Right: tabs for *Collection*, *Storage & Stability*, *TAT*, *Notes*, *History*
   - Rejection criteria shown as a red checklist
4. **Edit form**: a **multi-step "requisition" form** instead of one long form, with a live preview card that updates as you type.
5. **Collection Planner**: drag tests into a "tray", and the tubes line up in order of draw.

### 6.5 Micro-interactions

- A tube "fills" with colour on hover or select
- A subtle analyzer-style counter animation on dashboard numbers
- Toasts styled as small printed labels sliding out
- Delete confirmation that requires typing the test code (prevents accidents)

### 6.6 Accessibility

- Never rely on colour alone: tube colour chips **always** carry a text label ("Lavender – EDTA"). This matters because some users are colour-blind.
- WCAG AA contrast, full keyboard navigation, visible focus rings.

---

## 7. Recommended Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | **React + TypeScript + Vite** (or **Next.js** if a public SEO menu matters) | A large ecosystem, typed forms |
| Styling | **Tailwind CSS** with **custom design tokens** (not a stock component kit) and **Radix UI primitives** for accessible behaviour | The look is unique while the behaviour stays accessible |
| Forms | React Hook Form + Zod | Strong validation, shared schemas |
| Data fetching | TanStack Query | Caching, optimistic updates |
| Search | Fuse.js (client side) for MVP; Postgres full-text / Meilisearch later | Typo tolerance |
| Backend | **Node.js (Fastify or NestJS)** or **Python (FastAPI)** | Pick whichever language you know best |
| Database | **PostgreSQL** (SQLite is fine for a single-lab local MVP) | Relational data plus JSONB for flexible fields |
| ORM | Prisma (Node) / SQLModel (Python) | Migrations |
| Auth | Auth.js / Clerk / Supabase Auth | Role-based access |
| PDF / QR | `@react-pdf/renderer`, `qrcode` | Bench cards and handbook |
| Hosting | Vercel/Netlify (frontend) + Railway/Render/Supabase (API + DB) | Cheap, simple |

> **Simplest path:** Next.js + Prisma + PostgreSQL (or Supabase) in one repo.

---

## 8. API Sketch (REST)

```
GET    /api/tests                 ?q=&department=&container=&storage=&status=&page=
GET    /api/tests/:id
POST   /api/tests
PUT    /api/tests/:id             (full update)
PATCH  /api/tests/:id             (partial update)
DELETE /api/tests/:id             (soft delete → status = archived)
POST   /api/tests/:id/restore
GET    /api/tests/:id/history
POST   /api/tests/import          (CSV/XLSX)
GET    /api/tests/export          ?format=csv|xlsx|pdf

GET/POST/PUT/DELETE /api/containers
GET/POST/PUT/DELETE /api/sample-types
GET/POST/PUT/DELETE /api/departments

POST   /api/planner               { testIds: [] } → tubes in order of draw + volumes
```

---

## 9. Validation Rules

- `code`: required, unique, uppercase, pattern `^[A-Z0-9-]{2,20}$`
- `name`: required, 2–120 characters
- `volume_value` > 0, and `min_volume_value` ≤ `volume_value`
- `container` is required for blood specimens
- `tat_urgent` ≤ `tat_routine` when both are present
- `description` ≤ 300 characters (keeps it "brief")
- Warn, rather than block, on duplicate names or synonyms

---

## 10. Sample Record

```json
{
  "code": "HAEM-FBC",
  "name": "Full Blood Count",
  "synonyms": ["CBC", "FBC", "Haemogram"],
  "department": "Haematology",
  "sample_type": "Whole blood",
  "volume": { "value": 3, "unit": "mL", "min": 1, "paediatric": 0.5 },
  "container": { "name": "Lavender top", "additive": "K2-EDTA", "cap_hex": "#9B7BC8" },
  "storage": {
    "temp": "ROOM_TEMP",
    "stability": [
      { "temp": "ROOM_TEMP", "duration": 24, "unit": "h" },
      { "temp": "REFRIGERATED", "duration": 72, "unit": "h" }
    ],
    "light_protect": false
  },
  "tat": { "routine": { "value": 2, "unit": "h" }, "urgent": { "value": 30, "unit": "min" } },
  "description": "Quantifies red cells, white cells and platelets, with haemoglobin and indices.",
  "suggestions": [
    "Invert gently 8–10 times immediately after collection",
    "Do not refrigerate if a blood film is required",
    "Under-filled tubes alter MCV/HCT – fill to the line"
  ],
  "rejection_criteria": ["Clotted", "Under-filled", "Unlabelled", ">24 h old"],
  "status": "PUBLISHED"
}
```

> Values are illustrative. Every lab must enter **its own validated** requirements.

---

## 11. Existing Apps That Do Something Similar

Study these for ideas, and to see where LabDex can stand out.

### Public test directories (the closest match to this idea)
| Product | Notes |
|---|---|
| **Mayo Clinic Laboratories Test Catalog** | The gold standard: specimen requirements, stability, rejection criteria, TAT, CPT/LOINC |
| **ARUP Laboratories Lab Test Directory** | A very clean specimen and stability layout; worth studying |
| **Quest Diagnostics Test Directory** | Large catalogue with collection details |
| **Labcorp Test Menu** | Similar, with a strong search |
| **Lab Tests Online (now under ADLM)** | Patient-facing explanations of tests, good for the "brief info" tone |

### LIMS / LIS systems with a test-catalogue module
| Product | Notes |
|---|---|
| **SENAITE LIMS** (open source) | Has "Analysis Services" and "Sample Types"; good for studying the data model |
| **OpenELIS Global** (open source) | Used widely in public-health labs in Africa and Asia; includes test management |
| **Epic Beaker / Oracle Health (Cerner) PathNet** | Enterprise hospital LIS with built-in test build |
| **Orchard Harvest LIS, Clinisys, LabWare, LabVantage** | Commercial LIS/LIMS with test-definition modules |

### Where LabDex can win
Commercial systems are **expensive, heavy, and ugly**. Public directories only show a reference lab's *own* tests. LabDex can be a **lightweight, beautiful, self-hosted directory for any lab**, especially small and mid-size hospital labs and private labs that today rely on Excel.

---

## 12. Screens Checklist

- [ ] Login
- [ ] Home / Search
- [ ] Test list (grid and table views, filters)
- [ ] Test detail
- [ ] Create / Edit test (multi-step and live preview)
- [ ] Archive / Restore confirmation
- [ ] Version history and diff
- [ ] Lookup management (containers, sample types, departments)
- [ ] Import wizard (CSV/XLSX with column mapping)
- [ ] Collection Planner (v2)
- [ ] User and role management
- [ ] Settings (lab name, logo, units, theme)

---

## 13. Roadmap

| Phase | Scope | Rough effort |
|---|---|---|
| **0. Design** | Brand tokens, Figma/HTML mockups of 4 key screens | 3–5 days |
| **1. MVP** | CRUD, search, filters, lookups, auth, CSV import/export | 2–3 weeks |
| **2. Quality** | Audit log, versions, approval workflow, review reminders | 1–2 weeks |
| **3. Delight** | Collection Planner, PDF handbook, QR codes, PWA offline | 2 weeks |
| **4. Integrate** | LOINC, FHIR export, public embed, multi-site | Ongoing |

---

## 14. Open Questions to Decide Before Coding

1. **Who uses it?** One lab internally, or a public menu as well?
2. **Where does it run?** Cloud-hosted web app, or a local/offline desktop install?
3. **Multi-tube tests?** Can one test need more than one container? (Recommendation: yes, model it as many-to-many.)
4. **Preferred backend language:** JavaScript/TypeScript or Python?
5. **Existing data:** is there an Excel sheet of current tests to import on day one?
6. **Accreditation:** does the lab follow ISO 15189 / CAP, so that audit and versioning must be in the MVP?
7. **Region and units:** SI units (mmol/L) or conventional (mg/dL)? British or American spelling?

---

## 15. Disclaimer

LabDex stores *lab-defined* information. It is not a clinical decision tool. All specimen requirements, stability data, and TATs must be validated and approved by the laboratory's own qualified staff before being published.
