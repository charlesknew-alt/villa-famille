# The Family House

A simple family portal for a holiday house near **La Croix-Valmer** (Var, Gulf of Saint-Tropez).

No cloud database. No Supabase. No Google account. Open the site, enter a PIN, use the house.

## Use it at home (or anywhere)

This project lives on **GitHub**, not on a work PC.

1. Open the GitHub repo `villa-famille` in your account.
2. Use **GitHub Pages** if it is enabled (Settings → Pages → Deploy from `main` / root).
3. Or clone the repo at home and open `index.html` in a browser.  
   If the house data does not load from a double-click (`file://`), start a tiny local server in this folder:

   ```bash
   py -m http.server 8080
   ```

   Then visit http://localhost:8080

## Demo PINs (family setup)

| Role   | PIN    | Name        |
|--------|--------|-------------|
| Admin  | 123456 | House Admin |
| Family | 246810 | Claire      |
| Guest  | 135790 | Guest       |

PINs are stored as **SHA-256 + salt** in `data/house.json`. Raw PINs are never saved.

## What is in the app

- **Calendar** — the main feature. Green = free, blue = booked, red = blocked. Month / week / list. Add, edit, cancel stays. Conflict checks (same-day checkout / check-in is allowed). Who is at the house.
- **Maintenance** — report with photos/video, priorities, categories, contractor, comments, invoices. Workflow: Reported → Being reviewed → Assigned → In progress → Completed.
- **House** — emergency numbers, shut-offs, site map, inventory, departure checklist, expenses, documents, contractors.
- **Travel** — London (LHR / LGW / STN / LCY) to Nice, Marseille, Toulon. Sample prices, directs, drive times to La Croix-Valmer, links to Google Flights and Skyscanner.
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
