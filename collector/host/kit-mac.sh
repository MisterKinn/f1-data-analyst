#!/bin/bash
# 꽁보다 수집기 설치 도우미 (Mac). 터미널에 붙여 넣는 한 줄로 실행된다:
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/kit-mac.sh)" - install
ACTION="${1:-install}"
ROOT="${KONGBODA_ROOT:-$HOME/Library/Application Support/Kongboda}"
RAW="${KONGBODA_RAW_URL:-https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host}"
AGENT="$HOME/Library/LaunchAgents/com.kongboda.collector.plist"
title() { printf '\n==== %s ====\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }

check() {
  if [ ! -x "$ROOT/venv/bin/python" ]; then yellow '수집기가 아직 설치되지 않았습니다. 설치 줄을 먼저 실행하세요.'; return; fi
  cd "$ROOT/collector" || return
  title 'F1 접속 점검'
  local line
  line=$(HOST_ENV_FILE="$ROOT/host.env" XDG_DATA_HOME="$ROOT/data/auth" PROBE=1 "$ROOT/venv/bin/python" host_runner.py 2>/dev/null | grep '^{"event": "probe"' | head -n 1)
  if [ -n "$line" ]; then
    local result
    result=$(printf '%s' "$line" | "$ROOT/venv/bin/python" -c 'import json,sys; p=json.load(sys.stdin); ok=(p.get("negotiate") or {}).get("token",[0])[0]==200 and (p.get("session_info") or {}).get("token",[0])[0]==200; print(("OK" if ok else "NO")+" "+str(p.get("network"))+" / F1 로그인: "+str(p.get("sign_in")))')
    echo "회선: ${result#* }"
    if [ "${result%% *}" = OK ]; then green 'F1 실시간 타이밍 접속: 가능'; else red 'F1 실시간 타이밍 접속: 불가 (VPN·회사·학교망이면 집 인터넷에서 다시 시도하세요)'; fi
  else red 'F1 점검 결과를 읽지 못했습니다. F1 계정·구독(F1 TV Access 이상)을 확인하세요.'; fi
  title '사이트 등록 확인'
  local reg
  reg=$(HOST_ENV_FILE="$ROOT/host.env" "$ROOT/venv/bin/python" -c 'import host_runner as h; h.load_env_file(); r = h.register(); print("REG", r, h.LAST_REGISTRATION.get("link_url", ""))' 2>/dev/null | grep '^REG' | head -n 1)
  case "$reg" in
    'REG needs_link '*)
      local url="${reg#REG needs_link }"
      yellow '마지막 단계: 이 Mac을 내 꽁보다 계정에 연결해야 해요.'
      yellow '곧 인터넷 창이 열려요. 꽁보다에 Google로 로그인하고 "내 계정에 이 컴퓨터 연결" 버튼을 누르세요.'
      echo "창이 안 열리면 이 주소를 인터넷 창에 붙여 넣으세요: $url"
      open "$url" 2>/dev/null || true;;
    'REG approved '*) green '등록됨: 이 Mac이 수집한 자료가 사이트에 올라갑니다.';;
    'REG pending '*) green '계정 연결 완료: 세션 시간이 되면 자동으로 수집합니다.';;
    'REG paused '*) yellow '사이트에서 일시정지된 Mac입니다.';;
    'REG name_taken '*) red '같은 이름의 다른 컴퓨터가 있습니다. 이 화면을 사진 찍어 정민이한테 보내 주세요.';;
    *) red '사이트에 연결하지 못했습니다. 인터넷을 확인하고 다시 해 보세요.';;
  esac
  echo "이 Mac 이름: $(sed -n 's/^HOST_NAME=//p' "$ROOT/host.env")"
  title '자동 실행'
  if launchctl print "gui/$(id -u)/com.kongboda.collector" >/dev/null 2>&1; then green '자동 실행: 켜짐 (Mac 로그인 시 자동 시작)'; else yellow '자동 실행이 꺼져 있습니다. 설치 줄을 다시 실행하세요.'; fi
}

case "$ACTION" in
  install)
    title '1. 수집기 설치 (몇 분 걸립니다)'
    yellow 'F1 account email 이 나오면 F1 이메일, password 가 나오면 F1 비밀번호를 치고 Enter. 비밀번호는 쳐도 안 보여요(정상).'
    yellow 'Password 라고 한 번 더 물으면 Mac 로그인 비밀번호를 치고 Enter 하세요.'
    if ! /bin/bash -c "$(curl -fsSL "$RAW/setup-mac.sh")"; then red '설치 중 오류가 났어요. 이 화면을 사진 찍어 정민이한테 보내 주세요.'; exit 1; fi
    check
    title '끝'
    green '끝! 정민이한테 "설치했어" 라고 알려 주세요. 이 창은 닫아도 돼요.'
    ;;
  check) check ;;
  uninstall)
    title '수집기 제거'
    read -r -p '이 Mac에서 꽁보다 수집기를 지울까요? (y/n) ' answer </dev/tty
    [ "$answer" = y ] || { echo '취소했습니다.'; exit 0; }
    launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true
    rm -f "$AGENT"
    pkill -f "$ROOT/collector" 2>/dev/null || true
    (cd "$ROOT/collector" 2>/dev/null && HOST_ENV_FILE="$ROOT/host.env" "$ROOT/venv/bin/python" host_runner.py --forget-credentials >/dev/null 2>&1) || true
    rm -rf "$ROOT"
    green '제거했습니다. 정민이한테 "지웠어" 라고 알려 주세요.'
    echo '절전 설정은 시스템 설정 > 배터리 > 옵션에서 되돌릴 수 있습니다.'
    ;;
  *) echo "사용법: install | check | uninstall"; exit 2 ;;
esac
