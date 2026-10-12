#!/usr/bin/env node
/** Live, read-only technical audits. This file is development tooling, not site JavaScript. */
import { access, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { launch as launchChrome, Launcher } from 'chrome-launcher';
import { chromium } from 'playwright';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
const metricIds = {
  fcp: 'first-contentful-paint', lcp: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift', tbt: 'total-blocking-time',
  speedIndex: 'speed-index', bytes: 'total-byte-weight',
};
const defaultRoutes = [
  '/', '/behandlung/behandlungsmethoden/', '/behandlung/vorgehen/', '/kurse/',
  '/pages/blog/', '/about/', '/contact/', '/elemente/', '/elemente/hund/',
  '/elemente/holz/', '/quiz/', '/quiz/hund/', '/pages/blog/hund-arthrose/',
];
const headerNames = new Set([
  'cache-control', 'age', 'expires', 'etag', 'last-modified', 'vary',
  'content-encoding', 'content-type', 'server', 'strict-transport-security',
  'content-security-policy', 'x-content-type-options', 'x-frame-options',
  'referrer-policy', 'permissions-policy',
]);

function options(argv) {
  const result = { baseUrl: 'https://tierheilpraxis-jessican.de/', output: '.tools/lighthouse', runs: 1, routes: [] };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--help' || argument === '-h') {
      console.log('Usage: node tools/performance/run-lighthouse.mjs [--output DIR] [--runs 1..5] [--routes /,/contact/] [--base-url URL]\n\nDefault: 13 live routes, mobile and desktop, one run per profile. CHROME_PATH selects an existing Chrome executable. Localhost is supported only for tooling smoke tests.');
      process.exit(0);
    }
    if (!['--base-url', '--output', '--routes', '--runs'].includes(argument) || !argv[i + 1]) {
      throw new Error(`Unknown argument or missing value: ${argument}`);
    }
    const value = argv[++i];
    if (argument === '--routes') result.routes.push(...value.split(','));
    else if (argument === '--runs') result.runs = Number(value);
    else result[argument === '--base-url' ? 'baseUrl' : 'output'] = value;
  }
  const base = new URL(result.baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  const production = ['tierheilpraxis-jessican.de', 'www.tierheilpraxis-jessican.de'].includes(base.hostname);
  if ((!local && !production) || (production && (base.protocol !== 'https:' || base.port)) ||
      (local && !['http:', 'https:'].includes(base.protocol)) || base.username || base.password ||
      base.pathname !== '/' || base.search || base.hash) {
    throw new Error('--base-url must be the production HTTPS origin or a localhost HTTP/HTTPS origin.');
  }
  if (!Number.isInteger(result.runs) || result.runs < 1 || result.runs > 5) {
    throw new Error('--runs must be an integer between 1 and 5.');
  }
  result.routes = [...new Set(result.routes.length ? result.routes : defaultRoutes)];
  for (const route of result.routes) {
    if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(route)) {
      throw new Error(`Route must be an absolute directory path without queries or dot segments: ${route}`);
    }
  }
  result.baseUrl = base.href;
  result.localSmokeTest = local;
  result.output = resolve(repository, result.output);
  return result;
}

async function safeOutput(directory) {
  // Never delete directories or write audit reports into the generated website/source tree.
  const location = relative(repository, directory);
  const inRepository = location === '' || (!location.startsWith(`..${sep}`) && location !== '..' && !isAbsolute(location));
  const allowed = resolve(repository, '.tools/lighthouse');
  if (inRepository && directory !== allowed && !directory.startsWith(`${allowed}${sep}`)) {
    throw new Error('Reports inside the checkout must use .tools/lighthouse or one of its subdirectories.');
  }
  if (!inRepository && !(directory.startsWith('/tmp/') || directory.startsWith('/workspace/'))) {
    throw new Error('External report directories must be below /tmp or /workspace.');
  }
  let existing = directory;
  while (true) {
    try {
      if (await realpath(existing) !== existing) throw new Error('Report directories must not follow symbolic links.');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(existing);
      if (parent === existing) throw error;
      existing = parent;
    }
  }
  await mkdir(directory, { recursive: true });
}

