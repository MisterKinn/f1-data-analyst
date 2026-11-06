# Personal F1 sessions and crew access

Registered crew (current access-key revision) and the configured owner continue
using the existing shared F1 collector. Other authenticated Kongboda accounts use
an account-scoped collector and storage namespace. Missing key configuration does
not grant shared F1 access. WEC behavior is unchanged.

Account settings links to `/live`. Non-crew users enter their own F1 credentials
there; the server forwards them over TLS to the configured collector. Passwords
are not stored in Firestore or returned in responses. A private subprocess keeps
its own environment, temporary home, token cache, timing and telemetry files.
The child listens only on loopback with a separate random internal key. Owner
credentials, WEC credentials and callback settings are not inherited.

Sessions expire after eight hours or collector restart. Logout terminates the
private process group and removes its temporary files and saved account timing.
Account deletion first terminates any recorded personal session. If the collector
cannot confirm termination, deletion asks the user to retry rather than hiding a
still-running session. Provider login and subscription checks use the existing
FastF1 password authentication path; provider rejection is a failure,
not a reason to use owner credentials.

The default maximum is two simultaneous personal sessions. Operators may set
`PERSONAL_F1_MAX_SESSIONS` (1–16) after reviewing host capacity. Login attempts are
limited to five per account per 15 minutes in the running collector. No new
infrastructure, subscriptions or paid capacity is provisioned by this change.

Deploy both the Node website and the existing replacement Python collector.
The collector image must include `personal.py`. Vercel alone does not run Python.
Do not restart the retired Render service. Verify a real personal login, fresh
source timestamps and independent crew/private stop behavior before declaring
production ready. Local mocked tests do not establish provider login success.

Local validation (2026-11-03): Node 24 runtime, 122 Node tests; 80 Python collector
tests; website build and artifact validation pass. CI still needs its Node 22
contract checked. No real F1 credentials or production configuration were changed.
