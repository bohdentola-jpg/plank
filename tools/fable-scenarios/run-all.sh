#!/usr/bin/env bash
# Runs every Fourth & Fable QA scenario and prints a pass/fail table.
#   bash tools/fable-scenarios/run-all.sh [quick]
cd "$(dirname "$0")/../.." || exit 1
list="chapter1 chapters puzzles encounter realtime mg-blitz"
[ "$1" = "quick" ] || list="$list mg-snack mg-dash mg-golf mg-fishing mg-mascot mg-lights"
fail=0
for s in $list; do
  extra=""
  [ "$s" = "realtime" ] && extra="--w 960 --h 540"
  if out=$(timeout 900 node tools/fable-qa.cjs --script "tools/fable-scenarios/$s.cjs" --quiet $extra 2>&1); then
    echo "PASS  $s"
  else
    fail=1
    echo "FAIL  $s"
    echo "$out" | grep -v '^shot' | tail -6 | sed 's/^/      /'
  fi
done
exit $fail
