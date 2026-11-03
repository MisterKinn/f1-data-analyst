# Claude MCP 연결 확인

2026-11-04 KST. Claude 계정을 홈페이지 로그인 수단으로 추가하는 기능이 아니다.
Claude에서 기존 꽁보다 MCP 서버에 연결하고 Google 로그인으로 승인하는 방식이다.

## 사용자 설정

1. Claude의 Customize → Connectors → Add custom connector를 연다.
2. 이름은 Kongboda Motorsports, 원격 MCP 주소는
   `https://kongboda-motorsports.vercel.app/mcp`로 입력한다.
3. 인증은 OAuth, OAuth client는 **Register automatically**를 선택한다.
   현재 서버는 동적 등록(DCR)을 지원하며, Claude의 published identity(CIMD) URL을
   client ID로 직접 받는 기능은 구현하지 않았다. 별도 client secret이나 고정 키는 필요 없다.
4. 기존 Google 로그인과 꽁보다 연결 승인을 사용자가 직접 완료한다.
5. 대화에서 커넥터를 켜고 `kongboda_my_preferences`를 조회한 뒤
   `kongboda_live_briefing`으로 앱 표시를 확인한다. 라이브 자료가 없으면 해당 상태가
   표시돼야 하며, 앱 표시 성공을 현재 세션의 라이브 수신 성공으로 해석하지 않는다.

Team/Enterprise에서 custom connector 추가가 제한된 경우 조직 소유자가 먼저 등록해야 한다.
연결 해제는 Claude의 Connectors 설정에서 수행한다.

## 이번 확인 결과와 한계

- 운영 공개 OAuth resource metadata와 authorization-server metadata는 HTTP 200이었다.
  등록 주소는 `/oauth/register`, PKCE는 S256으로 안내됐다.
- 익명 `/mcp`는 HTTP 401과 OAuth resource metadata 인증 안내를 반환했다.
- 코드 테스트에서 Claude의 공식 콜백
  `https://claude.ai/api/mcp/auth_callback`을 사용한 DCR → Google 승인 → PKCE 코드 교환
  → bearer 인증 → refresh 회전 → 폐기 경로를 검증했다. 테스트용 메모리 저장소를 사용했다.
- MCP `2025-11-25` 초기화와 `io.modelcontextprotocol/ui` 앱 지원 선언을 보완했다.
  기존 UI resource, 표준 UI bridge, 텍스트 대체 응답은 유지한다.
- 브라우저의 Claude 연결 화면은 로그인이 필요했다. 실제 Claude 계정의 OAuth 완료,
  도구 호출 및 앱 렌더링은 아직 확인하지 못했다. 운영 인증 우회나 권한 변경은 하지 않았다.
- 위 코드 변경의 운영 반영 여부는 GitHub 업로드와 별개다. 이번 작업에서는 Vercel 연결이나
  수동 배포를 하지 않는다.

## 공식 참고 자료

- [Claude 사용자 지정 커넥터 안내](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Claude 커넥터 개발 안내](https://claude.com/docs/connectors/building)
- [MCP Apps 규격](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