async function save(directory, filename, data) {
  const destination = join(directory, filename);
  try {
    const current = await lstat(destination);
    if (!current.isFile() || current.isSymbolicLink()) throw new Error(`Refusing non-file report target: ${filename}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeFile(destination, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function median(values) {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function publicUrl(url) {
  try {
    const parsed = new URL(url);
    // Query parameters are unnecessary for the public network inventory.
    return `${parsed.origin}${parsed.pathname}`;
  } catch { return url; }
}

function summarizeLhr(lhr, route, profile, run, reports) {
  const categoryAudits = {};
  for (const id of categories) {
    categoryAudits[id] = new Set((lhr.categories[id]?.auditRefs ?? []).map(item => item.id));
  }
  const failedAudits = Object.entries(lhr.audits)
    .filter(([, audit]) => typeof audit.score === 'number' && audit.score < 1)
    .map(([id, audit]) => ({
      id, title: audit.title, score: audit.score, displayValue: audit.displayValue ?? null,
      description: audit.description, numericValue: audit.numericValue ?? null,
      categories: categories.filter(category => categoryAudits[category].has(id)),
      details: audit.details ?? null,
    }));
  const diagnostics = Object.values(lhr.audits)
    .filter(audit => audit.scoreDisplayMode === 'error')
    .map(audit => ({ id: audit.id, title: audit.title, errorMessage: audit.errorMessage }));
  return {
    route, profile, run, requestedUrl: lhr.requestedUrl, finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl,
    fetchTime: lhr.fetchTime, lighthouseVersion: lhr.lighthouseVersion,
    userAgent: lhr.userAgent, environment: lhr.environment, settings: lhr.configSettings,
    categories: Object.fromEntries(categories.map(id => [id, Math.round((lhr.categories[id]?.score ?? 0) * 100)])),
    metrics: Object.fromEntries(Object.entries(metricIds).map(([name, id]) => [name, lhr.audits[id]?.numericValue ?? null])),
    runWarnings: lhr.runWarnings, auditErrors: diagnostics, failedAudits, reports,
  };
}

function proxySettings(baseUrl) {
  // Preserve the session's HTTPS proxy when present; localhost smoke tests stay local.
  if (['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname)) return undefined;
  const value = process.env.HTTPS_PROXY || process.env.https_proxy;
  return value ? { server: value } : undefined;
}

async function lighthouseRun(url, route, profile, run, executablePath, output) {
  const proxy = proxySettings(url);
  const chromeFlags = ['--headless=new', '--disable-dev-shm-usage', '--no-sandbox'];
  if (proxy) chromeFlags.push(`--proxy-server=${proxy.server}`);
  const chrome = await launchChrome({ chromePath: executablePath, chromeFlags, logLevel: 'error' });
  try {
    const result = await lighthouse(url, {
      port: chrome.port, logLevel: 'error', output: ['json', 'html'],
      onlyCategories: categories, throttlingMethod: 'simulate',
      maxWaitForLoad: 45000, enableErrorReporting: false,
    }, profile === 'desktop' ? desktopConfig : undefined);
    if (!result?.lhr) throw new Error('Lighthouse returned no report.');
    const slug = route === '/' ? 'home' : route.slice(1, -1).replaceAll('/', '_');
    const filename = `${slug}-${profile}-${run}`;
    const reports = { json: `${filename}.json`, html: `${filename}.html` };
    await save(output, reports.json, result.report[0]);
    await save(output, reports.html, result.report[1]);
    if (result.lhr.runtimeError) throw new Error(`${result.lhr.runtimeError.code}: ${result.lhr.runtimeError.message}`);
    if (categories.some(id => !Number.isFinite(result.lhr.categories[id]?.score))) {
      throw new Error('One or more Lighthouse category scores are missing.');
    }
    return summarizeLhr(result.lhr, route, profile, run, reports);
  } finally {
    await chrome.kill();
  }
}

async function browserAudit(browser, baseUrl, route, profile) {
  const context = await browser.newContext({
    viewport: profile === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: profile === 'mobile', deviceScaleFactor: profile === 'mobile' ? 2 : 1,
  });
  const result = {
    route, profile, complete: false, passed: false, requests: [], externalRequests: [],
    disallowedMethods: [], failedRequests: [], httpErrors: [], browserErrors: [],
    responseHeaders: [], setCookieHeaders: [], cookies: [], storage: null,
  };
  const responseTasks = [];
  const siteHosts = new Set(['tierheilpraxis-jessican.de', 'www.tierheilpraxis-jessican.de', new URL(baseUrl).hostname]);
  await context.route('**/*', intercepted => {
    if (!['GET', 'HEAD'].includes(intercepted.request().method())) {
      result.disallowedMethods.push({ url: publicUrl(intercepted.request().url()), method: intercepted.request().method() });
      return intercepted.abort('blockedbyclient');
    }
    return intercepted.continue();
  });
  context.on('request', request => {
    const url = new URL(request.url());
    const record = { url: publicUrl(request.url()), method: request.method(), resourceType: request.resourceType() };
    result.requests.push(record);
    if (['http:', 'https:'].includes(url.protocol) && !siteHosts.has(url.hostname)) result.externalRequests.push(record);
  });
  context.on('requestfailed', request => result.failedRequests.push({ url: publicUrl(request.url()), error: request.failure()?.errorText }));
  context.on('response', response => {
    responseTasks.push((async () => {
      const headers = await response.headersArray();
      result.responseHeaders.push({
        url: publicUrl(response.url()), status: response.status(), resourceType: response.request().resourceType(),
        headers: Object.fromEntries(headers.filter(header => headerNames.has(header.name.toLowerCase())).map(header => [header.name.toLowerCase(), header.value])),
      });
      for (const header of headers.filter(header => header.name.toLowerCase() === 'set-cookie')) {
        result.setCookieHeaders.push({ url: publicUrl(response.url()), name: header.value.split('=', 1)[0].trim() });
      }
      if (response.status() >= 400) result.httpErrors.push({ url: publicUrl(response.url()), status: response.status() });
    })());
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.browserErrors.push(error.message));
  try {
    const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle', timeout: 45000 });
    if (!response?.ok()) throw new Error(`Navigation failed: HTTP ${response?.status() ?? 'no response'}`);
    if (!siteHosts.has(new URL(page.url()).hostname)) throw new Error('Navigation left the audited website.');
    // Read the whole document, including lazy images. No links, quiz answers, or forms are clicked.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = profile === 'mobile' ? 650 : 750;
    for (let y = 0; y < height; y += step) {
      await page.evaluate(value => window.scrollTo(0, value), y);
      await page.waitForTimeout(120);
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    result.storage = await page.evaluate(async () => ({
      localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage),
      indexedDbNames: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map(database => database.name) : [],
      cacheNames: 'caches' in globalThis ? await caches.keys() : [],
      serviceWorkers: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).map(registration => ({ scope: registration.scope, scriptUrl: registration.active?.scriptURL ?? null })) : [],
      documentCookieNames: document.cookie ? document.cookie.split(';').map(cookie => cookie.trim().split('=', 1)[0]) : [],
    }));
    result.cookies = (await context.cookies()).map(({ name, domain, path, httpOnly, secure, sameSite }) => ({ name, domain, path, httpOnly, secure, sameSite }));
    await Promise.all(responseTasks);
    result.complete = true;
    result.passed = result.cookies.length === 0 && result.setCookieHeaders.length === 0 &&
      result.externalRequests.length === 0 && result.disallowedMethods.length === 0 &&
      result.failedRequests.length === 0 && result.httpErrors.length === 0 && result.browserErrors.length === 0 &&
      result.storage.localStorageKeys.length === 0 && result.storage.sessionStorageKeys.length === 0 &&
      result.storage.indexedDbNames.length === 0 && result.storage.cacheNames.length === 0 && result.storage.serviceWorkers.length === 0;
  } catch (error) {
    result.error = error.message;
    await Promise.allSettled(responseTasks);
  } finally {
    await context.close();
  }
  return result;
}

function aggregate(measurements, routes) {
  return routes.flatMap(route => ['mobile', 'desktop'].map(profile => {
    const group = measurements.filter(item => item.route === route && item.profile === profile);
    return {
      route, profile, completedRuns: group.length,
      categories: Object.fromEntries(categories.map(id => [id, median(group.map(item => item.categories[id]))])),
      metrics: Object.fromEntries(Object.keys(metricIds).map(id => [id, median(group.map(item => item.metrics[id]))])),
    };
  }));
}

function markdown(summary) {
  const lines = [
    '# Lighthouse technical audit', '',
    `Measured: ${summary.startedAt}. Lighthouse ${summary.lighthouseVersion}, Chrome ${summary.chromeVersion ?? 'unavailable'}.`, '',
    `Target: ${summary.baseUrl}. ${summary.localSmokeTest ? '**Local tooling smoke test: these are not production measurements.**' : 'Real production requests with standard Lighthouse simulated mobile/desktop throttling.'}`, '',
    `Completed: ${summary.measurements.length}/${summary.expectedMeasurements} Lighthouse measurements, ${summary.privacyAudit.length}/${summary.expectedPrivacyAudits} cookie/storage/network audits.`, '',
    '| Page | Profile | Performance | Accessibility | Best practices | SEO | FCP (s) | LCP (s) | CLS | TBT (ms) | Bytes |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  const number = (value, divisor = 1, digits = 0) => value === null ? '—' : (value / divisor).toFixed(digits);
  for (const item of summary.aggregates) {
    const { categories: c, metrics: m } = item;
    lines.push(`| ${item.route} | ${item.profile} | ${number(c.performance)} | ${number(c.accessibility)} | ${number(c['best-practices'])} | ${number(c.seo)} | ${number(m.fcp, 1000, 2)} | ${number(m.lcp, 1000, 2)} | ${number(m.cls, 1, 3)} | ${number(m.tbt)} | ${number(m.bytes)} |`);
  }
  lines.push('', 'Scores are lab measurements, not real-user Core Web Vitals. Performance varies between runs; repeated runs use the median. A deliberate noindex directive can lower the SEO score.', '',
    '## Cookies, storage and external requests', '',
    `Technical checks passed: ${summary.privacyAudit.filter(item => item.passed).length}/${summary.expectedPrivacyAudits}.`, '',
    'Each page/profile starts in a fresh browser context and is scrolled to load lazy resources. Cookie names and storage keys are recorded without their values. Forms are not submitted; outgoing social links are not opened. HTTP cache headers describe browser caching and do not imply cookie use. These checks do not decide legal consent requirements.', '');
  for (const item of summary.privacyAudit.filter(audit => !audit.passed)) {
    lines.push(`- ${item.route} (${item.profile}): ${item.error ?? `cookies=${item.cookies.length}, Set-Cookie=${item.setCookieHeaders.length}, external requests=${item.externalRequests.length}, HTTP errors=${item.httpErrors.length}, browser errors=${item.browserErrors.length}, request errors=${item.failedRequests.length}, disallowed methods=${item.disallowedMethods.length}, storage=${JSON.stringify(item.storage)}`}`);
  }
  if (summary.errors.length) lines.push('', '## Incomplete measurements', '', ...summary.errors.map(error => `- ${error.route ?? 'setup'} (${error.profile ?? 'all'}${error.run ? `, run ${error.run}` : ''}): ${error.message}`));
  return `${lines.join('\n')}\n`;
}

async function main() {
  const config = options(process.argv.slice(2));
  await safeOutput(config.output);
  const packageJson = JSON.parse(await readFile(join(repository, 'tools/performance/package.json'), 'utf8'));
  const summary = {
    schemaVersion: 1, startedAt: new Date().toISOString(), completedAt: null,
    baseUrl: config.baseUrl, localSmokeTest: config.localSmokeTest,
    sourceSha: process.env.AUDIT_SOURCE_SHA ?? null, workflowRunUrl: process.env.AUDIT_RUN_URL ?? null,
    lighthouseVersion: packageJson.devDependencies.lighthouse, playwrightVersion: packageJson.devDependencies.playwright,
    runsPerProfile: config.runs, routes: config.routes,
    expectedMeasurements: config.routes.length * 2 * config.runs,
    expectedPrivacyAudits: config.routes.length * 2,
    measurements: [], aggregates: [], privacyAudit: [], errors: [], complete: false,
  };
  let browser;
  try {
    const executablePath = process.env.CHROME_PATH || Launcher.getInstallations()[0];
    if (!executablePath) throw new Error('No Chrome executable found; set CHROME_PATH.');
    await access(executablePath, constants.X_OK);
    browser = await chromium.launch({ executablePath, headless: true, proxy: proxySettings(config.baseUrl), args: ['--disable-dev-shm-usage', '--no-sandbox'] });
    summary.chromeVersion = browser.version();
    for (const route of config.routes) {
      for (const profile of ['mobile', 'desktop']) {
        console.log(`Privacy/network: ${route} (${profile})`);
        const privacy = await browserAudit(browser, config.baseUrl, route, profile);
        summary.privacyAudit.push(privacy);
        if (!privacy.complete) summary.errors.push({ route, profile, message: `Browser audit: ${privacy.error}` });
        for (let run = 1; run <= config.runs; run++) {
          console.log(`Lighthouse: ${route} (${profile}, ${run}/${config.runs})`);
          try {
            const measurement = await lighthouseRun(new URL(route, config.baseUrl).href, route, profile, run, executablePath, config.output);
            summary.measurements.push(measurement);
            console.log(`Scores ${JSON.stringify(measurement.categories)}; LCP ${Math.round(measurement.metrics.lcp)} ms; CLS ${measurement.metrics.cls}`);
          } catch (error) {
            summary.errors.push({ route, profile, run, message: error.message });
            console.error(`Measurement failed: ${route} (${profile}): ${error.message}`);
          }
        }
        // Preserve progress if a runner timeout interrupts a later route.
        summary.aggregates = aggregate(summary.measurements, config.routes);
        await save(config.output, 'summary.json', summary);
        await save(config.output, 'summary.md', markdown(summary));
      }
    }
  } catch (error) {
    summary.errors.push({ message: error.message });
    console.error(`Audit setup failed: ${error.message}`);
  } finally {
    if (browser) await browser.close();
    summary.completedAt = new Date().toISOString();
    summary.aggregates = aggregate(summary.measurements, config.routes);
    summary.complete = summary.errors.length === 0 && summary.measurements.length === summary.expectedMeasurements &&
      summary.privacyAudit.length === summary.expectedPrivacyAudits && summary.privacyAudit.every(audit => audit.complete);
    summary.privacyPassed = summary.privacyAudit.length === summary.expectedPrivacyAudits && summary.privacyAudit.every(audit => audit.passed);
    await save(config.output, 'summary.json', summary);
    await save(config.output, 'summary.md', markdown(summary));
  }
  console.log(`Audit ${summary.complete ? 'complete' : 'incomplete'}; privacy/network ${summary.privacyPassed ? 'passed' : 'failed'}. Reports: ${config.output}`);
  if (!summary.complete || !summary.privacyPassed) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
