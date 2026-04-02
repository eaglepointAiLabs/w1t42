#!/usr/bin/env bash

set +e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_SUMMARY="$ROOT_DIR/unit_tests/.summary"
API_SUMMARY="$ROOT_DIR/API_tests/.summary"

mkdir -p "$ROOT_DIR/unit_tests" "$ROOT_DIR/API_tests"

if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  npm --prefix "$ROOT_DIR/backend" install
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm --prefix "$ROOT_DIR/frontend" install
fi

echo ""
echo "===== RUNNING UNIT TESTS ====="
bash "$ROOT_DIR/unit_tests/run_unit_tests.sh"
UNIT_EXIT=$?

echo ""
echo "===== RUNNING API TESTS ====="
bash "$ROOT_DIR/API_tests/run_api_tests.sh"
API_EXIT=$?

UNIT_TOTAL=0
UNIT_PASSED=0
UNIT_FAILED=0
API_TOTAL=0
API_PASSED=0
API_FAILED=0

if [ -f "$UNIT_SUMMARY" ]; then
  # shellcheck disable=SC1090
  source "$UNIT_SUMMARY"
  UNIT_TOTAL=${TOTAL:-0}
  UNIT_PASSED=${PASSED:-0}
  UNIT_FAILED=${FAILED:-0}
fi

if [ -f "$API_SUMMARY" ]; then
  # shellcheck disable=SC1090
  source "$API_SUMMARY"
  API_TOTAL=${TOTAL:-0}
  API_PASSED=${PASSED:-0}
  API_FAILED=${FAILED:-0}
fi

TOTAL=$((UNIT_TOTAL + API_TOTAL))
PASSED=$((UNIT_PASSED + API_PASSED))
FAILED=$((UNIT_FAILED + API_FAILED))

echo ""
echo "===== CONSOLIDATED SUMMARY ====="
echo "TOTAL=$TOTAL"
echo "PASSED=$PASSED"
echo "FAILED=$FAILED"

if [ "$FAILED" -gt 0 ] || [ "$UNIT_EXIT" -ne 0 ] || [ "$API_EXIT" -ne 0 ]; then
  exit 1
fi

exit 0
