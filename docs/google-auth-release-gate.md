# Google authentication release gate

Owner requirement (2026-10-29): Google sign-in is mandatory for both website identity and MCP connections; support ChatGPT and Claude against the same account. Tokens for this service must be separate from Google tokens, scoped, expiring and revocable.

Website Google OIDC is active on Vercel through Firebase session verification. The Vercel MCP authorization server uses that verified Google identity for OAuth consent and account linking. Existing Sites-managed ChatGPT and MCP authentication remain unchanged. A plain website session still grants no MCP, owner, collector or live-data permission; the OAuth server must separately issue a scoped, audience-bound token.

Website activation:
- Firebase Google sign-in and its authorized Vercel domain are configured outside source control; credentials remain in Vercel environment settings.
- The server verifies the Firebase session cookie and provider subject before creating website identity. Google/Firebase tokens are not stored as MCP bearer credentials or forwarded to MCP tools.
- OAuth authorization requests require PKCE S256, exact registered redirects, CSRF-protected consent and the canonical Vercel resource audience. Authorization codes are single-use and short-lived.
- Perform real browser success/cancel/logout validation after every authentication or domain configuration change. Automated tests are not evidence of a real Google login.

Remaining release gates:
- Deploy the Vercel OAuth routes and verify discovery, dynamic registration, unauthenticated challenge and Google authorization redirect on the production origin.
- Complete one real ChatGPT custom MCP sign-in and read-only tool call. Repeat in Claude before claiming Claude support.
- Do not silently use a shared API token or pass Google/Firebase ID tokens to the MCP resource server.

Required next steps:
1. Deploy and run the production endpoint smoke checks above.
2. Browser-test Google success/cancel/logout and expired/revoked tokens through a real ChatGPT connection.
3. Verify ChatGPT and Claude can invoke a real read-only tool before advertising each host as supported.

Official references:
- https://developers.google.com/identity/openid-connect/openid-connect
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://developers.openai.com/plugins/build/auth
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
