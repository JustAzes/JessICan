#!/usr/bin/env python3
"""Erzeugt aus bootstrap.min.css eine Teilmenge mit den Regeln, die diese Website
tatsächlich braucht.

Grundlage sind die Klassen, die im fertigen Build vorkommen, plus eine Liste von
Klassen, die erst zur Laufzeit per JavaScript gesetzt werden (Bootstrap-Collapse,
Modal, Dropdown) und deshalb im statischen HTML nicht auftauchen.

Aufruf:  python3 tools/bootstrap-subset.py <build-verzeichnis> <ziel.css>
"""
import os
import re
import sys
import tempfile
from pathlib import Path

# Klassen, die Bootstrap oder clean-blog.js erst im Browser setzen und die
# deshalb nie im generierten HTML stehen.
RUNTIME_CLASSES = {
    # Collapse (Navigation)
    "collapse", "collapsing", "show",
    # Modal (Startseite)
    "modal-open", "modal-backdrop", "modal-static", "fade",
    # Dropdown (Dokumente)
    "dropdown-menu", "dropdown-menu-right", "dropdown-item", "dropdown-divider",
    "dropdown-header", "dropup", "dropright", "dropleft",
    # Formularvalidierung
    "was-validated", "is-invalid", "is-valid", "invalid-feedback", "valid-feedback",
    "invalid-tooltip", "valid-tooltip",
    # Zustände
    "active", "disabled", "focus", "hover",
    # clean-blog.js
    "is-fixed", "is-visible",
}

# Selektoren ohne Klassenbezug, die immer gelten sollen (Reset, Typografie …).
BARE_KEEP = re.compile(
    r"^(?:\*|::?[a-z-]+|html|body|main|header|footer|nav|section|article|aside|div|span|p|a|"
    r"h[1-6]|ul|ol|li|dl|dt|dd|img|svg|figure|figcaption|table|thead|tbody|tfoot|tr|th|td|caption|"
    r"form|fieldset|legend|label|input|select|textarea|button|optgroup|option|output|progress|"
    r"hr|pre|code|kbd|samp|small|strong|b|i|em|mark|sub|sup|abbr|blockquote|template|"
    r"\[[^\]]+\]|:root|:before|:after)"
)

CLASS_IN_SELECTOR = re.compile(r"\.(-?[_a-zA-Z][\w-]*)")


def used_classes(build_dir):
    found = set()
    attr = re.compile(r'class=(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))')
    for dirpath, _dirs, files in os.walk(build_dir):
        for fn in files:
            if not fn.endswith((".html", ".js")):
                continue
            text = Path(dirpath, fn).read_text(encoding="utf-8", errors="ignore")
            for m in attr.finditer(text):
                for group in m.groups():
                    if group:
                        found.update(group.split())
            # Klassen, die JS-Dateien selbst hinzufügen
            if fn.endswith(".js"):
                for m in re.finditer(r"classList\.(?:add|toggle|remove)\(\s*'([^']+)'", text):
                    found.add(m.group(1))
    return found


def split_top_level(css):
    """Zerlegt CSS in Blöcke: (at-regel oder None, inhalt)."""
    out, i, n = [], 0, len(css)
    while i < n:
        while i < n and css[i].isspace():
            i += 1
        if i == n:
            break
        if css[i] == "@":
            j = i
            while j < n and css[j] not in "{;":
                j += 1
            head = css[i:j].strip()
            if j < n and css[j] == ";":          # @charset, @import
                out.append(("__raw__", css[i:j + 1]))
                i = j + 1
                continue
            depth, k = 1, j + 1
            while k < n and depth:
                if css[k] == "{":
                    depth += 1
                elif css[k] == "}":
                    depth -= 1
                k += 1
            out.append((head, css[j + 1:k - 1]))
            i = k
        else:
            j = css.find("{", i)
            if j < 0:
                break
            depth, k = 1, j + 1
            while k < n and depth:
                if css[k] == "{":
                    depth += 1
                elif css[k] == "}":
                    depth -= 1
                k += 1
            out.append((None, css[i:k]))
            i = k
    return out


def split_rules(chunk):
    """Zerlegt einen Regelblock in (selektorliste, deklarationen)."""
    rules, i, n = [], 0, len(chunk)
    while i < n:
        j = chunk.find("{", i)
        if j < 0:
            break
        k = chunk.find("}", j)
        if k < 0:
            break
        rules.append((chunk[i:j].strip(), chunk[j + 1:k].strip()))
        i = k + 1
    return rules


def selector_needed(selector, classes):
    sel_classes = set(CLASS_IN_SELECTOR.findall(selector))
    if sel_classes:
        return sel_classes <= classes
    return bool(BARE_KEEP.match(selector.strip().lstrip(">+~ ")))


