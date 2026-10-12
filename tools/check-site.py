#!/usr/bin/env python3
"""Check the generated site's essential routes, navigation, assets and data.

Usage: python3 tools/check-site.py public
No network requests or third-party Python packages are required.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from xml.etree import ElementTree


REQUIRED_PAGES = {
    "/": "Tierheilpraxis",
    "/about/": "Jessica",
    "/contact/": "Kontaktformular",
    "/impressum/": "Impressum",
    "/behandlung/behandlungsmethoden/": "Behandlung",
    "/behandlung/vorgehen/": "Preise",
    "/elemente/": "Elemente",
    "/elemente/hund/": "Elemente",
    "/kurse/": "Kurse",
    "/pages/blog/": "Blog",
    "/quiz/": "quizData",
    "/quiz/hund/": "quizData",
    "/prototyp/komplett/": "JessICan",
    "/prototyp/sanft/": "JessICan",
}


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.in_title = False
        self.in_nav = False
        self.nav: list[str] = []
        self.assets: list[str] = []
        self.script_id: str | None = None
        self.script_data: dict[str, str] = {}
        self.forms: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "nav":
            self.in_nav = True
        if tag == "a" and self.in_nav and a.get("href"):
            self.nav.append(a["href"])
        if tag in {"script", "img", "source"} and a.get("src"):
            self.assets.append(a["src"])
        if tag == "link" and set((a.get("rel") or "").split()) & {
            "stylesheet", "preload", "icon", "manifest", "apple-touch-icon", "mask-icon"
        } and a.get("href"):
            self.assets.append(a["href"])
        if tag == "script" and a.get("id"):
            self.script_id = a["id"]
            self.script_data[self.script_id] = ""
        if tag == "form" and a.get("action"):
            self.forms.append(a["action"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        if tag == "nav":
            self.in_nav = False
        if tag == "script":
            self.script_id = None

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data
        if self.script_id:
            self.script_data[self.script_id] += data


def site_path(root: Path, path: str) -> Path:
    candidate = (root / unquote(path).lstrip("/")).resolve()
    if not candidate.is_relative_to(root):
        raise ValueError(f"Path leaves build directory: {path}")
    return candidate / "index.html" if candidate.is_dir() else candidate


def check(root: Path) -> int:
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"Build directory does not exist: {root}")
    sitemap = ElementTree.parse(root / "sitemap.xml")
    locations = [e.text or "" for e in sitemap.findall(".//{*}loc")]
    if not locations:
        raise ValueError("Sitemap contains no URLs")
    origin = urlsplit(locations[0])
    base = f"{origin.scheme}://{origin.netloc}"
    count = 0
    for path, marker in REQUIRED_PAGES.items():
        file = site_path(root, path)
        html = file.read_text(encoding="utf-8")
        page = Page()
        page.feed(html)
        if marker not in html or not page.title.strip():
            raise ValueError(f"Missing content or page title: {path}")
        for url in page.nav + page.assets:
            full = urlsplit(urljoin(base + path, url))
            if full.netloc != origin.netloc or full.scheme not in {"http", "https"}:
                continue
            local = site_path(root, full.path)
            if not local.is_file() or local.stat().st_size == 0:
                raise ValueError(f"Missing navigation target or asset on {path}: {full.path}")
            count += 1
        if path == "/contact/" and "https://formspree.io/f/mnqylged" not in page.forms:
            raise ValueError("Contact form destination changed")
        if path in {"/quiz/", "/quiz/hund/"}:
            data = json.loads(page.script_data["quizData"])
            questions = data["questions"]
            if len(questions) != data["total"] or not questions:
                raise ValueError(f"Incomplete quiz data: {path}")
            if any(len(q["a"]) != 5 for q in questions):
                raise ValueError(f"Incomplete quiz answer options: {path}")
        count += 1
        print(f"PASS {path}")
    for path, magic in {
        "/fonts/Lora-Regular.woff2": b"wOF2",
        "/documents/Anamnesefragebogen_Hund.pdf": b"%PDF",
        "/documents/Anamnesefragebogen_Pferd.pdf": b"%PDF",
    }.items():
        if not site_path(root, path).read_bytes().startswith(magic):
            raise ValueError(f"Invalid binary asset: {path}")
        count += 1
    for path in ("/", "/impressum/", "/contact/", "/quiz/", "/quiz/hund/"):
        if not any(urlsplit(url).path == path for url in locations):
            raise ValueError(f"Required page missing from sitemap: {path}")
    cname = (root / "CNAME").read_text().strip()
    if cname != "tierheilpraxis-jessican.de":
        raise ValueError("Production CNAME changed")
    manifest_path = "/favicons/site.webmanifest"
    manifest = json.loads(site_path(root, manifest_path).read_text(encoding="utf-8"))
    for icon in manifest.get("icons", []):
        url = urlsplit(urljoin(base + manifest_path, icon["src"]))
        if url.netloc != origin.netloc:
            raise ValueError("Manifest icon must be hosted on the site")
        if not site_path(root, url.path).read_bytes().startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError(f"Missing or invalid manifest icon: {url.path}")
        count += 1
    print(f"PASS {count} route, navigation, asset and data checks; sitemap and CNAME valid")
    # Both GitHub Actions and Netlify use this entry point. Check every generated
    # page and CSS file so a future external font/script cannot slip through.
    guard_path = Path(__file__).with_name("check-local-resources.py")
    guard_spec = importlib.util.spec_from_file_location("local_resources", guard_path)
    guard = importlib.util.module_from_spec(guard_spec)
    guard_spec.loader.exec_module(guard)
    count += guard.check(root, base + "/")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("build_dir", type=Path)
    args = parser.parse_args()
    try:
        check(args.build_dir)
    except (OSError, ValueError, KeyError, ElementTree.ParseError) as error:
        parser.exit(1, f"FAIL {error}\n")
