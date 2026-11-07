# Brazil FP1 latency and CPU test

## Scope and readiness

Production source: `MisterKinn/f1-data-analyst`, deployed through the existing
Vercel Git integration. Do not change that integration or operate the retired
Render collector. The Node Vercel entry point serves the website/API; it does
not execute the Python collector. Collector measurements require the updated
collector process actually to run and feed the configured snapshot endpoint.
If no replacement producer exists, report **collector unavailable**. Do not call
the system ready merely because the website deployment succeeded.

The current official timetable lists FP1 on 6 November 2026, 12:30–13:30 São Paulo
time (UTC−03:00), or 7 November **00:30–01:30 KST**. Recheck before the test:

- https://www.formula1.com/en/racing/2026/brazil
- https://f1saopaulo.com.br/en/schedule/

## Implemented checks

- Live requires a current non-initial Heartbeat or ExtrapolatedClock source
  timestamp **and** current non-initial TimingData. Receipt/generated timestamps
  alone cannot turn replayed data into live timing. The limit is 45 seconds,
  allowing at most 10 seconds of future clock skew. Field-specific freshness
  still needs inspection before using a particular driver value.
- The Discord summary applies the same source-clock and active-session gate;
  cached `feed_age_seconds` alone cannot produce a green live label there.
- Older cloud snapshots cannot replace newer stored snapshots. Conditional
  writes retry concurrent updates, including the session archive.
- Out-of-order topic patches cannot roll current state backward or refresh its
  last-message clock. Already received raw files remain separate evidence.
- Owned rolling state is updated without copying the whole previous tree per
  patch. High-frequency batches are not copied again for the lap archiver.
- SQLite uses WAL and batches commits for up to one second between packet
  writes. Snapshot creation flushes pending rows; a crash can lose the pending
  transaction. Completed lap preservation and 300-second telemetry expiry remain.
- Read-only SQLite telemetry queries close their connections explicitly.
- Collector packaging includes the imported recovery, history and diagnostic
  modules. The downloadable PC bundle includes the recorder as well.

## Measurements and persistence

The collector samples every 10 seconds independently of snapshot polling:

- Process CPU as a percentage of one core (100% = one core, not the host).
- cgroup v2 usage relative to the exposed CPU quota and throttled seconds per
  interval; null when unavailable. The cgroup can include other processes.
- RSS, callback count, mean/max callback duration and the source-to-callback lag
  of the last timing and clock messages. Zero callbacks is a reception gap, not
  proof that the last source timestamp remains current.
- Out-of-order packets, telemetry write errors and diagnostic write errors.

Credential-free rows append to `DATA_DIR/diagnostics/<session>-<run>.jsonl`.
The full local file lasts for the host filesystem's lifetime. Uploaded snapshots
carry the latest 720 samples (two hours, sufficient for FP1). Successful snapshot
synchronization also stores this history separately in the website bucket;
telemetry expiry does not delete it. No synchronization means no remote copy.
Diagnostic persistence failure is reported without blocking timing storage.

Vercel additionally stores process CPU/wall/RSS measurements during authenticated
live/MCP requests in Firestore through the existing bucket. These include work
from concurrent requests sharing the process and omit idle periods. They are
**not** collector CPU or whole-host saturation. No request bodies, query strings,
account identifiers, cookies, credentials or timing packet bodies are recorded.

Read history through the authenticated `f1_live_diagnostics` MCP tool:

- Collector: `session_key` from verified SessionInfo; optional `run_id` for a
  prior run. Histories remain separate across reconnects.
- Vercel: `scope="vercel"`, UTC `date="2026-11-06"`; follow `next_cursor`.
- Website equivalent: GET `/api/live/diagnostics` with the same parameters and
  the existing login/crew checks. This endpoint does not start collection.

## Bounded FP1 test

1. Before FP1, verify the GitHub commit's CI and Vercel status. Confirm the
   running producer reports the updated code and its automatic session schedule.
2. Confirm Sao Paulo/Brazil Practice 1 identity, official session key and date;
   never infer it from a recently received Mexico snapshot. If unavailable, stop
   and report the missing producer/authentication/deployment requirement.
3. During FP1, synchronize snapshots about every 20–30 seconds. Keep the scope to
   FP1; stop after its terminal status or 01:35 KST, subject to schedule changes.
4. Record source ages, sequence progression, parse errors and driver count;
   archive collector and Vercel histories before finishing.
5. Report p50/p95/max source lag, callback durations, process CPU, quota usage and
   throttling alongside gaps/reconnects. Target source lag <=5 seconds is an
   experiment target, not a guaranteed upstream SLA. The 45-second live gate is
   a stale-data safety boundary, not an acceptable latency target.

Interpretation: high per-core CPU or quota throttling together with slow
callbacks and growing source lag supports a local bottleneck. Low CPU and fast
callbacks while old source timestamps arrive supports delayed upstream delivery
or replay, but cannot by itself prove which upstream mechanism is responsible.
The SignalR library has already parsed a message before the callback begins;
these measurements do not expose an exact socket queue depth. Missing metrics
must remain unknown. Historical Mexico CPU cannot be reconstructed from receipt
timestamps or synthetic tests.
