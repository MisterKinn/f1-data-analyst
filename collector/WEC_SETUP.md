# WEC live-page discovery

This implementation follows the FIAWEC+ UI: sign in with the existing Render secret values, discover an event from `/en`, open the current year's live session card, activate its Live Timing link/button, follow the resulting page/popup/frame, and extract an observed timing URL and a recognisable timing table. It does not invent provider API endpoints or export authentication cookies, passwords, signed links, video or account-page contents.

## Verified and pending

On 2026-10-29 the developer browser successfully authenticated through FIAWEC+ → Staylive email → password → FIAWEC+. Monza's authenticated page contained 2023 replay cards but no current 2026 sessions. Barcelona's authenticated 2026 replay had no live-timing button. These are manual observations, **not proof that the new Render browser code has run successfully**.

Automated tests cover the navigation sequence through an injected driver, past/replay rejection, selection ambiguity, URL restrictions, private-link suppression, timing-table filtering, authenticated collector endpoints and deduplicated jobs. Actual session-time button labels, timing destination, provider session status and table schema still require verification. Until that verification, every result is `live: false`, including changing tables. Do not remove this gate solely because authentication or link discovery succeeds.

## Existing Render service

Target only `srv-dbehk51srm7s73c64h0g` (`hyprace-fastf1-collector`). Its runtime repository is `kangjeongmin1229/hyprace-fastf1-collector`, distinct from the canonical application repository. After review, mirror `cloud.py`, `wec_browser.py`, `wec_runtime.py`, `requirements-wec.txt`, `render-build.sh` and WEC tests from this directory, preserving the existing F1 files and secrets.

Use `bash render-build.sh` as the service build command. Keep `python cloud.py serve` as the start command. The build installs Playwright plus its matching Chromium headless shell and checks browser launch **before deployment**. If the native Render image lacks OS libraries, the build fails rather than breaking the F1 runtime; inspect this before deciding on a supported runtime change. No new service, paid plan, credential replacement or access-policy change is included.

Use existing `WEC_USERNAME` (or `WEC_EMAIL` / `FIAWEC_USERNAME`) and `WEC_PASSWORD` (or `FIAWEC_PASSWORD`) server environment variables. Never put their values in GitHub, a Site, a URL, logs or chat. Browser cookies stay in memory and are destroyed when the bounded job exits. F1 credentials and `COLLECTOR_READ_KEY` stay unchanged.

## Requests and results

- Authenticated `POST /wec/discover`: JSON `{ "event": "Monza", "year": 2026, "session": "FP1" }`. Allowed sessions: auto, FP1, FP2, FP3, Qualifying, Hyperpole, Race. Event is an English name fragment, not a URL.
- Authenticated `GET /wec/snapshot`: last safe result; does not log in or start a job.
- Shared MCP tools `wec_discover_live` and `wec_live_status` use the existing collector URL/key. The WEC page offers separate start/status buttons. Existing visitor authentication is preserved.
- One job at a time, 110-second execution deadline, 60-second duplicate-request suppression. No repository polling or new scheduled automation. Authentication/MFA/CAPTCHA/subscription failures stop further sign-in attempts until operator intervention/restart. Human verification is never bypassed.
- Public result stages distinguish waiting, authentication, missing browser runtime, missing timing link, unapproved destination, unsupported table and unverified snapshot. Signed timing links are withheld, not altered into broken public links; the safe session page remains the user entrypoint.

## Session-time acceptance

At an actual FP1/FP2/FP3/qualifying/hyperpole/race session, verify the card's current year/event/session and live badge, capture the actual timing control and final approved host, confirm the session identity/status from the provider, and observe increasing current feed timestamps. Only then implement/enable the exact provider-specific `live` check. A stale replay, generic page clock, login success, or nonempty table is insufficient. If a new timing host is observed, review it explicitly before adding it to the narrowly scoped allowlist.

Deployment of this branch and the Render mirror is not implied by these instructions. Check their actual commit/deploy status separately.

## Existing Render commands (2026-10-29)

The existing `pip install -r requirements.txt` build command now includes pinned Playwright. `python cloud.py serve` explicitly prepares the matching Chromium headless shell once when missing and verifies launch before serving traffic. It does not authenticate to FIAWEC+ during setup. A 300-second download limit and 30-second launch limit fail the new rollout on error; no system packages, access policies or secrets are changed. The existing optional `bash render-build.sh` can still preinstall it at build time. `/healthz` exposes only browser readiness and Render source SHA, never account credentials. Actual live-session reception remains separately unverified.
