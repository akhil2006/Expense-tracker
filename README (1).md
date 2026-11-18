# AI-Assisted Expense Tracker

Program 05 · AI Assisted Software Development Lab (BASDLI507)

A React + localStorage expense tracker with categories, monthly analytics (Chart.js) and CSV export.
It is a static site: no install and no build step.

## Features
- Add expenses (amount > 0, category required, date defaults to today, note up to 120 characters)
- Expense table sorted by date (newest first), coloured category tags, delete with confirmation
- Category manager: add, rename/recolour, delete (reassign affected expenses first)
- Data saved in the browser with a `useLocalStorage` hook (JSON, loaded on mount, debounced writes)
- Analytics: monthly total with % change vs last month, category donut chart, 6-month trend chart
- CSV export of all expenses
- "Load sample data" button on the empty screen, useful for screenshots

## Upload to GitHub
1. Create a new repository (for example `expense-tracker`).
2. Add file > Upload files, then drag in `index.html`, `style.css`, `app.js`, `README.md`.
3. Commit changes.

## Deploy on Vercel
1. Sign in at vercel.com with GitHub.
2. Add New > Project, import the repository.
3. Framework Preset: **Other**. Leave build command and output directory empty.
4. Deploy.

## Files
- `index.html`: page shell, loads React, htm and Chart.js from CDNs
- `app.js`: all components and logic, grouped by layer (data model, UI shell, state, persistence, analytics)
- `style.css`: styling
