#!/usr/bin/env python3
"""Reject automatically loaded third-party resources in a generated static site.

Only parses files; never makes requests or executes HTML, CSS or JavaScript.
External navigation/SEO links and JSON-LD are not resource loads. External form
destinations are reported separately because forms require explicit submission.
"""

from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree


SITE_HOSTS = {"tierheilpraxis-jessican.de", "www.tierheilpraxis-jessican.de"}
LOAD_LINKS = {
    "stylesheet", "preload", "modulepreload", "icon", "manifest",
    "apple-touch-icon", "apple-touch-startup-image", "mask-icon", "prefetch",
    "preconnect", "dns-prefetch",
}
CSS_ESCAPE = re.compile(r"\\(?:([0-9a-fA-F]{1,6})\s?|([^\r\n\f])|\r\n|[\r\n\f])")
CSS_IDENT = re.compile(r"(?:[-_a-zA-Z0-9]|\\(?:[0-9a-fA-F]{1,6}\s?|[^\r\n\f]))+")


def css_unescape(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        if match[1]:
            code = int(match[1], 16)
            return chr(code) if code and code <= 0x10FFFF else "\ufffd"
        return match[2] or ""
    return CSS_ESCAPE.sub(replace, value)


def css_refs(text: str) -> list[tuple[str, int]]:
    """Read url(), @import strings and image-set strings, excluding comments.

    A small lexer keeps comment/string boundaries and CSS escapes intact; it
    does not mistake examples inside content strings for actual resource URLs.
    """
    refs: list[tuple[str, int]] = []

    def skip(position: int) -> int:
        while position < len(text):
            if text[position].isspace():
                position += 1
            elif text.startswith("/*", position):
                end = text.find("*/", position + 2)
                position = len(text) if end < 0 else end + 2
            else:
                break
        return position

    def quoted(position: int) -> tuple[str, int]:
        quote, start = text[position], position + 1
        position += 1
        while position < len(text):
            if text[position] == "\\":
                position += 2
            elif text[position] == quote:
                return css_unescape(text[start:position]), position + 1
            else:
                position += 1
        return css_unescape(text[start:position]), position

    position, image_set_depth, depth = 0, None, 0
    while position < len(text):
        position = skip(position)
        if position >= len(text):
            break
        char = text[position]
        if char in "\"'":
            value, end = quoted(position)
            if image_set_depth == depth:
                refs.append((value, text.count("\n", 0, position) + 1))
            position = end
            continue
        if char == "@":
            identifier = CSS_IDENT.match(text, position + 1)
            if identifier and css_unescape(identifier[0]).lower() == "import":
                following = skip(identifier.end())
                if following < len(text) and text[following] in "\"'":
                    value, end = quoted(following)
                    refs.append((value, text.count("\n", 0, position) + 1))
                    position = end
                    continue
        identifier = CSS_IDENT.match(text, position)
        if identifier:
            following = skip(identifier.end())
            name = css_unescape(identifier[0]).lower()
            if following < len(text) and text[following] == "(" and name == "url":
                start = skip(following + 1)
                if start < len(text) and text[start] in "\"'":
                    value, end = quoted(start)
                else:
                    end = start
                    while end < len(text) and text[end] != ")":
                        end += 2 if text[end] == "\\" else 1
                    value = css_unescape(text[start:end].strip())
                refs.append((value, text.count("\n", 0, position) + 1))
                position = text.find(")", end) + 1 if ")" in text[end:] else len(text)
                continue
            if following < len(text) and text[following] == "(" and name in {"image-set", "-webkit-image-set"}:
                image_set_depth = depth + 1
            position = identifier.end()
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            if image_set_depth == depth:
                image_set_depth = None
            depth = max(0, depth - 1)
        position += 1
    return refs


def srcset_refs(value: str) -> list[str]:
    # A URL token may contain commas (notably data: URLs). Separators immediately
    # following its token or its optional width/density descriptor are skipped.
    urls, position = [], 0
    while position < len(value):
        while position < len(value) and (value[position].isspace() or value[position] == ","):
            position += 1
        start = position
        while position < len(value) and not value[position].isspace():
            position += 1
        token = value[start:position]
        if not token:
            break
        urls.append(token.rstrip(","))
        if token.endswith(","):
            continue
        while position < len(value) and value[position] != ",":
            position += 1
    return urls


class Resources(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, int, str]] = []
        self.forms: list[tuple[str, int, str]] = []
        self.style_line: int | None = None
        self.quiz_data = False
        self.quiz_text = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a, line = dict(attrs), self.getpos()[0]
        automatic = {"script", "img", "source", "audio", "video", "track", "iframe", "embed"}
        if tag in automatic or (tag == "input" and (a.get("type") or "").lower() == "image"):
            if a.get("src"):
                self.refs.append((a["src"], line, f"{tag}[src]"))
        for attr in ("srcset", "imagesrcset", "data-srcset"):
            for ref in srcset_refs(a.get(attr) or ""):
                self.refs.append((ref, line, f"{tag}[{attr}]"))
        for attr in ("data-src", "data-background", "poster"):
            if a.get(attr):
                self.refs.append((a[attr], line, f"{tag}[{attr}]"))
        if tag == "object" and a.get("data"):
            self.refs.append((a["data"], line, "object[data]"))
        if tag in {"image", "use", "base"}:
            for attr in ("href", "xlink:href"):
                if a.get(attr):
                    self.refs.append((a[attr], line, f"{tag}[{attr}]"))
        if tag == "link" and set((a.get("rel") or "").lower().split()) & LOAD_LINKS and a.get("href"):
            self.refs.append((a["href"], line, "link[resource]"))
        for attr in ("action", "formaction"):
            if a.get(attr):
                self.forms.append((a[attr], line, f"{tag}[{attr}]"))
        for ref, css_line in css_refs(a.get("style") or ""):
            self.refs.append((ref, line + css_line - 1, "inline style"))
        if tag == "style":
            self.style_line = line
        if tag == "script":
            self.quiz_data = a.get("id") == "quizData"
            self.quiz_text = ""
        if tag == "iframe" and a.get("srcdoc"):
            nested = Resources()
            nested.feed(a["srcdoc"])
            self.refs.extend((ref, line + child_line - 1, f"iframe[srcdoc] {kind}") for ref, child_line, kind in nested.refs)
            self.forms.extend((ref, line + child_line - 1, kind) for ref, child_line, kind in nested.forms)
        if tag == "meta" and (a.get("http-equiv") or "").lower() == "refresh":
            match = re.search(r";\s*url\s*=\s*['\"]?(.*?)['\"]?\s*$", a.get("content") or "", re.I)
            if match:
                self.refs.append((match[1], line, "meta refresh"))

    def handle_data(self, data: str) -> None:
        if self.style_line is not None:
            self.refs.extend((ref, self.getpos()[0] + line - 1, "style block") for ref, line in css_refs(data))
        if self.quiz_data:
            self.quiz_text += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "style":
            self.style_line = None
        if tag == "script" and self.quiz_data:
            data = json.loads(self.quiz_text)
            if data.get("imgBase"):
                self.refs.append((data["imgBase"], self.getpos()[0], "quizData.imgBase"))
            self.quiz_data = False


