#!/usr/bin/env bash
set -euo pipefail

# Use the same pinned, verified Zola release as local development and GitHub CI.
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"
[[ $# -le 1 ]] || {
  printf 'Usage: %s [output directory]\n' "$0" >&2
  exit 1
}
output_dir=${1:-.tools/site}
# Zola --force removes the output tree. Validate before installation or build.
output_dir=$(python3 tools/check-output-dir.py "$repo_root" "$output_dir" --mark)
bash tools/install-zola.sh
build_args=(build --output-dir "$output_dir" --force)
if [[ "${CONTEXT:-}" == deploy-preview ]]; then
  : "${DEPLOY_PRIME_URL:?Netlify deploy previews require DEPLOY_PRIME_URL}"
  build_args+=(--base-url "$DEPLOY_PRIME_URL")
fi
.tools/bin/zola "${build_args[@]}"
python3 tools/check-site.py "$output_dir"
