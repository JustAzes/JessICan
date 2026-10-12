#!/usr/bin/env python3
"""Refuse unsafe directories before Zola's destructive --force build."""

from __future__ import annotations

import argparse
from pathlib import Path

MARKER_CONTENT = "JessICan Zola generated build output\n"


def marker_path(output: Path) -> Path:
    # Keep ownership metadata outside the generated site and deployed artifact.
    return output.parent / f".{output.name}.jessican-generated-output"


def checked_output(repo_root: Path, requested: str) -> Path:
    repo_root = repo_root.resolve()
    if not requested or ".." in Path(requested).parts:
        raise ValueError("Use .tools/site or an explicit external output directory")
    candidate = Path(requested)
    if not candidate.is_absolute():
        candidate = repo_root / candidate
    if any(path.is_symlink() for path in (candidate, *candidate.parents)):
        raise ValueError("Build output and its parents must not be symlinks")
    output = candidate.resolve()
    allowed_local = repo_root / ".tools/site"
    if output == repo_root or output in repo_root.parents:
        raise ValueError("Build output must not be the checkout or an ancestor")
    if output.is_relative_to(repo_root) and output != allowed_local:
        raise ValueError("Only .tools/site may be used as output inside the checkout")
    if output.exists():
        if not output.is_dir():
            raise ValueError("Build output must be a directory")
        if output != allowed_local and any(output.iterdir()):
            marker = marker_path(output)
            if marker.is_symlink() or not marker.is_file() or marker.read_text() != MARKER_CONTENT:
                raise ValueError("Existing external output must be empty or marked as generated")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo_root", type=Path)
    parser.add_argument("output_directory")
    parser.add_argument("--mark", action="store_true", help="Record ownership outside the generated site")
    args = parser.parse_args()
    try:
        output = checked_output(args.repo_root, args.output_directory)
        if args.mark:
            marker = marker_path(output)
            if marker.is_symlink() or (marker.exists() and marker.read_text() != MARKER_CONTENT):
                raise ValueError("Refusing to replace existing ownership metadata")
            marker.parent.mkdir(parents=True, exist_ok=True)
            marker.write_text(MARKER_CONTENT)
        print(output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Unsafe build output: {error}\n")


if __name__ == "__main__":
    main()
