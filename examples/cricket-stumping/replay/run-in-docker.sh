#!/usr/bin/env bash
# Re-run the code cells captured from the source conversation, in order, inside ONE throwaway container.
# The cells expect the ChatGPT sandbox layout, so the work dir is mounted at /mnt/data.
#
#   REVIEW cells/*.sh FIRST. They are third-party code captured from another AI's sandbox.
#
# Usage: ./run-in-docker.sh [workdir]
#   BATON_REPLAY_IMAGE    container image (default python:3.12-slim)
#   BATON_REPLAY_SETUP    shell run before the cells, e.g. "pip install numpy matplotlib python-docx"
#   BATON_REPLAY_NETWORK  docker network (default none; set to "bridge" if setup needs to download)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mkdir -p "${1:-$HERE/workdir}" && cd "${1:-$HERE/workdir}" && pwd)"
IMAGE="${BATON_REPLAY_IMAGE:-python:3.12-slim}"
NET="${BATON_REPLAY_NETWORK:-none}"
SETUP="${BATON_REPLAY_SETUP:-true}"
exec docker run --rm --network "$NET" -v "$WORK:/mnt/data" -v "$HERE/cells:/cells:ro" -w /mnt/data "$IMAGE" \
  bash -c "$SETUP; for c in /cells/*.sh; do echo \"── \$(basename \$c)\"; bash \"\$c\" || echo '   (cell failed, continuing)'; done"
