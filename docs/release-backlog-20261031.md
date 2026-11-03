# Requested release reconciliation — 2026-10-31

## Included in this release

- Scheduled LIVE indicators beside weekly event titles and at the top right of the F1/WEC home cards; subtle animation respects reduced motion. Status refreshes every 15 seconds and on page restoration. These badges describe schedule windows, not timing-feed connectivity.
- Completed session names and start times use muted grey. Explicit end times/durations take priority; standard F1 scheduled windows are labelled schedule-based. Unknown starts do not manufacture a LIVE duration.
- Home copy explicitly tells visitors to install the Kongboda Motorsports plugin in their AI. Korean and English copy updated together.
- Dakar Rally schedule-only support: 9–23 January 2027, verified from https://www.dakar.com/en/ and the organiser's 30 October relocation announcement at https://www.dakar.com/en/news/2027/portugal-and-morocco-to-exceptionally-host-the-49th-edition/208359 . Portugal and Morocco, with the prologue in Portugal. No invented stage starting times.
- Macau GP schedule-only support: existing 19–22 November 2026 meeting retained and reconfirmed against https://www.macau.grandprix.gov.mo/en/ (the current 2026 site data). Official series identification marks now exist for both Macau and Dakar, served locally and rendered white. Only races in the visitor's current week are displayed; neither is advertised as post-race analysis support.
- Giorgio Piola added to Useful Websites and shared technical/update analysis policy. Retrieve and cite actual public illustrations/articles, separate observed shape from official confirmation and interpretation, and cross-check FIA/team evidence and reviewed research. His own website returned HTTP 503 during the check; no inaccessible article is claimed read.

- GTWC Shanghai starts refreshed against the organiser current timetable: Official Practice 10:48 and Bronze 11:55 local (previous snapshot 10:38/11:45).

## Already present and preserved

- Account settings: equal card widths, desktop 24px/mobile 16px vertical gaps, consistent deletion control, small key registration disclosure below deletion, authorized crew name list.
- Official ChatGPT plugin preserved; generic external MCP tokens disabled and unsupported Claude connection is not advertised. Google website code remains configuration-gated. No authentication bypass is introduced.
- Approved mint branding, local Formula E identification asset, desktop example alignment rules, independent telemetry panels, brake/delta height matching, and Mexico sector-colour map implementation retained.
- FIA/tyre/research source policy and per-account instructions retained. GitHub runs tests/build only; automatic deployment notifications remain disabled.

## Still explicitly deferred or externally unverifiable

- The owner said personal F1/FIAWEC+ collection for non-crew users is for later; this release does not implement or advertise it.
- Google-mandatory MCP/Claude authentication requires supported platform integration and owner OAuth configuration. Later instructions keep generic external connections disabled. Do not re-enable this older request through an unsafe generic bearer endpoint.
- Verified Coupang Play broadcast start times are unavailable; official session start times must not be relabelled as broadcast times.
- Actual provider login, iOS plugin reconnect, live session reception and WEC session discovery must be verified separately from tests and publication. No production credentials, collector infrastructure or storage bindings are changed.


## Follow-up release — 2026-10-31

- PC weekly schedule: practice sessions on the left, qualifying/race on the right; compact time/name gaps. Horizontal navigation for more than three cards. F1 then WEC, followed by editorial priority IMSA, Formula E, ELMS, NLS, Asian Le Mans, Le Mans Cup; this is not claimed as an audience measurement. Schedule-only series follow supported analysis series. Mobile layout retained.
- Remove visible repeated championship names beneath post-analysis logos; retain accessible names.
- Red, larger scheduled LIVE badges. All-championship answer policy adds long-run line charts, qualifying telemetry charts when actual channels are available, approximately half-length prose, young-driver FP1 program caution, and commentary as a timestamped supplementary source when received.
- Ended-session silence does not establish missing commentary support. Live commentary and telemetry reception require next active-session verification; no unsupported measurements or commentary are fabricated.

- Home install phrase is an underlined /guide link; home promotion removed. “당신 곁의 레이스 엔지니어” moves to the guide h1. Mexico calendar retains its sector map and adds an SM/OT map switch using the exact FIA Document 7 p2 map crop. No duplicate textual zone list.
- Default FIA/Pirelli/F1 Strategy Guide notification scheduler: use the audited 2026 FIA publication sample (19 GP archives, 1,384 documents; 1,319 published on venue-local Thursday–Sunday) instead of a full-day Thursday–Sunday window. For each GP, resolve the official venue IANA timezone and session timetable; wake hourly from three hours before the first official activity through three hours after the last session, widened to include the venue's historical 1st–99th publication-time percentiles. The current daytime Mexico profile is 08:00–21:00 local; night events such as Singapore may cross midnight. Update the schedule when the GP changes, apply DST, and never keep a 24-hour or hourly no-op poll outside the evidence-based active window.
- Discord parity review: the current owner-only Python bot is a separate five-command client (/live, /schedule, /standings, /ask, /status), not a proxy for the 48-tool Kongboda Motorsports plugin. Before advertising “nearly the same as the plugin,” route Discord commands through a shared tool/source adapter so FIA pagination and PDF reading, F1/WEC archives, research evidence, live freshness checks, authentication, citations and deduplication follow the plugin's canonical behavior. Keep Discord message-length and attachment constraints explicit.
- Discord deployment prerequisites: register DISCORD_TOKEN, DISCORD_OWNER_ID, optional DISCORD_GUILD_ID/DISCORD_ALERT_CHANNEL_ID, COLLECTOR_URL and COLLECTOR_READ_KEY only as host secrets; ANTHROPIC_API_KEY remains optional. Never commit values. The gateway bot requires an always-on process and durable state; a sleeping free web service is insufficient for reliable slash commands and alerts. Verify an actual Discord connection, command sync, owner restriction, alert delivery and restart deduplication before marking deployment complete.
