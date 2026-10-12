#!/usr/bin/env python3
"""Smoke-test a generated JessICan build in Chromium without network access.

Usage: python3 tools/check-browser.py BUILD_DIR [--chromium /usr/bin/chromium]
Requires Playwright and Chromium. Every request is fulfilled from BUILD_DIR or
blocked; the production website and form destination are never contacted.
"""

from __future__ import annotations

import argparse
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlencode, urlsplit


ORIGIN = "https://tierheilpraxis-jessican.de"


def check(root: Path, executable: str) -> int:
    from playwright.sync_api import sync_playwright

    root = root.resolve()
    if not (root / "index.html").is_file():
        raise ValueError(f"Generated index.html is missing: {root}")

    count = 0
    errors: list[str] = []
    missing: set[str] = set()
    blocked: set[str] = set()

    def require(condition: bool, description: str) -> None:
        nonlocal count
        if not condition:
            raise ValueError(description)
        count += 1

    def respond(route) -> None:
        request = route.request
        url = urlsplit(request.url)
        if f"{url.scheme}://{url.netloc}" != ORIGIN or request.method != "GET":
            blocked.add(request.url)
            route.abort()
            return
        file = (root / unquote(url.path).lstrip("/")).resolve()
        if not file.is_relative_to(root):
            missing.add(url.path)
            route.fulfill(status=403, body="Forbidden")
            return
        if file.is_dir():
            file /= "index.html"
        if not file.is_file():
            missing.add(url.path)
            route.fulfill(status=404, body="Not found")
            return
        route.fulfill(path=str(file), content_type=mimetypes.guess_type(file.name)[0]
                      or "application/octet-stream")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=executable, headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844},
                                      service_workers="block")
        context.route("**/*", respond)
        page = context.new_page()
        page.set_default_timeout(10_000)
        page.on("pageerror", lambda error: errors.append(str(error)))

        def load(path: str) -> None:
            response = page.goto(ORIGIN + path, wait_until="networkidle")
            require(response is not None and response.status == 200, f"Page failed: {path}")
            page.evaluate("document.fonts.ready")

        def overflow(description: str) -> None:
            require(page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
                    f"Horizontal overflow: {description}")

        def image_health(description: str) -> None:
            page.locator('img[loading="lazy"]').evaluate_all(
                '(images) => images.forEach(image => image.loading = "eager")')
            page.wait_for_load_state("networkidle")
            # Empty, hidden result images are placeholders until quiz evaluation.
            failures = page.evaluate("""async () => {
              const images = [...document.images].filter(image =>
                (image.currentSrc || image.getAttribute('src')) &&
                getComputedStyle(image).display !== 'none');
              await Promise.all(images.map(image => image.decode().catch(() => {})));
              return images.filter(image => !image.complete || !image.naturalWidth)
                           .map(image => image.currentSrc || image.src);
            }""")
            require(not failures, f"Images failed on {description}: {failures}")

        try:
            load("/")
            overflow("mobile homepage")
            image_health("mobile homepage")
            toggler = page.locator("#mainNav .navbar-toggler")
            menu = page.locator("#navbarResponsive")
            require(toggler.is_visible(), "Mobile menu button is hidden")
            require(toggler.get_attribute("aria-expanded") == "false",
                    "Mobile menu must start closed")
            require(not menu.is_visible(), "Mobile menu is unexpectedly visible")
            toggler.click()
            require(toggler.get_attribute("aria-expanded") == "true", "Menu did not open")
            require(menu.is_visible(), "Opened menu links are hidden")
            require(menu.locator("a").count() == 7, "Navigation links changed")
            overflow("opened mobile menu")
            toggler.click()
            require(toggler.get_attribute("aria-expanded") == "false", "Menu did not close")
            require(not menu.is_visible(), "Closed menu remains visible")
            toggler.click()
            page.set_viewport_size({"width": 1440, "height": 1000})
            page.wait_for_function("document.querySelector('.navbar-toggler').getAttribute('aria-expanded') === 'false'")
            require(not toggler.is_visible(), "Desktop menu button remains visible")
            require(menu.is_visible(), "Desktop navigation is hidden")
            overflow("desktop homepage")
            page.set_viewport_size({"width": 390, "height": 844})
            require(not menu.is_visible(), "Menu reopened after resizing to mobile")
            print("PASS mobile menu, desktop navigation and resize state", flush=True)

            params = {"betreff": "Akupressur-Test", "nachricht": "Browserprüfung ohne Versand."}
            load("/contact/?" + urlencode(params))
            overflow("mobile contact form")
            require(page.locator("#betreff").input_value() == params["betreff"],
                    "Contact subject prefill failed")
            require(page.locator("#message").input_value() == params["nachricht"],
                    "Contact message prefill failed")
            form = page.locator('form[name="contact"]')
            require(form.get_attribute("action") == "https://formspree.io/f/mnqylged",
                    "Contact destination changed")
            for selector in ("#name", "#email", "#message"):
                require(page.locator(selector).evaluate("field => field.required"),
                        f"Required field lost native validation: {selector}")
            require(not form.evaluate("form => form.checkValidity()"),
                    "Empty required fields incorrectly validate")
            page.locator("#name").fill("Umgebungstest")
            page.locator("#email").fill("ungueltig")
            require(page.locator("#email").evaluate("field => field.validity.typeMismatch"),
                    "Malformed email incorrectly validates")
            page.locator("#email").fill("test@example.invalid")
            require(form.evaluate("form => form.checkValidity()"),
                    "Valid contact input fails native validation")
            require(page.locator('#name').evaluate(
                "field => field.closest('.floating-label-form-group').classList.contains('floating-label-form-group-with-value')"),
                    "Contact floating label did not react to input")
            print("PASS contact prefill and required/email validation; form not submitted", flush=True)

            for path, total in (("/quiz/", 19), ("/quiz/hund/", 20)):
                load(path)
                overflow(path)
                require(page.locator("#quizContainer fieldset").count() == total,
                        f"Question count changed: {path}")
                require(page.locator("#quizContainer input[type=radio]").count() == total * 5,
                        f"Answer count changed: {path}")
                require(page.locator("#answeredCount").inner_text() == "0",
                        f"Initial progress is incorrect: {path}")
                require(not page.locator("#resultCard").is_visible(),
                        f"Quiz result is already visible: {path}")
                for index in range(1, total + 1):
                    # The radio inputs are visually hidden; click the real visible labels.
                    page.locator(f'label[for="q{index}_A"]').click()
                    require(page.locator(f"#q{index}_A").is_checked(),
                            f"Visible answer selection failed: {path} question {index}")
                require(page.locator("#answeredCount").inner_text() == str(total),
                        f"Answered count is incorrect: {path}")
                require(page.locator("#quizProgress").get_attribute("aria-valuenow") == str(total),
                        f"Accessible progress is incorrect: {path}")
                page.locator("#evalBtn").click()
                require(page.locator("#resultCard").is_visible(), f"Quiz result is hidden: {path}")
                require(page.locator("#resultTitle").inner_text() == "Element Holz",
                        f"All-A quiz result is incorrect: {path}")
                require(page.locator("#resultKicker").text_content() == f"Dein Ergebnis · {total} von {total} Antworten",
                        f"Quiz result counts are incorrect: {path}")
                require(page.locator("#resultImg1").is_visible(), f"Quiz image is hidden: {path}")
                image_health(path)
                overflow(f"{path} result")
                print(f"PASS {path}: {total} visible answers, progress and Holz result with loaded image", flush=True)

            require(not errors, f"JavaScript errors: {errors}")
            require(not missing, f"Missing same-origin assets: {sorted(missing)}")
            require(not blocked, f"Unexpected external or non-GET requests blocked: {sorted(blocked)}")
        finally:
            context.close()
            browser.close()

    print(f"PASS {count} offline browser checks", flush=True)
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("build_dir", type=Path)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    args = parser.parse_args()
    try:
        check(args.build_dir, args.chromium)
    except ImportError:
        parser.exit(1, "FAIL optional browser checks require Playwright; install it in a separate virtual environment.\n")
    except Exception as error:
        parser.exit(1, f"FAIL {error}\n")
