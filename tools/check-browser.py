#!/usr/bin/env python3
"""Smoke-test JessICan in Chromium, using a generated build or live HTTPS responses.

Usage: python3 tools/check-browser.py BUILD_DIR [--chromium /usr/bin/chromium]
Requires Playwright and Chromium. Every request is fulfilled from BUILD_DIR or
blocked by default. --live instead fetches production response bytes through
the inherited proxy and CA trust. External requests and non-GET methods are
always blocked, and the contact form is never submitted.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import urllib.request
from pathlib import Path
from urllib.parse import unquote, urlencode, urlsplit


ORIGIN = "https://tierheilpraxis-jessican.de"


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urlsplit(newurl)
        if f"{url.scheme}://{url.netloc}" != ORIGIN:
            raise ValueError(f"Unexpected HTTPS redirect target: {newurl}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def check(root: Path, executable: str, live: bool = False,
          report: dict | None = None) -> int:
    from playwright.sync_api import sync_playwright

    root = root.resolve()
    if not (root / "index.html").is_file():
        raise ValueError(f"Generated index.html is missing: {root}")

    count = 0
    errors: list[str] = []
    missing: set[str] = set()
    blocked: set[str] = set()
    network: dict[str, dict] = {}
    if report is not None:
        report.update(mode="live" if live else "offline", origin=ORIGIN,
                      form_submitted=False, tls_verification=live, checks=0,
                      passed=False, network=network)
    opener = urllib.request.build_opener(SameOriginRedirect()) if live else None

    def require(condition: bool, description: str) -> None:
        nonlocal count
        if not condition:
            raise ValueError(description)
        count += 1
        if report is not None:
            report['checks'] = count

    def respond(route) -> None:
        request = route.request
        url = urlsplit(request.url)
        if f"{url.scheme}://{url.netloc}" != ORIGIN or request.method != "GET":
            blocked.add(request.url)
            route.abort()
            return
        if live:
            try:
                # These are real production responses, never BUILD_DIR bytes.
                # urllib preserves the environment's proxy and certificate trust.
                headers = {"User-Agent": "JessICan-live-browser-validation/1.0",
                           "Accept-Encoding": "identity", "Cache-Control": "no-cache"}
                with opener.open(urllib.request.Request(request.url, headers=headers),
                                 timeout=25) as response:
                    data = response.read()
                    network[request.url] = {"status": response.status, "bytes": len(data),
                                            "final_url": response.url}
                    route.fulfill(status=response.status, body=data,
                                  content_type=response.headers.get("Content-Type")
                                  or "application/octet-stream")
            except Exception as error:
                network[request.url] = {"error": f"{type(error).__name__}: {error}"}
                missing.add(url.path)
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
        if live:
            page.set_default_navigation_timeout(90_000)
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
            privacy = page.get_by_role("checkbox", name="Ich habe den Hinweis")
            require(privacy.is_visible() and not privacy.is_checked(),
                    "Privacy acknowledgement must start visible and unchecked")
            require(privacy.evaluate("field => field.required && field.validity.valueMissing"),
                    "Privacy acknowledgement lost native required validation")
            require(not form.evaluate("form => form.checkValidity()"),
                    "Otherwise valid contact input must require acknowledgement")
            page.locator("#sendMessageButton").click()
            require(privacy.evaluate("field => document.activeElement === field"),
                    "Browser did not focus missing acknowledgement on attempted submission")
            require(not blocked, "Attempt without acknowledgement made a network request")
            privacy.press("Space")
            require(privacy.is_checked(), "Keyboard could not acknowledge privacy notice")
            require(form.evaluate("form => form.checkValidity()"),
                    "Valid contact input with acknowledgement fails native validation")
            require(form.evaluate("form => !new FormData(form).has('privacy-notice-read')")
                    and privacy.get_attribute("name") is None,
                    "Local privacy acknowledgement must not be sent to Formspree")
            page.locator('label[for="privacy-notice-read"]').click(position={"x": 10, "y": 10})
            require(not privacy.is_checked() and not form.evaluate("form => form.checkValidity()"),
                    "Visible label could not revoke acknowledgement")
            require(page.locator('#name').evaluate(
                "field => field.closest('.floating-label-form-group').classList.contains('floating-label-form-group-with-value')"),
                    "Contact floating label did not react to input")
            page.get_by_role("link", name="Datenschutzerklärung", exact=True).click()
            page.wait_for_load_state("networkidle")
            require(page.url == ORIGIN + "/impressum/#kontaktformular-datenschutz"
                    and page.locator("#kontaktformular-datenschutz").count() == 1,
                    "Contact privacy link did not reach the local Formspree notice")
            overflow("mobile privacy notice")
            print("PASS contact prefill, required/email validation and local privacy acknowledgement; no POST sent",
                  flush=True)

            no_js_context = browser.new_context(viewport={"width": 390, "height": 844},
                                                java_script_enabled=False, service_workers="block")
            no_js_context.route("**/*", respond)
            try:
                no_js_page = no_js_context.new_page()
                no_js_page.set_default_timeout(10_000)
                if live:
                    no_js_page.set_default_navigation_timeout(90_000)
                response = no_js_page.goto(ORIGIN + "/contact/", wait_until="networkidle")
                require(response is not None and response.status == 200,
                        "Contact form without JavaScript failed to load")
                no_js_page.locator("#name").fill("Umgebungstest")
                no_js_page.locator("#email").fill("test@example.invalid")
                no_js_page.locator("#message").fill("Browserprüfung ohne Versand.")
                no_js_form = no_js_page.locator('form[name="contact"]')
                require(not no_js_form.evaluate("form => form.checkValidity()"),
                        "Missing acknowledgement must prevent validation without JavaScript")
                # Keyboard actions also work when page JavaScript (including the
                # animation frames used by click stability checks) is disabled.
                no_js_page.locator("#sendMessageButton").focus()
                no_js_page.keyboard.press("Enter")
                require(no_js_page.locator("#privacy-notice-read").evaluate(
                    "field => document.activeElement === field"),
                        "Native acknowledgement must block attempted submission without JavaScript")
                no_js_page.locator("#privacy-notice-read").press("Space")
                require(no_js_form.evaluate("form => form.checkValidity()"),
                        "Acknowledged contact form must validate without JavaScript")
                require(not blocked, "Contact form without JavaScript sent a network request")
            finally:
                no_js_context.close()
            print("PASS native privacy validation with JavaScript disabled; no POST sent", flush=True)

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

    if report is not None:
        report['passed'] = True
    print(f"PASS {count} {'live' if live else 'offline'} browser checks", flush=True)
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("build_dir", type=Path)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--live", action="store_true", help="Fetch real HTTPS production responses")
    parser.add_argument("--output", type=Path, help="Optional JSON validation report outside BUILD_DIR")
    args = parser.parse_args()
    report = {"passed": False}
    status = 0
    output_allowed = not args.output or not args.output.resolve().is_relative_to(args.build_dir.resolve())
    try:
        if not output_allowed:
            raise ValueError("Validation output must stay outside the published build")
        check(args.build_dir, args.chromium, args.live, report)
    except ImportError:
        report['error'] = "Optional browser checks require Playwright; install it in a separate virtual environment."
        status = 1
    except Exception as error:
        report['error'] = f"{type(error).__name__}: {error}"
        status = 1
    if args.output and output_allowed:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    if status:
        parser.exit(status, f"FAIL {report['error']}\n")
