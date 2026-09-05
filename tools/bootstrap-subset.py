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
            text = open(os.path.join(dirpath, fn), encoding="utf-8", errors="ignore").read()
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


def filter_rules(chunk, classes, used_animations):
    kept = []
    for selectors, decls in split_rules(chunk):
        if not decls:
            continue
        keep = [s for s in (x.strip() for x in selectors.split(",")) if s and selector_needed(s, classes)]
        if keep:
            kept.append(",".join(keep) + "{" + decls + "}")
            for m in re.finditer(r"animation(?:-name)?\s*:\s*([^;]+)", decls):
                for token in re.split(r"[\s,]+", m.group(1)):
                    used_animations.add(token.strip())
    return "".join(kept)


def main():
    build_dir, target = sys.argv[1], sys.argv[2]
    src = open("static/css/bootstrap.min.css", encoding="utf-8").read()
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

    result = "".join(body_parts)
    with open(target, "w", encoding="utf-8") as fh:
        fh.write(result)

    print(f"Bootstrap: {len(src)/1024:.0f} KB -> {len(result)/1024:.0f} KB "
          f"({len(classes)} Klassen berücksichtigt)")


if __name__ == "__main__":
    main()
