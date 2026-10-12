#!/usr/bin/env bash
set -euo pipefail

# Usage: bash tools/install-zola.sh [destination directory]
# The version and official release checksums are reviewed together in Git.
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
version=$(cat "$repo_root/.zola-version")
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  printf 'Invalid version in .zola-version\n' >&2
  exit 1
}
[[ $# -le 1 ]] || {
  printf 'Usage: %s [destination directory]\n' "$0" >&2
  exit 1
}
install_dir=${1:-"$repo_root/.tools/bin"}

case "$(uname -s):$(uname -m)" in
  Linux:x86_64) target=x86_64-unknown-linux-musl ;;
  Linux:aarch64|Linux:arm64) target=aarch64-unknown-linux-gnu ;;
  Darwin:x86_64) target=x86_64-apple-darwin ;;
  Darwin:arm64) target=aarch64-apple-darwin ;;
  *) printf 'Unsupported platform: %s %s\n' "$(uname -s)" "$(uname -m)" >&2; exit 1 ;;
esac

asset="zola-v${version}-${target}.tar.gz"
expected=$(awk -v asset="$asset" '$2 == asset { print $1 }' "$repo_root/tools/zola-checksums.txt")
[[ "$expected" =~ ^[a-f0-9]{64}$ ]] || {
  printf 'Missing or ambiguous official checksum for %s\n' "$asset" >&2
  exit 1
}
for command in curl tar install mktemp; do
  command -v "$command" >/dev/null || {
    printf 'Required command is missing: %s\n' "$command" >&2
    exit 1
  }
done
if command -v sha256sum >/dev/null; then
  checksum=(sha256sum)
elif command -v shasum >/dev/null; then
  checksum=(shasum -a 256)
else
  printf 'Install sha256sum or shasum before installing Zola.\n' >&2
  exit 1
fi

download_dir=$(mktemp -d)
trap 'rm -rf -- "$download_dir"' EXIT
curl --fail --location --show-error --silent \
  --proto '=https' --proto-redir '=https' --tlsv1.2 \
  --retry 3 --connect-timeout 15 --max-time 180 \
  --output "$download_dir/$asset" \
  "https://github.com/getzola/zola/releases/download/v${version}/${asset}"
actual=$("${checksum[@]}" "$download_dir/$asset" | awk '{ print $1 }')
[[ "$actual" == "$expected" ]] || {
  printf 'Checksum verification failed for %s\n' "$asset" >&2
  exit 1
}
tar -xzf "$download_dir/$asset" -C "$download_dir" zola
[[ "$("$download_dir/zola" --version)" == "zola $version" ]] || {
  printf 'Downloaded Zola does not match .zola-version\n' >&2
  exit 1
}
mkdir -p -- "$install_dir"
install -m 755 "$download_dir/zola" "$install_dir/.zola-install-$$"
mv -f -- "$install_dir/.zola-install-$$" "$install_dir/zola"
printf 'Installed verified Zola %s in %s\n' "$version" "$install_dir"