def split_selectors(selectors):
    """Kommas in :is(), :not() und Attributwerten sind keine Trenner."""
    start, depth, quote, escaped = 0, 0, None, False
    for i, char in enumerate(selectors):
        if escaped:
            escaped = False
        elif char == "\\":
            escaped = True
        elif quote:
            if char == quote:
                quote = None
        elif char in "\"'":
            quote = char
        elif char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
        elif char == "," and depth == 0:
            yield selectors[start:i].strip()
            start = i + 1
    yield selectors[start:].strip()


def filter_rules(chunk, classes, used_animations):
    kept = []
    for selectors, decls in split_rules(chunk):
        if not decls:
            continue
        keep = [s for s in split_selectors(selectors) if s and selector_needed(s, classes)]
        if keep:
            kept.append(",".join(keep) + "{" + decls + "}")
            for m in re.finditer(r"animation(?:-name)?\s*:\s*([^;]+)", decls):
                for token in re.split(r"[\s,]+", m.group(1)):
                    used_animations.add(token.strip())
    return "".join(kept)


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Aufruf: bootstrap-subset.py <build-verzeichnis> <ziel.css>")
    build_dir, target = Path(sys.argv[1]), Path(sys.argv[2])
    if not build_dir.is_dir() or not any(build_dir.rglob("*.html")):
        raise SystemExit(f"Kein HTML-Build gefunden: {build_dir}")
    root = Path(__file__).resolve().parent.parent
    src = (root / "static/css/bootstrap.min.css").read_text(encoding="utf-8")
    # Die Herstellerangabe und MIT-Lizenz müssen auch in der Teilmenge und
    # dem von Zola komprimierten Stylesheet erhalten bleiben.
    licenses = re.findall(r"/\*!.*?\*/", src, flags=re.S)
    if not licenses or not re.search(r"Bootstrap\s+v5\.3\.8\b", licenses[0]):
        raise SystemExit("Erwartete Bootstrap-5.3.8-Lizenzangabe fehlt.")
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)

    classes = used_classes(build_dir) | RUNTIME_CLASSES
    used_animations = set()

    body_parts, keyframe_blocks = [], []
    for at_rule, chunk in split_top_level(src):
        if at_rule == "__raw__":
            continue
        if at_rule is None:
            out = filter_rules(chunk, classes, used_animations)
            if out:
                body_parts.append(out)
        elif at_rule.startswith("@keyframes") or "keyframes" in at_rule:
            keyframe_blocks.append((at_rule, chunk))
        elif at_rule.startswith(("@media", "@supports")):
            inner = []
            for sub_at, sub_chunk in split_top_level(chunk):
                if sub_at is None:
                    inner.append(filter_rules(sub_chunk, classes, used_animations))
                elif sub_at and (sub_at.startswith("@media") or sub_at.startswith("@supports")):
                    nested = filter_rules(sub_chunk, classes, used_animations)
                    if nested:
                        inner.append(sub_at + "{" + nested + "}")
            joined = "".join(inner)
            if joined:
                body_parts.append(at_rule + "{" + joined + "}")
        elif at_rule.startswith("@font-face"):
            continue  # Schriften kommen aus local-fonts
        else:
            body_parts.append(at_rule + "{" + chunk + "}")

    for at_rule, chunk in keyframe_blocks:
        name = at_rule.split()[-1].strip()
        if name in used_animations:
            body_parts.append(at_rule + "{" + chunk + "}")

    result = "\n".join(licenses) + "\n" + "".join(body_parts) + "\n"
    # Leere CSS-Variablen sind gültig. Zolas Sass-Parser benötigt dafür ein
    # Leerzeichen, das die Bedeutung der Herstellerdeklaration nicht ändert.
    result = re.sub(r"(--[\w-]+:)(?=[;}])", r"\1 ", result)
    if not body_parts:
        raise SystemExit("Bootstrap-Teilmenge ist leer; Zieldatei unverändert.")
    result = ("// Automatisch erzeugt von tools/build-css.sh; nicht von Hand bearbeiten.\n"
              "// Bootstrap-Regeln aus dem fertigen HTML-Build und Laufzeitklassen.\n\n"
              if target.suffix == ".scss" else "") + result
    # Erst nach erfolgreicher Erzeugung ersetzen, auch bei parallelen Aufrufen.
    mode = target.stat().st_mode & 0o777 if target.exists() else 0o644
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent,
                                         prefix=f".{target.name}.", delete=False) as fh:
            temporary = Path(fh.name)
            fh.write(result)
        temporary.chmod(mode)
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

    print(f"Bootstrap: {len(src)/1024:.0f} KB -> {len(result)/1024:.0f} KB "
          f"({len(classes)} Klassen berücksichtigt)")


if __name__ == "__main__":
    main()
