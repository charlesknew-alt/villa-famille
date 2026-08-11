# The Family House

A simple family portal for a holiday house near **La Croix-Valmer** (Var, Gulf of Saint-Tropez).

No cloud database. No Supabase. No Google account. Open the site, enter a PIN, use the house.

## One website, one address

Calendar, flights, PINs, maintenance and the rest are **one site**. The family will use a single web address later (GitHub Pages or a custom domain). This is not several apps.

The live family address is **https://france.directestates.co.uk** (one site). The GitHub repo can stay private; the website at that address is what people open.

DNS: a **CNAME** from `france` → `charlesknew-alt.github.io` on the `directestates.co.uk` domain.

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

## PINs (family setup)

There is one house admin PIN to start. New people tap **Create your PIN** on the login screen (name, surname, 4-digit PIN, and the house verify code). They become a family member at once and are signed in. The same first + last name cannot be registered twice. The house code is not shown on the login screen.

Admin can also **Add person** in Settings. Same name rule. PINs are stored as **SHA-256 + salt** in `data/house.json`. Raw PINs are never saved. The login screen does not list family PINs.

## What is in the app

- **Calendar** — the main feature. Green = free, red = booked. Gold **H** = school holiday. Month / week / list. Add, edit, cancel stays. Conflict checks (same-day checkout / check-in is allowed). Who is at the house. The booking form opens easyJet / BA / Google Flights / Skyscanner for those exact dates.
- **Maintenance** — report with photos/video, priorities, categories, contractor, comments, invoices. Workflow: Reported → Being reviewed → Assigned → In progress → Completed.
- **House** — emergency numbers, shut-offs, site map, inventory, departure checklist, expenses, documents, contractors.
- **Travel** — Skyscanner search is built into the Travel page (and the booking form). Pick dates, search live prices on this site, then compare BA / easyJet / others. Airline buttons are still there if you want the carrier site.
- **School holidays** — Seaford College, King Edward’s Woking and Greenfield Woking families have priority in typical 2025–2027 independent-school holidays. Admin can edit the dates in Settings.
- **Local guide** — real well-known places near La Croix-Valmer and Gigaro. Stars, comments, photos, replies once the family adds them.
- **Expenses** — GBP, who paid, receipts, personal vs shared. Shared bills split equally across the owners list. Settle up when reimbursed.
- Ideas, search, dark mode, activity log.

The house starts empty: no sample stays, bills or made-up people. Add the family with **Create your PIN**.

## Where the data lives

All house data is in the repo:

| File | What it is |
|------|------------|
| `data/house.json` | Bookings, people, maintenance, contacts, expenses, inventory, documents… |
| `data/house-data.js` | Same data, so the app still opens from a clone without a server |
| `data/fares.json` | Airport routes and drive times (not live ticket prices) |
| `data/csv/*.csv` | Spreadsheet copies you can open in Excel or Google Sheets |

**This computer’s browser is not the source of truth.** After you change something in the app, go to **Settings** and **Download house.json** (and CSVs if you like). Replace the files in the repo and push. Optional: paste a GitHub token in Settings to save from the browser.

### Edit as a spreadsheet

1. Open `data/csv/bookings.csv` (or restaurants, contacts, maintenance, expenses) in Excel or Google Sheets.
2. Edit rows. Keep the header names.
3. For a full restore, it is simpler to edit `data/house.json` or use **Restore JSON** in Settings.

Flight prices later: keep using `lib/flights.js` → `getFares()`. Today that only returns live numbers if you add an API key in Settings. The Travel buttons always deep-link to the airlines.

## House notes

Document templates (alarm, bins, lock-up) are blank-ready house instructions. Emergency numbers are the real French / EU ones (15 / 17 / 18 / 112). Contractor slots say “add your plumber” until you fill them in. Keep the repo **private** if it holds real alarm codes or keys.
