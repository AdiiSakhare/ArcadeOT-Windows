#!/bin/bash
set -euo pipefail

arcade_app_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$arcade_app_dir"
arcade_task_tmp=""
cleanup() {
  if [ -n "$arcade_task_tmp" ] && [ -d "$arcade_task_tmp" ]; then
    rm -rf -- "$arcade_task_tmp"
  fi
}
failed() {
  printf '\nArcadeOT could not start. Review the error above.\n'
  printf 'Press Return to close this window. '
  read -r arcade_reply || true
}
trap cleanup EXIT
trap failed ERR

if [ "$(uname -s)" != "Darwin" ]; then
  printf 'This launcher is for macOS. On another OS, use npm ci, npm run build, then npm start.\n'
  exit 1
fi

if [ -x "$arcade_app_dir/.runtime/node/bin/node" ]; then
  export PATH="$arcade_app_dir/.runtime/node/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1 || ! node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' >/dev/null 2>&1; then
  case "$(uname -m)" in
    arm64) arcade_arch="arm64" ;;
    x86_64) arcade_arch="x64" ;;
    *) printf 'This Mac architecture is not supported by the launcher.\n'; exit 1 ;;
  esac
  printf 'Setting up a private Node.js 24 runtime for this app. No administrator access is needed.\n'
  arcade_task_tmp="$(mktemp -d "${TMPDIR:-/tmp}/arcadeot-node.XXXXXX")"
  curl --fail --location --retry 2 --connect-timeout 15 --max-time 120 \
    https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt \
    -o "$arcade_task_tmp/SHASUMS256.txt"
  arcade_archive="$(awk -v suffix="-darwin-${arcade_arch}.tar.gz" '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-darwin-(arm64|x64)\.tar\.gz$/ && substr($2,length($2)-length(suffix)+1)==suffix {print $2}' "$arcade_task_tmp/SHASUMS256.txt")"
  if [ -z "$arcade_archive" ] || [ "$(printf '%s\n' "$arcade_archive" | wc -l | tr -d ' ')" != "1" ]; then
    printf 'Could not identify the official Node.js 24 archive for this Mac.\n'
    exit 1
  fi
  curl --fail --location --retry 2 --connect-timeout 15 --max-time 300 \
    "https://nodejs.org/dist/latest-v24.x/$arcade_archive" \
    -o "$arcade_task_tmp/$arcade_archive"
  awk -v file="$arcade_archive" '$2==file {print $0}' "$arcade_task_tmp/SHASUMS256.txt" > "$arcade_task_tmp/selected-sha256.txt"
  (cd "$arcade_task_tmp" && shasum -a 256 -c selected-sha256.txt)
  tar -xzf "$arcade_task_tmp/$arcade_archive" -C "$arcade_task_tmp"
  mkdir -p "$arcade_app_dir/.runtime"
  if [ -e "$arcade_app_dir/.runtime/node" ]; then
    printf 'An unusable app-local runtime already exists. Move .runtime/node aside, then retry.\n'
    exit 1
  fi
  mv "$arcade_task_tmp/${arcade_archive%.tar.gz}" "$arcade_app_dir/.runtime/node"
  export PATH="$arcade_app_dir/.runtime/node/bin:$PATH"
  cleanup
  arcade_task_tmp=""
fi

printf '\nArcadeOT for macOS · real PLC gateway\n'
printf 'Runtime: '
node --version
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi
npm run build
arcade_port="${PORT:-3001}"
case "$arcade_port" in
  ''|*[!0-9]*) printf 'PORT must be a numeric TCP port.\n'; exit 1 ;;
esac
arcade_url="http://127.0.0.1:$arcade_port"
printf '\nOpening %s when the gateway is ready.\nKeep this terminal open while collecting data.\n\n' "$arcade_url"
(
  for arcade_attempt in {1..30}; do
    if curl --silent --fail --max-time 1 "$arcade_url" | grep -q '<title>ArcadeOT'; then
      open "$arcade_url"
      exit 0
    fi
    sleep 1
  done
) &
exec node server/index.mjs
