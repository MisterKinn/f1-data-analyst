// Collector install helper: an MCP tool that walks a person through installing a home
// collector (or lets an assistant that controls their computer run the steps), plus the
// kit downloads it points to. The site never runs anything on a person's computer.
import {KIT_ZIP_B64,KIT_PS1_B64} from './collector-kit.js';
import {myHosts} from './collector-fleet.js';

const SITE='https://kongboda-motorsports.vercel.app';
const MAC_LINE='/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/kit-mac.sh)" -';
// One-file Windows installer: downloads the kit script from the site and installs.
export const SETUP_CMD=['@echo off','echo Kongboda collector setup...',
 `powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Join-Path $env:TEMP 'kongboda-kit.ps1'; Invoke-WebRequest -UseBasicParsing '${SITE}/download/collector-kit.ps1' -OutFile $p; & $p -Action install"`,
 'echo.','pause',''].join('\r\n');
const WIN_LINE=`powershell -NoProfile -ExecutionPolicy Bypass -Command "irm ${SITE}/download/collector-kit.ps1 -OutFile $env:TEMP\\kongboda-kit.ps1; & $env:TEMP\\kongboda-kit.ps1 -Action install"`;

export const COLLECTOR_SETUP_TOOLS=[{name:'kongboda_collector_setup',
 description:'수집기 설치 도우미 (collector install helper). Use when the user wants to install, check or remove a Kongboda home collector (the computer that receives F1 live timing for the site), or asks why their collector is not collecting. Returns plain step-by-step instructions for Windows or macOS, the one-line commands, the kit download link and the status of the collectors linked to this user\'s Kongboda account. If you can run commands on the user\'s computer (computer use or a local shell) and the user asked you to install, you may run the install command for them; crew members skip the F1 account prompt (the site owner shares the F1 login with crew), other users type their own F1 email/password; the user types their own Mac password (if asked) and clicks the account-link button in the browser themselves. Never ask for, read or store their passwords.',
 inputSchema:{type:'object',properties:{os:{type:'string',enum:['windows','mac','unknown'],description:'The user\'s computer. Ask if unknown.'},action:{type:'string',enum:['install','check','remove'],description:'Default install.'}},additionalProperties:false},
 annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}];

const STEPS={
 windows:{
  install:['꽁보다에 쓸 Google 계정을 준비합니다. 꽁보다 선원(비밀키 등록)이면 F1 계정이 필요 없고(운영자 F1 로그인을 자동으로 받음), 선원이 아니면 F1 TV 구독 계정(이메일·비밀번호)이 필요합니다. 노트북이면 충전기를 꽂습니다.',
   `설치 파일을 받아 두 번 클릭합니다: ${SITE}/download/kongboda-collector-setup.cmd (또는 키트 zip ${SITE}/download/kongboda-collector-setup.zip → 압축 풀기 → "1_설치하기"). "Windows의 PC 보호"가 나오면 "추가 정보" → "실행".`,
   '검은 창에 "F1 account email"이 나오면: 선원은 그냥 Enter, 선원이 아니면 F1 이메일과 비밀번호를 치고 Enter(비밀번호는 화면에 안 보이는 게 정상).',
   '인터넷 창이 열리면 Google로 로그인하고 "내 계정에 이 컴퓨터 연결"을 누릅니다. 연결하면 바로 등록되어 세션 시간에 자동으로 수집합니다.',
   '끝. 다음부터는 컴퓨터를 켜고 Windows에 로그인만 하면 됩니다(세션 전이든 중간이든). 꺼져도 5분 안에 다시 켜집니다.'],
  check:['압축 푼 폴더의 "2_상태_확인"을 두 번 클릭합니다. "F1 실시간 타이밍 접속: 가능"과 "등록됨"이 초록색이면 정상입니다.',`꽁보다 사이트의 수집기 상태 페이지(${SITE}/status)에서도 볼 수 있습니다.`],
  remove:['압축 푼 폴더의 "3_제거하기"를 두 번 클릭하고 y를 치고 Enter.']},
 mac:{
  install:['꽁보다에 쓸 Google 계정과 Mac 로그인 비밀번호를 준비합니다. 선원이 아니면 F1 TV 구독 계정도 필요합니다. 맥북이면 충전기를 꽂고, 세션 중에는 뚜껑을 열어 둡니다(외부 모니터 연결 시 제외).',
   'command + 스페이스바 → "터미널" → Enter. 아래 설치 줄을 붙여넣고 Enter.',
   '"F1 account email"이 나오면 선원은 그냥 Enter, 선원이 아니면 F1 이메일·비밀번호. "Password:"가 나오면 Mac 로그인 비밀번호(화면에 안 보이는 게 정상).',
   '인터넷 창이 열리면 Google로 로그인하고 "내 계정에 이 컴퓨터 연결"을 누릅니다. 연결하면 바로 등록되어 세션 시간에 자동으로 수집합니다.',
   '끝. 다음부터는 Mac을 켜고 로그인만 하면 됩니다.'],
  check:['터미널에 확인 줄을 붙여넣고 Enter. 초록색 "가능"과 "등록됨"이면 정상입니다.',`${SITE}/status 에서도 볼 수 있습니다.`],
  remove:['터미널에 제거 줄을 붙여넣고 Enter, y를 치고 Enter.']}};

