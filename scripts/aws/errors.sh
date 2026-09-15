#!/usr/bin/env bash
set -euo pipefail

STAGE="${1:-prod}"
HOURS="${2:-24}"
SERVICE="health-car-api"
PREFIX="/aws/lambda/${SERVICE}-${STAGE}-"
START=$(( ( $(date +%s) - HOURS * 3600 ) * 1000 ))
PATTERN='?"request.failed" ?"job.failed" ?"Task timed out" ?"Runtime.ImportModuleError" ?"Invoke Error"'

groups=$(aws logs describe-log-groups \
  --log-group-name-prefix "$PREFIX" \
  --query 'logGroups[?storedBytes>`0`].logGroupName' \
  --output text)

total=0
for group in $groups; do
  events=$(aws logs filter-log-events \
    --log-group-name "$group" \
    --start-time "$START" \
    --filter-pattern "$PATTERN" \
    --query 'events[].[timestamp,message]' \
    --output text)

  [ -z "$events" ] && continue

  echo "=== ${group#$PREFIX}"
  while IFS=$'\t' read -r timestamp message; do
    [ -z "${timestamp:-}" ] && continue
    when=$(date -r $(( timestamp / 1000 )) '+%d/%m %H:%M:%S')
    payload=$(printf '%s' "$message" | sed -E 's/^[0-9T:.Z-]+\t[0-9a-f-]+\t(ERROR|WARN|INFO)\t//')
    echo "$when  ${payload:0:600}"
    total=$(( total + 1 ))
  done <<< "$events"
done

echo "--- ${total} falha(s) nas últimas ${HOURS}h em ${STAGE}"
