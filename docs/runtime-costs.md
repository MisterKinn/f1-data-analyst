# Runtime cost boundaries

## Implementation, 2026-11-25

- Ordinary Firestore object replacement uses `set()` without a preliminary document read. ETag preconditions and multi-document account transactions retain their original transaction semantics. This is cost reduction, **not a spending cap**.
- Vercel request diagnostic persistence defaults to a random 2% sample. `REQUEST_DIAGNOSTICS_SAMPLE_RATE` accepts 0 (off) or 0.01–0.05; other values fall back to 0.02. Records include `sample_rate`. These records are observations, not an exhaustive audit log or a request counter. Collector-uploaded diagnostic histories are unchanged.
- Simulator first-view descriptors and lookup results have a 128-entry limit. Concurrent requests for the same stored view share one fetch. Views expire after one hour, misses after one minute. HTML caching retains its text-size limit. Caches are per warm instance, not shared across Vercel instances. Physics, model inputs, stored-view keys and calibration data are unchanged.
- Build generates 191 explicitly public assets under `dist/public`; the server bundle and hosting metadata stay outside that directory. `vercel.json` uses this directory. Static hits should bypass the function; dynamic aliases still use the existing renderer but skip Firebase initialization. Browser cache age is 300 seconds for general assets and one day for fonts. Existing version query strings remain intact.
- Authentication, HTTP transport, MCP dispatch, website composition and simulator preparation now have separate modules. Account identity, request diagnostics and published-cache operations have purpose-scoped storage adapters; existing document keys and collections are retained. This is a logical boundary, not a physical migration or a complete replacement of every bucket call.

Vercel documents filesystem matching before rewrites in its [routing configuration](https://vercel.com/docs/project-configuration/vercel-ts). Actual hosted behavior still requires Preview verification, particularly Firebase auth rewrites, content types, cache headers and missing assets.

## Reproduce verification

Use Node 22 and install dependencies in this checkout and an unchanged baseline checkout of `4e60d9fac17ab01b62afae0a5781f578e85e4a09`.

```sh
KONGBODA_FEATURES=all node --test tests/*.test.mjs
node --test tests/features-off.test.mjs
REFACTOR_BASELINE_ROOT=/path/to/baseline KONGBODA_FEATURES=all node --test tests/refactor-equivalence.test.mjs
node scripts/benchmark-runtime-cache.mjs /path/to/baseline
npm run build
npm run validate
git diff --check
node scripts/verify-runtime-browser.mjs http://localhost:5182 http://localhost:5181
node scripts/verify-hosted-runtime.mjs https://your-deployment.vercel.app
```

The direct comparison covers 36 public/personal page responses, 191 assets and six MCP protocol responses (status, headers and body bytes). Separate simulator tests compare cached and uncached HTML, invalid inputs, language, evolution and race variants; 20 concurrent requests require one preparation and one fetch. Tests cover conditional writes, authentication, OAuth and account isolation. This evidence does not prove all possible inputs or an actual Google browser login on Vercel.

Browser scripts accept `CHROMIUM_EXECUTABLE` and save reports under ignored `.cache/refactor/` (`BROWSER_REPORT_DIR` overrides the report directory). For protected Preview, `BROWSER_COOKIE_JAR` can point to a local Netscape cookie jar obtained through the authorized Vercel CLI. Never commit or share that file. `EXPECT_PREVIEW_AUTH_BLOCK=1` permits only the known Firebase `auth/unauthorized-domain` Preview restriction; never use that flag for the canonical production check. The hosted check validates all generated asset bytes and MIME types, protected-source 404s, auth proxy, OAuth metadata, MCP initialization and the Google popup entry. It does not submit Google credentials or complete an authenticated session.

Local Node 22 first-view warm-miss benchmark, 200 repeated Monza/Korean requests: before CPU 2130.688 ms / wall 2219.532 ms; after CPU 0.206 ms / wall 0.216 ms; one fetch in each case. This isolates descriptor preparation and is not a site-wide speedup or a billing forecast. Repeat without other heavy workloads for performance comparisons.

## Public result cache follow-up (2026-11-25)

`cachedPublished` now shares the storage read as well as the upstream load for
concurrent requests with the same storage binding, key and freshness policy.
Warm instances retain up to 64 serialized records / 4 MiB (not a process heap
limit), with an 840,000-byte per-record limit. The existing five-minute TTL is
unchanged; independent instances do not share memory. Out-of-band public data
changes may take that TTL to appear. Account data is never cached here.

During a storage outage, verified in-memory data can substitute for the stored
record. Failed upstream refreshes retain the original timestamp and expire at
24 hours, including when that boundary is crossed while waiting for upstream.
Responses are copied so callers cannot mutate another request's cached data.
This is used by `/api/race-results`, not all website or MCP requests.

Reproduce with `node scripts/benchmark-public-cache.mjs /path/to/baseline`
using baseline `170670e` (or unchanged cache module at `40e4032`). With a
synthetic 5ms storage read, 100 warm calls required 100 → 0 storage reads;
20 simultaneous cold calls required 20 → 1. These are deterministic operation
counts, not measured production bills or a guarantee of lower latency on every
request. The cache still needs a storage read on cold starts and TTL expiry.

## Remaining work, in order

1. Deployment is authorized after regression and browser verification. Check Preview static content types/cache headers, auth rewrites and MCP before merging. After Production, compare Firestore reads/writes and Vercel CPU over equivalent traffic windows. Real Google sign-in/logout needs an authenticated user; unauthenticated browser entry is not equivalent to completing login.
2. Public page / account data split: currently retains fresh account reads and personalized server HTML. Design a separate private account endpoint and loading behavior before changing it. Never put personalized HTML in a public CDN cache or weaken revocation/deletion checks to save reads.
3. Move purpose adapters toward typed repositories incrementally. Physical collection separation needs a reversible migration and validation plan, not an unannounced schema change.
4. Diagnostic TTL/retention and cost alerts need operator approval. Sampling is not a hard budget limit and historical diagnostics are not deleted by this refactor.
5. Consider byte budgets for stored-view results (currently bounded by count), and generated-file cleanup for incremental builds; fresh CI builds avoid stale build-output files.
6. Existing dependency audit findings and duplicate translation keys in `worker/simulation.js` are outside this change. Address separately without changing physics or mixing dependency upgrades into this refactor.

## Recovery

The original checkout is preserved. Baseline source and the original dirty handoff documents were archived separately; filenames and SHA-256 values are recorded in `notes/runtime-refactor.md`. No credentials are included in the source archive. No database migration or live data deletion was performed. Pre-refactor Production deployment: `dpl_CdrBQQh3MkDaCBPabStGb7zsoXWW`; restore that deployment if a production regression requires rollback. Latest release status is in `notes/progress.md`.