export function collectorSetupGuide(os='unknown',action='install'){
 const guide={site_status_page:`${SITE}/status`,network:'집 인터넷(회사·학교망·VPN 제외)이어야 합니다. F1은 데이터센터·클라우드 서버의 접속을 막습니다.',
  approval:'계정에 연결하면 운영자 승인 없이 바로 등록되고, 순서는 맨 뒤에 붙습니다. 운영자는 순서 변경·일시정지·삭제만 합니다.'};
 if(os==='unknown')return {...guide,ask:'Windows인지 Mac인지 먼저 물어보세요.',windows_kit:`${SITE}/download/kongboda-collector-setup.zip`,mac_install_line:MAC_LINE+' install'};
 const steps=STEPS[os][action];
 const commands=os==='mac'?{install:MAC_LINE+' install',check:MAC_LINE+' check',remove:MAC_LINE+' uninstall'}:{install:WIN_LINE,one_file_installer:`${SITE}/download/kongboda-collector-setup.cmd`,kit_zip:`${SITE}/download/kongboda-collector-setup.zip`};
 return {...guide,os,action,steps,commands,
  for_assistants_with_computer_control:os==='mac'
   ?'With the user\'s go-ahead you may open Terminal and run commands.'+action+'. Crew members (secret key registered) press Enter at the F1 account prompt and use the owner\'s shared login; others type their own F1 TV account themselves. Let the user type the Mac password. When the account-link page opens, the user signs in with Google and clicks the link button.'
   :action==='install'?'With the user\'s go-ahead you may run commands.install in PowerShell (it downloads the kit script from the Kongboda site and runs the installer). Crew members (secret key registered) press Enter at the F1 account prompt and use the owner\'s shared login; others type their own F1 TV account themselves. When the account-link page opens, the user signs in with Google and clicks the link button.':'Run the matching kit launcher from the extracted kit folder.'};
}

export async function collectorSetupCall(request,env,args={},{identity}={}){
 const os=['windows','mac','unknown'].includes(args.os)?args.os:'unknown',action=['install','check','remove'].includes(args.action)?args.action:'install';
 const out=collectorSetupGuide(os,action);
 try{
  const info=identity?await identity(request,env):null;
  if(info?.account&&!info.account.deleted&&env.BUCKET)out.my_collectors=await myHosts(env,info.account.id);
 }catch{out.my_collectors_error='수집기 상태를 읽지 못했습니다.';}
 return {structuredContent:out,content:[{type:'text',text:JSON.stringify(out)}],isError:false};
}

// Kit downloads served by the site (the same files as the zip handed out by hand).
export function collectorKitRoute(request){
 const path=new URL(request.url).pathname;
 if(request.method!=='GET'&&request.method!=='HEAD')return null;
 const bytes=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
 if(path==='/download/kongboda-collector-setup.zip')return new Response(request.method==='HEAD'?null:bytes(KIT_ZIP_B64),{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="kongboda-collector-setup.zip"','cache-control':'public, max-age=300'}});
 if(path==='/download/kongboda-collector-setup.cmd')return new Response(request.method==='HEAD'?null:SETUP_CMD,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="kongboda-collector-setup.cmd"','cache-control':'public, max-age=300'}});
 if(path==='/download/collector-kit.ps1')return new Response(request.method==='HEAD'?null:bytes(KIT_PS1_B64),{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=300'}});
 return null;
}
