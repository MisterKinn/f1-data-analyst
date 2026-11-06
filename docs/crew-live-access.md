# Shared live timing for registered crew

Registered crew use their own authenticated Kongboda account to read the same shared FastF1 cloud collector. No per-user collector startup, PC upload, F1 password or separate collector configuration is required. ChatGPT MCP resolves the registered site account; website live reads also resolve a verified linked Google session. Unregistered, deleted or outdated crew grants do not authorize shared access. Website cookies do not authenticate MCP.

The collector's automatic schedule remains responsible for session startup. Before describing a feed as current, check synchronization, event/session identity, freshness.live and per-topic timestamps. An old saved snapshot is not a successful live-session verification. Actual Mexico City FP1 reception must be checked during the session.

Users without crew registration connect their own F1 or FIAWEC+ account at /live (personal collector, credentials in memory only, 8 hours). WEC crew access reads the scheduled FIAWEC+ timing reader (.github/workflows/wec-live-collector.yml, operator account). Never treat a site login as an F1/FIAWEC+ login or silently grant shared collector access.
