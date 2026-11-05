#!/bin/bash
# Make an AWS collector server run only around F1 sessions (run once in AWS CloudShell,
# in the server's region; safe to run again):
#   curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/aws-power-setup.sh | bash -s -- <instance-id> [host-name]
# What it does (all limited to this one server):
#   1. Role "kongboda-scheduler" for Amazon EventBridge Scheduler: may only START this instance.
#   2. Role "kongboda-collector-host" for the server itself: may create/move only its own
#      "kongboda-wake-*" schedules and hand them the role above; plus SSM so this script
#      can reach the server without SSH.
#   3. Shutting down from inside = stop (never terminate); a daily backstop start at
#      12:00 KST in case a wake-up was ever missed.
#   4. On the server: POWER_SAVE=aws in host.env, boto3, latest collector, restart.
# The server then turns itself off after each session and books its own next start
# (collector/power.py). Cost: about the hours it is on, instead of 24/7.
set -euo pipefail
IID="${1:?usage: aws-power-setup.sh <instance-id> [host-name]}"
HOST="${2:-kongboda-aws}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region || true)}}"
[ -n "$REGION" ] || { echo 'Set AWS_REGION to the server region (e.g. ap-southeast-2).'; exit 1; }
export AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
STATE=$(aws ec2 describe-instances --instance-ids "$IID" --query 'Reservations[0].Instances[0].State.Name' --output text)
echo "Server $IID ($HOST) in $REGION, account $ACCOUNT, state $STATE"
SCHED_ROLE=kongboda-scheduler HOST_ROLE=kongboda-collector-host
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

echo '[1/5] Scheduler role (start this instance only)'
cat > "$TMP/sched-trust.json" <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole",
 "Condition":{"StringEquals":{"aws:SourceAccount":"$ACCOUNT"}}}]}
JSON
cat > "$TMP/sched-policy.json" <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"ec2:StartInstances","Resource":"arn:aws:ec2:$REGION:$ACCOUNT:instance/$IID"}]}
JSON
aws iam get-role --role-name $SCHED_ROLE >/dev/null 2>&1 || aws iam create-role --role-name $SCHED_ROLE --assume-role-policy-document "file://$TMP/sched-trust.json" >/dev/null
aws iam update-assume-role-policy --role-name $SCHED_ROLE --policy-document "file://$TMP/sched-trust.json"
aws iam put-role-policy --role-name $SCHED_ROLE --policy-name start-kongboda-collector --policy-document "file://$TMP/sched-policy.json"

echo '[2/5] Server role (book its own wake-up; SSM)'
cat > "$TMP/host-trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
cat > "$TMP/host-policy.json" <<JSON
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["scheduler:CreateSchedule","scheduler:UpdateSchedule","scheduler:GetSchedule"],
  "Resource":"arn:aws:scheduler:$REGION:$ACCOUNT:schedule/default/kongboda-wake-*"},
 {"Effect":"Allow","Action":"iam:PassRole","Resource":"arn:aws:iam::$ACCOUNT:role/$SCHED_ROLE",
  "Condition":{"StringEquals":{"iam:PassedToService":"scheduler.amazonaws.com"}}}]}
JSON
aws iam get-role --role-name $HOST_ROLE >/dev/null 2>&1 || aws iam create-role --role-name $HOST_ROLE --assume-role-policy-document "file://$TMP/host-trust.json" >/dev/null
aws iam put-role-policy --role-name $HOST_ROLE --policy-name kongboda-wake --policy-document "file://$TMP/host-policy.json"
aws iam attach-role-policy --role-name $HOST_ROLE --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam get-instance-profile --instance-profile-name $HOST_ROLE >/dev/null 2>&1 || {
  aws iam create-instance-profile --instance-profile-name $HOST_ROLE >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name $HOST_ROLE --role-name $HOST_ROLE
  sleep 10  # a new profile takes a moment to be usable
}
ASSOC=$(aws ec2 describe-iam-instance-profile-associations --filters Name=instance-id,Values="$IID" Name=state,Values=associated \
  --query 'IamInstanceProfileAssociations[0].[AssociationId,IamInstanceProfile.Arn]' --output text)
