#!/usr/bin/env bash
# bd_retry — retry bd invocations on dolt-lock contention only (bubbles-m51.3).
#
# Defense-in-depth layered on top of the bd-locked flock wrapper (bubbles-m51.1):
# even with serialization, brief ownership-handoff windows can race when one
# bd call is shutting down its ephemeral `dolt sql-server` while another is
# starting up. This helper retries ONLY on the two specific dolt-lock error
# substrings; every other failure returns immediately with the captured output
# preserved on stderr, so real regressions are never masked.
#
# Usage:  source this file, then call `bd_retry <args>` instead of `bd <args>`.
# Tunables:
#   BD_RETRY_MAX  Max retries on lock contention (default 5).
#
# Note: the function calls plain `bd` so PATH resolution still picks up the
# bd-locked flock wrapper when one is on PATH (e.g., inside ralph.sh).

bd_retry() {
  local n=0 max="${BD_RETRY_MAX:-5}" delay=0.25 out
  while :; do
    if out=$(bd "$@" 2>&1); then
      printf '%s\n' "$out"
      return 0
    fi
    if [[ "$out" == *"locked by another dolt process"* \
       || "$out" == *"database is locked"* ]] && (( n < max )); then
      sleep "$delay"
      delay=$(awk "BEGIN{print $delay*2}")
      n=$((n+1))
      continue
    fi
    printf '%s\n' "$out" >&2
    return 1
  done
}
