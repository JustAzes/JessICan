#!/usr/bin/env python3
"""Compare a baseline build with a migrated build, including optional screenshots.

python3 tools/verify-migration.py OLD_BUILD NEW_BUILD
python3 tools/verify-migration.py OLD_BUILD NEW_BUILD --screenshots REVIEW_DIR

Screenshot checks additionally require Playwright, Pillow and Chromium. They load
only the supplied generated files; no production website is contacted.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Content(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.body = False
        self.ignored = 0
        self.text: list[str] = []
        self.title: list[str] = []
        self.in_title = False
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if tag == "body":
            self.body = True
        if tag in {"script", "style"}:
            self.ignored += 1
        if tag == "title":
            self.in_title = True
        if tag == "a" and a.get("href"):
            self.links.append((tag, a["href"]))
        if tag == "form" and a.get("action"):
            self.links.append((tag, a["action"]))

    def handle_endtag(self, tag: str) -> None:
        if tag == "body":
            self.body = False
        if tag in {"script", "style"}:
            self.ignored = max(0, self.ignored - 1)
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title.append(data)
        if self.body and not self.ignored:
            self.text.append(data)

    def signature(self) -> dict:
        normalize = lambda pieces: re.sub(r"\s+", " ", " ".join(pieces)).strip()
        return {"title": normalize(self.title), "body": normalize(self.text), "links": self.links}


def compare_content(old: Path, new: Path) -> dict:
    old_paths = {p.relative_to(old).as_posix() for p in old.rglob("*") if p.is_file()}
    new_paths = {p.relative_to(new).as_posix() for p in new.rglob("*") if p.is_file()}
    changed = []
    pages = sorted(p for p in old_paths & new_paths if p.endswith(".html"))
    for path in pages:
        signatures = []
        for root in (old, new):
            parser = Content()
            parser.feed((root / path).read_text(encoding="utf-8"))
            signatures.append(parser.signature())
        differences = [key for key in signatures[0] if signatures[0][key] != signatures[1][key]]
        if differences:
            changed.append({"path": path, "different": differences})
    return {"files": len(old_paths), "html_pages": len(pages),
            "removed": sorted(old_paths - new_paths), "added": sorted(new_paths - old_paths),
            "content_changes": changed}


def capture(root: Path, destination: Path, browser, width: int, route_path: str) -> tuple[Path, dict]:
    from playwright.sync_api import Error

    page = browser.new_page(viewport={"width": width, "height": 1000}, device_scale_factor=1)
    page_errors: list[str] = []
    missing: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    def respond(route) -> None:
        url = urlsplit(route.request.url)
        if url.netloc != "tierheilpraxis-jessican.de":
            route.abort()
            return
        file = (root / unquote(url.path).lstrip("/")).resolve()
        if not file.is_relative_to(root):
            route.abort()
            return
        if file.is_dir():
            file /= "index.html"
        if not file.is_file():
            missing.append(url.path)
            route.fulfill(status=404, body="Not found")
            return
        route.fulfill(path=str(file), content_type=mimetypes.guess_type(file.name)[0] or "application/octet-stream")

    page.route("**/*", respond)
    try:
        page.goto("https://tierheilpraxis-jessican.de" + route_path, wait_until="networkidle")
        page.locator('img[loading="lazy"]').evaluate_all('(images) => images.forEach(image => image.loading = "eager")')
        page.wait_for_load_state("networkidle")
        page.evaluate("Promise.all([...document.images].filter(image => image.currentSrc || image.getAttribute('src')).map(image => image.decode().catch(() => {})))")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(300)
        page.evaluate("window.scrollTo(0, 0)")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(350)
        destination.mkdir(parents=True, exist_ok=True)
        label = route_path.strip("/").replace("/", "-") or "home"
        file = destination / f"{width}-{label}.png"
        page.screenshot(path=str(file), full_page=True, animations="disabled")
        info = {"width": width, "path": route_path, "errors": page_errors, "missing": sorted(set(missing)),
                "overflow": page.evaluate("document.documentElement.scrollWidth > innerWidth")}
        return file, info
    except Error:
        raise
    finally:
        page.close()


def compare_screenshots(old: Path, new: Path, output: Path, executable: str) -> list[dict]:
    from PIL import Image, ImageChops
    from playwright.sync_api import sync_playwright

    paths = ["/", "/contact/", "/impressum/", "/about/", "/kurse/", "/pages/blog/", "/categories/hunde/",
             "/behandlung/behandlungsmethoden/", "/behandlung/vorgehen/",
             "/elemente/", "/elemente/hund/", "/quiz/hund/"]
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=executable, headless=True)
        try:
            for width in (390, 768, 1440):
                for path in paths:
                    a, before = capture(old, output / "before", browser, width, path)
                    b, after = capture(new, output / "after", browser, width, path)
                    with Image.open(a) as ia, Image.open(b) as ib:
                        same_size = ia.size == ib.size
                        changed_percent = 100.0
                        if same_size:
                            diff = ImageChops.difference(ia.convert("RGB"), ib.convert("RGB"))
                            channels = diff.split()
                            mask = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
                            histogram = mask.histogram()
                            changed_percent = 100 * sum(histogram[11:]) / (ia.width * ia.height)
                            if changed_percent:
                                target = output / "diff" / a.name
                                target.parent.mkdir(parents=True, exist_ok=True)
                                diff.save(target)
                    result = {"width": width, "path": path, "same_size": same_size,
                              "changed_percent": round(changed_percent, 5), "before": before, "after": after}
                    results.append(result)
                    print(f"SCREEN {width} {path}: size={same_size}, changed={changed_percent:.5f}%", flush=True)
        finally:
            browser.close()
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--screenshots", type=Path)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--max-pixel-change", type=float, default=0.25,
                        help="Maximum changed pixels (difference > 10/255) as a percentage")
    args = parser.parse_args()
    old, new = args.baseline.resolve(), args.candidate.resolve()
    if not old.is_dir() or not new.is_dir():
        parser.error("Both builds must exist")
    report = compare_content(old, new)
    print(json.dumps(report, indent=2), flush=True)
    failed = bool(report["removed"] or report["added"] or report["content_changes"])
    if args.screenshots:
        screens = compare_screenshots(old, new, args.screenshots.resolve(), args.chromium)
        report["screenshots"] = screens
        failed |= any(not s["same_size"] or s["changed_percent"] > args.max_pixel_change
                      or set(s["after"]["errors"]) - set(s["before"]["errors"])
                      or set(s["after"]["missing"]) - set(s["before"]["missing"])
                      or (s["after"]["overflow"] and not s["before"]["overflow"])
                      for s in screens)
        args.screenshots.mkdir(parents=True, exist_ok=True)
        (args.screenshots / "comparison.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    parser.exit(1 if failed else 0, "FAIL migration differs from baseline\n" if failed else "PASS migration matches baseline\n")
