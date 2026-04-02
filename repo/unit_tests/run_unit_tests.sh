#!/usr/bin/env bash

set +e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUMMARY_FILE="$ROOT_DIR/unit_tests/.summary"
LOG_DIR="$ROOT_DIR/unit_tests/logs"

mkdir -p "$LOG_DIR"

TOTAL=0
PASSED=0
FAILED=0

run_group() {
  local name="$1"
  local command="$2"
  local log_file="$LOG_DIR/${name}.log"

  TOTAL=$((TOTAL + 1))
  echo "[UNIT] Running: $name"
  eval "$command" >"$log_file" 2>&1
  local exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    PASSED=$((PASSED + 1))
    echo "[UNIT][PASS] $name"
  else
    FAILED=$((FAILED + 1))
    echo "[UNIT][FAIL] $name"
    echo "  reason: command exited with status $exit_code"
    echo "  log snippet:"
    tail -n 25 "$log_file"
  fi
}

run_group "backend_unit_suite" "npm --prefix backend test"
run_group "frontend_unit_suite" "npm --prefix frontend test"

echo ""
echo "UNIT TEST SUMMARY"
echo "TOTAL=$TOTAL"
echo "PASSED=$PASSED"
echo "FAILED=$FAILED"

cat >"$SUMMARY_FILE" <<EOF
TOTAL=$TOTAL
PASSED=$PASSED
FAILED=$FAILED
EOF

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
