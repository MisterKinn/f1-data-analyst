# Rules and race-document index

`rules_lookup` answers regulation, procedure and race-director questions from a pre-built index, so no PDF is downloaded while answering.

## How it stays current

- `.github/workflows/rules-monitor.yml` runs every 15 minutes, but the script (`scripts/rules-monitor.mjs`) only checks a source when it is due:
  - Race-event documents: every 15 min during that series' race weekend (calendar window: 4 days before to 2 days after), otherwise every 12 h.
  - Regulations: every 6 h on race weekends, otherwise daily.
- Change detection: listing date, then ETag/Last-Modified, then a SHA-256 of the file. Unchanged files are not parsed again.
- New or changed PDFs are parsed in the Action (`unpdf`) into articles (number, heading, page, short excerpt, keywords) and posted to `/api/rules/ingest`, authenticated by the workflow's GitHub OIDC token. No shared secret.
- Every issue is kept. Lookups use the issue valid on `as_of` and report a newer issue if one exists.
- A parse that yields almost nothing (fewer than 3 articles from more than 5 pages) is held, not stored, so a bad parse never replaces a good index.
- Each source's last check, last success and error are stored and returned with every hit, so stale or failed sources are visible in answers.

## Limits per run

At most 60 downloads and 25 minutes per run (env `RULES_MAX_DOWNLOADS`, `RULES_MAX_MINUTES`); remaining work continues on the next run. Requests to one host are spaced 1.5 s apart and carry a descriptive User-Agent.

## Sources

`knowledge/rules-sources.json` lists the public sources. JS noticeboards are read through the data behind them, so no headless browser runs in the Action:

- `official_archive`: Formula E results archive (only "Event Information" folders), ELMS / Le Mans Cup (Al Kamel season and event selects) and ALMS (Al Kamel JSON manifests). Uses the connector's own `worker/official.js` reader. Newest season, newest 2 events.
- `gtapps_noticeboard`: BTCC/TOCA on GT Apps Race Control. Reads the public `/documents` JSON. Bulletins, decisions and official documents only; classifications and grids are skipped.
- `embedded_pdf_urls`: PDF URLs inside page data (Supercars' Next.js page). Operations Manual divisions become regulations; supplementary regulations become event documents.
- `fia_event_documents` with `discover`: finds the fia.com championship id (Formula E decisions) from the championship menu instead of hardcoding it.

Tier-3 sources are marked unavailable. Full historical crawling is not planned; only the current and next rulebook year are indexed.

## Rights

Only short excerpts and keywords are stored for search, with links to the official files. Full texts are not committed to this public repository or republished.

## Manual run

Actions → "Rules and race-document monitor" → Run workflow (optional `source` id, `force`). Local dry run: `node scripts/rules-monitor.mjs --dry-run --source=f1-regs`.
