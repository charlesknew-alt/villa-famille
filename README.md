# The Family House

A simple family portal for a holiday house near **La Croix-Valmer** (Var, Gulf of Saint-Tropez).

No cloud database. No Supabase. No Google account. Open the site, enter a PIN, use the house.

## How to open this (not the GitHub file list)

The GitHub link is **only the code locker**. It shows source files. It is **not** the live house.

**To use the house:**

1. On GitHub, click **Code → Download ZIP** (or clone the repo).
2. Unzip the folder.
3. Double-click **`index.html`**. It opens in your browser.
4. Enter a PIN.

There is no server on this PC. `index.html` is a website file. A browser opens it. Until the family has a web host, that is how you use the house.

If a double-click does not load the house data, open a terminal in this folder and run `py -m http.server 8080`, then visit http://localhost:8080

## How it runs, and where the calendar lives

**How it runs:** Open `index.html` in a browser (or a web address later). GitHub is not the live house until someone opens that file or hosts it.

**Where data lives:** Bookings, the calendar, people, maintenance, and expenses live in the repo file `data/house.json`. While you use the site, new bookings first save as a **draft in this browser**. Then go to Settings and download `house.json`, and put that file back on GitHub so the family at home sees the same calendar. Spreadsheet copies are in `data/csv/`.

## Demo PINs (family setup)

| Role   | PIN    | Name        |
|--------|--------|-------------|
| Admin  | 077881 | House Admin |
| Family | 246810 | Claire      |
| Guest  | 135790 | Guest       |

New people tap **Create your PIN** on the login screen (name, surname, 6-digit PIN). They do not get in yet. The house admin approves or declines the request in **Settings → Approvals**. Same first + last name cannot request twice.

PINs are stored as **SHA-256 + salt** in `data/house.json`. Raw PINs are never saved.

## What is in the app

- **Calendar** — the main feature. Green = free, blue = booked, red = blocked. Gold **H** = school holiday. Month / week / list. Add, edit, cancel stays. Conflict checks (same-day checkout / check-in is allowed). Who is at the house. Booking form shows a rough BA/easyJet travel cost.
- **Maintenance** — report with photos/video, priorities, categories, contractor, comments, invoices. Workflow: Reported → Being reviewed → Assigned → In progress → Completed.
- **House** — emergency numbers, shut-offs, site map, inventory, departure checklist, expenses, documents, contractors.
- **Travel** — London (LHR / LGW / STN / LCY) to Nice, Marseille, Toulon. **Guide prices** (not live) preferring British Airways and easyJet. Big buttons open BA, easyJet, Google Flights and Skyscanner with your dates. Drive times to La Croix-Valmer.
- **School holidays** — Seaford College, King Edward’s Woking and Greenfield Woking families have priority in typical 2025–2027 independent-school holidays. Admin can edit the dates in Settings.
- **Local guide** — restaurants, beaches, attractions, shops. Stars, comments, photos, replies.
- **Expenses** — GBP, who paid, receipts, personal vs shared. Shared bills split equally across four owners. Settle up when reimbursed.
- News, ideas, search, dark mode, activity log.

Seed owners for splits: House Admin, Claire, John Smith, Anne. Example: Drainage Repair **£250** paid by John Smith on 10/08/2026 → £62.50 each.

## Where the data lives

All house data is in the repo:

| File | What it is |
|------|------------|
| `data/house.json` | Bookings, people, maintenance, contacts, expenses, inventory, documents… |
| `data/house-data.js` | Same data, so the app still opens from a clone without a server |
| `data/fares.json` | Sample flight prices |
| `data/csv/*.csv` | Spreadsheet copies you can open in Excel or Google Sheets |

**This computer’s browser is not the source of truth.** After you change something in the app, go to **Settings** and **Download house.json** (and CSVs if you like). Replace the files in the repo and push. Optional: paste a GitHub token in Settings to save from the browser.

### Edit as a spreadsheet

1. Open `data/csv/bookings.csv` (or restaurants, contacts, maintenance, expenses) in Excel or Google Sheets.
2. Edit rows. Keep the header names.
3. For a full restore, it is simpler to edit `data/house.json` or use **Restore JSON** in Settings.

Flight prices later: keep using `lib/flights.js` → `getFares()`. Today it reads `data/fares.json`. You can swap that function for an API later without changing the Travel page.

## Sample vs real

Seed data is **sample** (La Croix-Valmer area, fictional contractors, placeholder access notes). Change the JSON before you put real alarm codes or keys in a repo — and keep the repo **private** if it holds real house details.
