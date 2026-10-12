#!/usr/bin/env python3
"""GET-only HTTPS validation of production against an existing generated build.

Keeps inherited proxy and CA configuration. Never runs Zola or writes the build.
Uses every HTML route, referenced assets, CSS dependencies, manifest icons and
quiz result images by default; --all-files expands to every public build file.
Waits for the deployed homepage, CSS and manifest before comparing the rest.

Usage: python3 tools/check-live-site.py --build .tools/site --all-files
"""
from __future__ import annotations
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit

ORIGIN = 'https://tierheilpraxis-jessican.de'
SITE_HOSTS = {'tierheilpraxis-jessican.de', 'www.tierheilpraxis-jessican.de'}

class AssetRefs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in {'img', 'script', 'source', 'video', 'audio'} and a.get('src'):
            self.refs.append(a['src'])
        if tag == 'link' and a.get('href') and set((a.get('rel') or '').split()) & {
            'stylesheet', 'preload', 'icon', 'manifest', 'apple-touch-icon',
            'apple-touch-startup-image', 'mask-icon'
        }:
            self.refs.append(a['href'])
        if a.get('srcset'):
            self.refs.extend(x.strip().split()[0] for x in a['srcset'].split(',') if x.strip())
        if a.get('style'):
            self.refs.extend(css_urls(a['style']))

def css_urls(css):
    return [m.group(1).strip().strip('\"\'') for m in re.finditer(r'url\((.*?)\)', css)]

def public_path(file, root):
    rel = file.relative_to(root).as_posix()
    return '/' + (rel[:-10] if rel.endswith('index.html') else rel)

def local_file(path, root):
    file = (root / unquote(path).lstrip('/')).resolve()
    if not file.is_relative_to(root):
        raise ValueError('Path leaves the build: ' + path)
    return file / 'index.html' if file.is_dir() else file

def plan(root, all_files):
    selected = {}
    external = set()
    missing = []
    def add(ref, base=ORIGIN + '/'):
        url = urlsplit(urljoin(base, ref))
        if url.scheme not in {'http', 'https'}:
            return
        if url.hostname not in SITE_HOSTS:
            external.add(url.hostname)
            return
        file = local_file(url.path, root)
        if not file.is_file():
            missing.append({'path':url.path,'referenced_from':base})
            return
        selected[url.path] = file
    for file in sorted(root.rglob('*.html')):
        route = public_path(file, root)
        selected[route] = file
        refs = AssetRefs()
        refs.feed(file.read_text())
        for ref in refs.refs:
            add(ref, ORIGIN + route)
    for file in root.rglob('*.css'):
        add(public_path(file, root))
        for ref in css_urls(file.read_text()):
            add(ref, ORIGIN + public_path(file, root))
    for file in root.rglob('*.webmanifest'):
        manifest = json.loads(file.read_text())
        for icon in manifest.get('icons', []):
            add(icon['src'], ORIGIN + public_path(file, root))
    for ref in ('/sitemap.xml', '/robots.txt', '/favicon.ico',
                '/documents/Anamnesefragebogen_Hund.pdf',
                '/documents/Anamnesefragebogen_Pferd.pdf',
                '/img/quiz/holz.jpg', '/img/quiz/feuer.jpg', '/img/quiz/erde.jpg',
                '/img/quiz/metall.jpg', '/img/quiz/wasser.jpg', '/css/bootstrap.min.css.map'):
        add(ref)
    if all_files:
        for file in root.rglob('*'):
            if file.is_file() and not file.name.startswith('.'):
                selected[public_path(file, root)] = file
    return selected, sorted(h for h in external if h), missing

class RestrictedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        split = urlsplit(newurl)
        if split.scheme != 'https' or split.hostname not in SITE_HOSTS:
            raise ValueError('Unsafe or unexpected redirect target: ' + newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def request(path, cache_key, timeout):
    url = ORIGIN + quote(path, safe='/%:@')
    if cache_key:
        url += '?codex_validation=' + quote(cache_key, safe='')
    headers = {'User-Agent': 'JessICan-publish-validation/1.0',
               'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache'}
    opener = urllib.request.build_opener(RestrictedRedirect())
    with opener.open(urllib.request.Request(url, headers=headers), timeout=timeout) as response:
        return response.status, response.url, response.headers, response.read()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', type=Path, default=Path('.tools/site'))
    parser.add_argument('--output', type=Path, default=Path('.tools/live-http-results.json'))
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--timeout', type=int, default=25)
    parser.add_argument('--cache-key', default='')
    parser.add_argument('--wait-seconds', type=float, default=180,
                        help='Maximum wait for Pages to serve the expected publication')
    parser.add_argument('--all-files', action='store_true')
    parser.add_argument('--plan', action='store_true')
    args = parser.parse_args()
    root = args.build.resolve()
    if args.output.resolve().is_relative_to(root):
        raise ValueError('Validation output must stay outside the published build')
    if args.timeout <= 0 or args.wait_seconds < 0:
        raise ValueError('timeout must be positive and wait-seconds must be nonnegative')
    if not (root / 'index.html').is_file():
        raise ValueError('Existing build index.html is required')
    selected, external, missing = plan(root, args.all_files)
    report = {'origin': ORIGIN, 'generated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'expected_routes': len(selected), 'expected_files': len(set(selected.values())),
              'external_asset_hosts': external,
              'missing_local_references':missing,
              'tls_verification': True, 'proxy': 'inherited', 'method': 'GET only', 'results': []}
    def check(path, timeout=None):
        expected = selected[path].read_bytes()
        item = {'path': path, 'expected_bytes': len(expected), 'expected_sha256': hashlib.sha256(expected).hexdigest()}
        try:
            status, final, headers, data = request(path, args.cache_key, timeout or args.timeout)
            item.update(status=status, final_url=final, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                        content_type=headers.get('Content-Type'), etag=headers.get('ETag'))
            item['pass'] = status == 200 and data == expected
            if path == '/css/bootstrap.min.css':
                item['bootstrap_5_3_8'] = re.search(rb'Bootstrap\s+v5\.3\.8\b', data) is not None
                item['pass'] = item['pass'] and item['bootstrap_5_3_8']
            if not item['pass']:
                item['error'] = 'HTTP status or live bytes differ from the validated local build'
        except Exception as error:
            item.update({'pass': False, 'error': type(error).__name__ + ': ' + str(error)})
        return item
    if args.plan:
        report['paths'] = sorted(selected)
        print(json.dumps({k:v for k,v in report.items() if k not in {'paths','results'}}, indent=2))
    else:
        # A branch publication can precede Pages' CDN propagation. Check three
        # independently changed files before claiming the expected build is live.
        sentinels = ('/', '/clean-blog.css', '/favicons/site.webmanifest')
        started = time.monotonic()
        deadline = started + args.wait_seconds
        attempt = 0
        ready = False
        latest = []
        if not missing:
            while True:
                attempt += 1
                latest = []
                for path in sentinels:
                    remaining = max(0.1, deadline - time.monotonic())
                    item = check(path, min(args.timeout, remaining) if args.wait_seconds else args.timeout)
                    latest.append(item)
                    if 'Tunnel connection failed: 403' in item.get('error', ''):
                        break
                ready = len(latest) == len(sentinels) and all(item['pass'] for item in latest)
                proxy_denied = any('Tunnel connection failed: 403' in item.get('error', '') for item in latest)
                if ready or proxy_denied or time.monotonic() >= deadline:
                    break
                print(f'Waiting for Pages publication: attempt {attempt}; '
                      f'{sum(item["pass"] for item in latest)}/{len(sentinels)} expected files ready', flush=True)
                time.sleep(min(5, max(0, deadline - time.monotonic())))
        report['publication_wait'] = {'ready': ready, 'attempts': attempt,
                                      'seconds': round(time.monotonic() - started, 2),
                                      'maximum_seconds': args.wait_seconds,
                                      'sentinel_results': latest}
        report['results'].extend(latest)
        if ready:
            print('PASS expected homepage, CSS and manifest are live', flush=True)
            checked_paths = {item['path'] for item in latest}
            with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,8))) as executor:
                futures = [executor.submit(check, p) for p in sorted(selected) if p not in checked_paths]
                for future in concurrent.futures.as_completed(futures):
                    item = future.result()
                    report['results'].append(item)
                    if not item['pass']:
                        print('FAIL ' + item['path'] + ': ' + item.get('error',''), flush=True)
                    elif len(report['results']) % 25 == 0:
                        print('Validated ' + str(len(report['results'])) + '/' + str(len(selected)), flush=True)
        report['passed'] = sum(r['pass'] for r in report['results'])
        report['failed'] = len(report['results']) - report['passed']
        report['complete'] = len(report['results']) == len(selected) and not missing
        report['unrun'] = len(selected) - len(report['results'])
        print(json.dumps({k:v for k,v in report.items() if k != 'results'}, indent=2))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    if missing or (not args.plan and (report['failed'] or not report['complete'])):
        sys.exit(1)

if __name__ == '__main__':
    main()
