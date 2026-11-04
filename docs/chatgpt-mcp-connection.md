# ChatGPT MCP 연결 안내

2026-11-04 KST. ChatGPT 계정을 홈페이지 로그인 수단으로 추가하는 기능이 아니다.
ChatGPT에서 기존 꽁보다 MCP 서버에 연결하고 Google 로그인으로 승인하는 방식이다.
Claude와 같은 주소·같은 OAuth 경로를 쓴다.

## 사용할 수 있는 계정

- ChatGPT **웹**에서 설정한다. 사용자 지정 MCP 연결은 Plus·Pro·Business·Enterprise·Edu에서
  쓸 수 있고 Free에서는 쓸 수 없다.
- Business·Enterprise·Edu 워크스페이스는 소유자·관리자가 개발자 모드와 사용자 지정 앱을
  먼저 허용해야 한다. 허용되지 않았다면 개인 계정으로 전환해 연결한다.

## 사용자 설정

1. ChatGPT 웹에서 [Plugins](https://chatgpt.com/plugins)를 열고 **사용자 지정 MCP 서버 추가**를 누른다.
   메뉴가 보이지 않으면 설정 → 앱(커넥터) → 고급 설정에서 **개발자 모드**를 켠 뒤
   **만들기**를 누른다. 메뉴 이름은 ChatGPT 업데이트에 따라 바뀔 수 있다.
2. 이름은 `Kongboda Motorsports`, MCP 서버 주소는
   `https://kongboda-motorsports.vercel.app/mcp`로 입력한다.
3. 인증은 **OAuth**를 고른다. 클라이언트 ID·시크릿은 비워 둔다. 서버가 동적 등록(DCR)과
   PKCE(S256)를 지원하므로 별도 키나 고정 토큰이 필요 없다.
4. **연결**을 누르면 꽁보다의 Google 로그인 화면이 열린다. 사이트에서 쓰는 것과 같은
   Google 계정으로 로그인하고 연결을 승인한다. 이 단계에서 OpenAI 로그인 화면이 열리면
   잘못된 경로다(아래 문제 해결 참고).
5. 새 대화에서 **+** 메뉴의 개발자 모드(또는 앱 목록)에서 Kongboda Motorsports를 켜고
   “꽁보다로 이번 주 F1 일정 알려줘”처럼 질문해 도구 호출을 확인한다. 라이브 자료가 없으면
   그 상태가 표시돼야 하며, 앱 표시 성공을 현재 세션의 라이브 수신 성공으로 해석하지 않는다.

연결 해제는 ChatGPT의 앱(커넥터) 설정에서 한다. 계정 설정의 ‘AI 연결 상태’는 최근 30일 안의
사용 기록을 보여 주며 해제가 바로 반영되지 않을 수 있다.

## 문제 해결

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| OpenAI 화면에 `Authentication Error`, `3p_login_account_type_policy_check_failed` | OpenAI가 이 계정 유형의 외부 앱 로그인을 막음. 주로 Business·Enterprise·Edu 워크스페이스 정책이며 꽁보다 서버까지 요청이 오지 않는다. | 계정 메뉴에서 개인 계정으로 전환해 다시 연결하거나, 워크스페이스 관리자에게 사용자 지정 앱 허용을 요청한다. 예전 `chatgpt.site` 링크가 아니라 위 1단계 경로로 시작했는지 확인한다. |
| 사용자 지정 MCP 메뉴가 없음 | Free 플랜이거나 개발자 모드가 꺼짐, 또는 모바일 앱 | 웹에서 유료 플랜으로 개발자 모드를 켠다. |
| `redirect_uri is not registered` | 연결 도중 클라이언트 정보가 바뀜 | 앱을 삭제하고 1단계부터 다시 만든다. |
| 연결은 됐지만 도구가 없음 | 대화에서 앱이 꺼져 있음 | **+** 메뉴에서 Kongboda Motorsports를 켠다. |
| 연결은 됐지만 계정 설정을 못 가져옴 | 도구가 많아 ChatGPT가 목록 뒤쪽의 계정 도구를 놓침(2026-11-04 수정: 계정·라이브 도구를 목록 맨 앞으로 이동) | 새 대화를 열어 다시 시도한다. 그래도 안 되면 앱 설정에서 새로고침하거나 앱을 다시 연결한다. |
| 도구 결과에 `API key is not configured` | 운영 서버에 Hyprace용 `RAPIDAPI_KEY`가 없어 F1 기록 도구 42개가 동작하지 않음(2026-11-04 수정: 키가 없으면 이 도구들을 목록에서 숨기고 FastF1·FIA·Al Kamel 도구로 안내) | 새 대화에서 다시 질문한다. Hyprace 기록이 필요하면 운영자가 Vercel에 `RAPIDAPI_KEY`를 등록한다. |
| 1시간쯤 뒤 다시 로그인하라고 함 | ChatGPT가 `offline_access`를 요청하지 않아 갱신 토큰이 없었음(2026-11-04 수정: 항상 발급) | 앱을 한 번 다시 연결한다. |

## 서버 측 확인 사항

- OAuth 콜백은 `chatgpt.com`·`openai.com`·`claude.ai`·`claude.com`의 HTTPS 주소만 허용한다
  (`server/mcp-oauth.js`의 `CLIENT_REDIRECT_HOSTS`).
- 익명 `GET /mcp`는 HTTP 401과 OAuth resource metadata 안내를 반환한다. `tools/list`는 로그인 없이도 도구 목록을 주며,
  `tools/call`에는 OAuth 토큰이 필요하다. 목록 순서는 계정·라이브·공식 문서 도구가 먼저, Hyprace 기록 도구가 마지막이다.
- 실제 ChatGPT 계정의 연결 완료는 사용자가 직접 확인해야 한다. 운영 인증 우회나 권한 변경은 하지 않는다.

## 공식 참고 자료

- [ChatGPT 개발자 모드와 MCP 앱 안내](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)
- [OpenAI 앱 인증 안내](https://developers.openai.com/plugins/build/auth)
- [Claude 연결 안내](claude-mcp-connection.md)
