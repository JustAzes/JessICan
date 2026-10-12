#!/usr/bin/env bash
# Optional maintenance step; neither Zola nor deployment runs this encoder.
# Regenerate only the two reviewed AVIF heroes from their existing WebP files.
set -euo pipefail

[[ $# -eq 0 ]] || {
  printf 'Usage: bash tools/encode-hero-images.sh\n' >&2
  exit 2
}
hero_repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)

for hero_command in magick ffmpeg ffprobe python3 mktemp cp chmod mv rm rmdir; do
  command -v "$hero_command" >/dev/null || {
    printf 'Required maintenance command is missing: %s\n' "$hero_command" >&2
    exit 1
  }
done
hero_magick_version=$(magick -version)
[[ "$hero_magick_version" =~ ImageMagick[[:space:]]([0-9]+)\. ]] &&
  (( BASH_REMATCH[1] >= 7 )) || {
    printf 'ImageMagick 7 or newer is required.\n' >&2
    exit 1
  }
for hero_video_command in ffmpeg ffprobe; do
  hero_video_version=$("$hero_video_command" -version)
  [[ "$hero_video_version" =~ version[[:space:]]([0-9]+)\. ]] &&
    (( BASH_REMATCH[1] >= 7 )) || {
      printf '%s 7 or newer is required.\n' "$hero_video_command" >&2
      exit 1
    }
done
hero_encoders=$(ffmpeg -hide_banner -encoders 2>/dev/null)
[[ "$hero_encoders" =~ [[:space:]]libaom-av1[[:space:]] ]] || {
  printf 'FFmpeg must include the libaom-av1 encoder.\n' >&2
  exit 1
}

hero_work_dir=''
hero_about_stage=''
hero_blog_stage=''
hero_cleanup() {
  local hero_status=$?
  trap - EXIT
  for hero_stage in "$hero_about_stage" "$hero_blog_stage"; do
    if [[ -n "$hero_stage" ]]; then rm -f -- "$hero_stage"; fi
  done
  if [[ -n "$hero_work_dir" && -f "$hero_work_dir/.jessican-hero-images" ]]; then
    for hero_name in about blog-main; do
      rm -f -- "$hero_work_dir/$hero_name.png" \
        "$hero_work_dir/$hero_name.avif" "$hero_work_dir/$hero_name.probe.json"
    done
    rm -f -- "$hero_work_dir/.jessican-hero-images"
    rmdir -- "$hero_work_dir"
  fi
  return "$hero_status"
}
trap hero_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -p -- "$hero_repo_root/.tools"
hero_work_dir=$(mktemp -d "$hero_repo_root/.tools/hero-images.XXXXXXXX")
printf 'JessICan reviewed hero-image maintenance\n' > "$hero_work_dir/.jessican-hero-images"

# Validate both encodings before replacing either reviewed destination.
for hero_name in about blog-main; do
  hero_source="$hero_repo_root/static/img/$hero_name.webp"
  [[ -f "$hero_source" ]] || {
    printf 'Missing original WebP: %s\n' "$hero_source" >&2
    exit 1
  }
  case "$hero_name" in
    about) hero_width=1980; hero_height=1320 ;;
    blog-main) hero_width=1792; hero_height=1024 ;;
  esac

  # Decode the existing image to 8-bit RGB without resizing or changing crop.
  magick "$hero_source" -depth 8 "PNG24:$hero_work_dir/$hero_name.png"
  ffmpeg -hide_banner -loglevel error -nostdin \
    -i "$hero_work_dir/$hero_name.png" -frames:v 1 \
    -vf 'scale=out_color_matrix=bt709:out_range=full,format=yuv420p' \
    -c:v libaom-av1 -still-picture 1 -cpu-used 4 -crf 34 -b:v 0 \
    -color_range pc -colorspace bt709 -color_primaries bt709 \
    -color_trc iec61966-2-1 -threads 2 "$hero_work_dir/$hero_name.avif"
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=codec_name,width,height -of json \
    "$hero_work_dir/$hero_name.avif" > "$hero_work_dir/$hero_name.probe.json"
  python3 - "$hero_work_dir/$hero_name.avif" \
    "$hero_work_dir/$hero_name.probe.json" "$hero_width" "$hero_height" <<'PY'
import json
from pathlib import Path
import sys

image, probe, width, height = sys.argv[1:]
with Path(image).open('rb') as stream:
    if stream.read(12)[4:12] != b'ftypavif':
        raise SystemExit(f'Invalid AVIF signature: {image}')
streams = json.loads(Path(probe).read_text())['streams']
if len(streams) != 1:
    raise SystemExit(f'Expected one AV1 image stream: {image}')
actual = streams[0]
expected = ('av1', int(width), int(height))
if (actual.get('codec_name'), actual.get('width'), actual.get('height')) != expected:
    raise SystemExit(f'Unexpected codec or pixel dimensions: {image}: {actual}')
PY
done

# Stage on the destination filesystem so each final rename is atomic.
hero_about_stage=$(mktemp "$hero_repo_root/static/img/.about.avif.XXXXXXXX")
hero_blog_stage=$(mktemp "$hero_repo_root/static/img/.blog-main.avif.XXXXXXXX")
cp -- "$hero_work_dir/about.avif" "$hero_about_stage"
cp -- "$hero_work_dir/blog-main.avif" "$hero_blog_stage"
chmod 644 "$hero_about_stage" "$hero_blog_stage"
mv -f -- "$hero_about_stage" "$hero_repo_root/static/img/about.avif"
hero_about_stage=''
mv -f -- "$hero_blog_stage" "$hero_repo_root/static/img/blog-main.avif"
hero_blog_stage=''
printf 'Regenerated validated AVIF heroes; existing WebP and JPEG files remain unchanged.\n'
