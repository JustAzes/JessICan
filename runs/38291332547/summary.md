# Lighthouse technical audit

Measured: 2026-10-12T18:30:30.237Z. Lighthouse 13.5.0, Chrome 154.0.8037.97.

Target: https://tierheilpraxis-jessican.de/. Real production requests with standard Lighthouse simulated mobile/desktop throttling.

Completed: 26/26 Lighthouse measurements, 26/26 cookie/storage/network audits.

| Page | Profile | Performance | Accessibility | Best practices | SEO | FCP (s) | LCP (s) | CLS | TBT (ms) | Bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| / | mobile | 99 | 100 | 100 | 100 | 1.27 | 1.83 | 0.023 | 0 | 271443 |
| / | desktop | 100 | 100 | 100 | 100 | 0.33 | 0.45 | 0.006 | 0 | 538852 |
| /behandlung/behandlungsmethoden/ | mobile | 99 | 100 | 100 | 100 | 1.07 | 1.82 | 0.010 | 0 | 296103 |
| /behandlung/behandlungsmethoden/ | desktop | 100 | 100 | 100 | 100 | 0.49 | 0.61 | 0.008 | 0 | 1385826 |
| /behandlung/vorgehen/ | mobile | 98 | 100 | 100 | 100 | 1.11 | 2.39 | 0.000 | 2 | 289265 |
| /behandlung/vorgehen/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.50 | 0.000 | 0 | 289310 |
| /kurse/ | mobile | 100 | 100 | 100 | 100 | 0.98 | 1.88 | 0.000 | 0 | 286886 |
| /kurse/ | desktop | 100 | 100 | 100 | 100 | 0.31 | 0.43 | 0.000 | 0 | 291904 |
| /pages/blog/ | mobile | 97 | 100 | 100 | 66 | 0.93 | 2.58 | 0.000 | 0 | 356433 |
| /pages/blog/ | desktop | 100 | 100 | 100 | 66 | 0.29 | 0.53 | 0.000 | 0 | 356428 |
| /about/ | mobile | 94 | 100 | 100 | 100 | 1.23 | 3.03 | 0.000 | 0 | 500467 |
| /about/ | desktop | 100 | 100 | 100 | 100 | 0.33 | 0.65 | 0.000 | 0 | 558320 |
| /contact/ | mobile | 98 | 100 | 100 | 100 | 1.24 | 2.44 | 0.000 | 0 | 310272 |
| /contact/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.49 | 0.000 | 0 | 310245 |
| /elemente/ | mobile | 100 | 100 | 100 | 100 | 1.04 | 1.34 | 0.000 | 3 | 70413 |
| /elemente/ | desktop | 100 | 100 | 100 | 100 | 0.26 | 0.30 | 0.000 | 0 | 70279 |
| /elemente/hund/ | mobile | 100 | 100 | 100 | 100 | 0.94 | 1.24 | 0.000 | 0 | 611057 |
| /elemente/hund/ | desktop | 100 | 100 | 100 | 100 | 0.31 | 0.35 | 0.000 | 0 | 611156 |
| /elemente/holz/ | mobile | 100 | 100 | 100 | 100 | 0.95 | 1.92 | 0.000 | 0 | 338640 |
| /elemente/holz/ | desktop | 100 | 100 | 100 | 100 | 0.25 | 0.33 | 0.000 | 0 | 177084 |
| /quiz/ | mobile | 100 | 100 | 100 | 100 | 0.94 | 1.27 | 0.000 | 0 | 76007 |
| /quiz/ | desktop | 100 | 100 | 100 | 100 | 0.24 | 0.29 | 0.007 | 0 | 76045 |
| /quiz/hund/ | mobile | 100 | 100 | 100 | 100 | 0.95 | 1.27 | 0.000 | 0 | 77478 |
| /quiz/hund/ | desktop | 100 | 100 | 100 | 100 | 0.24 | 0.29 | 0.000 | 0 | 77463 |
| /pages/blog/hund-arthrose/ | mobile | 98 | 100 | 100 | 100 | 1.16 | 2.36 | 0.002 | 0 | 310059 |
| /pages/blog/hund-arthrose/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.45 | 0.000 | 0 | 339233 |

Scores are lab measurements, not real-user Core Web Vitals. Performance varies between runs; repeated runs use the median. A deliberate noindex directive can lower the SEO score.

## Cookies, storage and external requests

Technical checks passed: 26/26.

Each page/profile starts in a fresh browser context and is scrolled to load lazy resources. Cookie names and storage keys are recorded without their values. Forms are not submitted; outgoing social links are not opened. HTTP cache headers describe browser caching and do not imply cookie use. These checks do not decide legal consent requirements.