case "$ASSOC" in
  *"instance-profile/$HOST_ROLE") echo 'Role already attached.' ;;
  None*|'') aws ec2 associate-iam-instance-profile --instance-id "$IID" --iam-instance-profile Name=$HOST_ROLE >/dev/null ;;
  *) aws ec2 replace-iam-instance-profile-association --association-id "${ASSOC%%[[:space:]]*}" --iam-instance-profile Name=$HOST_ROLE >/dev/null ;;
esac

echo '[3/5] Shutdown = stop; daily backstop start (03:00 UTC = 12:00 KST)'
aws ec2 modify-instance-attribute --instance-id "$IID" --instance-initiated-shutdown-behavior '{"Value":"stop"}'
TARGET=$(printf '{"Arn":"arn:aws:scheduler:::aws-sdk:ec2:startInstances","RoleArn":"arn:aws:iam::%s:role/%s","Input":"{\\"InstanceIds\\":[\\"%s\\"]}"}' "$ACCOUNT" "$SCHED_ROLE" "$IID")
for i in 1 2 3 4 5 6; do  # the scheduler role may take a few seconds to be accepted
  if aws scheduler get-schedule --name "kongboda-backstop-$HOST" >/dev/null 2>&1; then
    aws scheduler update-schedule --name "kongboda-backstop-$HOST" --schedule-expression 'cron(0 3 * * ? *)' \
      --flexible-time-window Mode=OFF --target "$TARGET" >/dev/null && break
  else
    aws scheduler create-schedule --name "kongboda-backstop-$HOST" --schedule-expression 'cron(0 3 * * ? *)' \
      --flexible-time-window Mode=OFF --target "$TARGET" \
      --description 'Kongboda collector: daily start in case a wake-up was missed' >/dev/null && break
  fi
  sleep 10
done
aws scheduler get-schedule --name "kongboda-backstop-$HOST" --query '[Name,ScheduleExpression,State]' --output text

echo '[4/5] Server on and reachable through SSM'
[ "$STATE" = running ] || { aws ec2 start-instances --instance-ids "$IID" >/dev/null; aws ec2 wait instance-running --instance-ids "$IID"; }
ONLINE=''
for i in $(seq 1 40); do
  ONLINE=$(aws ssm describe-instance-information --filters Key=InstanceIds,Values="$IID" --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)
  [ "$ONLINE" = Online ] && break
  # The agent reads the new role on its next credential refresh; a reboot makes it immediate.
  [ "$i" = 12 ] && { echo 'SSM agent not seen yet: rebooting the server once.'; aws ec2 reboot-instances --instance-ids "$IID"; }
  sleep 15
done
[ "$ONLINE" = Online ] || { echo 'The server did not reach SSM. Its role is set; rerun this script in a few minutes.'; exit 1; }

echo '[5/5] Power saving on the server'
REMOTE='export HOME=/root; set -e; cd /root;
curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-linux.sh -o setup-linux.sh;
KONGBODA_POWER_SAVE=aws bash setup-linux.sh '"$HOST"' </dev/null | tail -n 8;
grep -c "^POWER_SAVE=aws" /root/kongboda/host.env; /root/kongboda/venv/bin/python -c "import boto3, sys; sys.path.insert(0, \"/root/kongboda/collector\"); import power; print(\"power module ok\")";
systemctl is-active kongboda-collector'
CMD=$(aws ssm send-command --instance-ids "$IID" --document-name AWS-RunShellScript --comment 'kongboda power saving' \
  --parameters "$(python3 -c 'import json,sys; print(json.dumps({"commands":[sys.argv[1]],"executionTimeout":["1800"]}))' "$REMOTE")" \
  --query Command.CommandId --output text)
for i in $(seq 1 80); do
  S=$(aws ssm get-command-invocation --command-id "$CMD" --instance-id "$IID" --query Status --output text 2>/dev/null || echo Pending)
  case "$S" in Success|Failed|Cancelled|TimedOut) break ;; esac
  sleep 15
done
aws ssm get-command-invocation --command-id "$CMD" --instance-id "$IID" --query '[Status,StandardOutputContent,StandardErrorContent]' --output text | tail -n 20
echo "Done. The server turns itself off after each session and starts again before the next one."
echo "Its next start: aws scheduler get-schedule --name kongboda-wake-$HOST --query ScheduleExpression"