def check(root: Path, base_url: str | None = None) -> int:
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"Build directory does not exist: {root}")
    if base_url is None:
        locations = ElementTree.parse(root / "sitemap.xml").findall(".//{*}loc")
        if not locations or not locations[0].text:
            raise ValueError("Sitemap contains no base URL")
        base_url = locations[0].text
    base = urlsplit(base_url)
    hosts = SITE_HOSTS | {base.hostname}
    failures, warnings, count = [], [], 0
    html_files, css_files = sorted(root.rglob("*.html")), sorted(root.rglob("*.css"))

    def examine(file: Path, ref: str, line: int, kind: str, form: bool = False) -> None:
        nonlocal count
        # Browsers strip ASCII tabs/newlines and treat backslashes as slashes in
        # HTTP URLs; normalise these before checking the actual hostname.
        ref = ref.strip().replace("\t", "").replace("\r", "").replace("\n", "").replace("\\", "/")
        if not ref or ref.startswith("#") or ref.lower().startswith("data:"):
            count += not form
            return
        url = urlsplit(urljoin(base_url, ref))
        permitted = url.scheme in {"http", "https"} and url.hostname in hosts and not url.username and not url.password
        if not permitted:
            message = f"{file.relative_to(root)}:{line} {kind}: {ref}"
            (warnings if form else failures).append(message)
        if not form:
            count += 1

    for file in html_files:
        page = Resources()
        page.feed(file.read_text(encoding="utf-8"))
        for ref, line, kind in page.refs:
            examine(file, ref, line, kind)
        for ref, line, kind in page.forms:
            examine(file, ref, line, kind, form=True)
    for file in css_files:
        for ref, line in css_refs(file.read_text(encoding="utf-8")):
            examine(file, ref, line, "CSS resource")
    for warning in sorted(set(warnings)):
        print(f"INFO external form destination (only on explicit submission): {warning}")
    if failures:
        raise ValueError("Automatically loaded external resources:\n" + "\n".join(sorted(set(failures))))
    print(f"PASS {count} local-resource references in {len(html_files)} HTML and {len(css_files)} CSS files; no automatically loaded third-party resources")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("build_dir", type=Path)
    args = parser.parse_args()
    try:
        check(args.build_dir)
    except (OSError, ValueError, ElementTree.ParseError) as error:
        parser.exit(1, f"FAIL {error}\n")
