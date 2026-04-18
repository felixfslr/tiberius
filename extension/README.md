# Tiberius Reply — Chrome Extension

Adds a "Draft with Tiberius" button to Gmail compose windows. The button
scrapes the open thread, calls `POST /api/v1/agents/{id}/reply`, and inserts
the agent's draft into the compose box.

## Install (development, unpacked)

```bash
cd extension
npm install
npm run build          # or: npm run dev  (watch mode)
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** → select `extension/dist`.
4. Click the toolbar icon (or right-click → Options) to open settings.

## Configure

In the options page, fill in:

- **API base URL** — `https://tiberius-nu.vercel.app` (prod) or `http://localhost:3007` (dev).
- **Agent ID** — UUID from your agent's dashboard (`/agents/<id>`).
- **API key** — generate at `/agents/<id>/api-keys`. Key is pinned to that one agent.
- **Behavior**:
  - *Insert directly* — auto-insert the draft; modal only appears if the agent returns `below_threshold`.
  - *Always preview* — modal opens every time so you can edit before inserting.

Click **Test connection** — green means the API key is valid.

## Use

1. Open a Gmail thread, click Reply (or Forward / New).
2. A **Draft with Tiberius** button appears in the compose toolbar.
3. Click it. The draft appears in the compose box (auto-insert mode) or in a preview modal.
4. In the modal: edit, **Regenerate** for a fresh draft, or **Insert** to commit to the compose box.

## Dev loop

- `npm run dev` produces `dist/` and rebuilds on save.
- Content-script changes: reload the Gmail tab.
- Background-worker / manifest changes: click the reload icon on the extension card in `chrome://extensions`.
- Inspect logs: extension card → **service worker** → "Inspect views" for background; Gmail tab DevTools for content script.

## Known limitations (v1)

- Gmail DOM selectors are pinned to current Gmail layout. If a button stops appearing, the selectors in `src/content/gmail-dom.ts` likely need a fix.
- Forwarded/quoted text is stripped from scraped messages; reply quality on heavily-forwarded threads may be lower.
- `suggested_tool` (Calendly link / attach document) is surfaced in the preview reasoning but not as actionable UI in this version.
- API key is stored in `chrome.storage.sync`, so it syncs to your other Chrome profiles signed into the same Google account.

## Load localhost

For the extension to call `http://localhost:3007`, make sure `npm run dev` (in the Tiberius repo root) is running. The manifest already declares the host permission.
