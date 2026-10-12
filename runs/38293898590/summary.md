# Lighthouse technical audit

Measured: 2026-10-12T18:53:16.656Z. Lighthouse 13.5.0, Chrome 154.0.8037.97.

Target: https://tierheilpraxis-jessican.de/. Real production requests with standard Lighthouse simulated mobile/desktop throttling.

Completed: 26/26 Lighthouse measurements, 26/26 cookie/storage/network audits.

| Page | Profile | Performance | Accessibility | Best practices | SEO | FCP (s) | LCP (s) | CLS | TBT (ms) | Bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| / | mobile | 99 | 100 | 100 | 100 | 1.40 | 1.70 | 0.023 | 0 | 271419 |
| / | desktop | 100 | 100 | 100 | 100 | 0.34 | 0.38 | 0.007 | 0 | 538878 |
| /behandlung/behandlungsmethoden/ | mobile | 100 | 100 | 100 | 100 | 0.91 | 1.66 | 0.010 | 0 | 296202 |
| /behandlung/behandlungsmethoden/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.42 | 0.008 | 0 | 1386188 |
| /behandlung/vorgehen/ | mobile | 98 | 100 | 100 | 100 | 1.12 | 2.40 | 0.000 | 9 | 289399 |
| /behandlung/vorgehen/ | desktop | 100 | 100 | 100 | 100 | 0.31 | 0.51 | 0.000 | 0 | 289367 |
| /kurse/ | mobile | 99 | 100 | 100 | 100 | 1.23 | 1.83 | 0.000 | 0 | 286867 |
| /kurse/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.39 | 0.000 | 0 | 292026 |
| /pages/blog/ | mobile | 99 | 100 | 100 | 66 | 1.25 | 2.00 | 0.000 | 0 | 218428 |
| /pages/blog/ | desktop | 100 | 100 | 100 | 66 | 0.29 | 0.41 | 0.000 | 0 | 218498 |
| /about/ | mobile | 99 | 100 | 100 | 100 | 1.23 | 2.13 | 0.000 | 0 | 329895 |
| /about/ | desktop | 100 | 100 | 100 | 100 | 0.34 | 0.54 | 0.000 | 0 | 387749 |
| /contact/ | mobile | 98 | 100 | 100 | 100 | 1.23 | 2.43 | 0.000 | 0 | 310250 |
| /contact/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.50 | 0.000 | 0 | 310246 |
| /elemente/ | mobile | 100 | 100 | 100 | 100 | 0.97 | 1.27 | 0.000 | 19 | 70309 |
| /elemente/ | desktop | 100 | 100 | 100 | 100 | 0.27 | 0.31 | 0.000 | 0 | 70273 |
| /elemente/hund/ | mobile | 99 | 100 | 100 | 100 | 0.92 | 2.27 | 0.000 | 0 | 611031 |
| /elemente/hund/ | desktop | 100 | 100 | 100 | 100 | 0.26 | 0.50 | 0.000 | 0 | 611162 |
| /elemente/holz/ | mobile | 100 | 100 | 100 | 100 | 0.96 | 1.93 | 0.000 | 2 | 338721 |
| /elemente/holz/ | desktop | 100 | 100 | 100 | 100 | 0.27 | 0.35 | 0.000 | 0 | 177119 |
| /quiz/ | mobile | 100 | 100 | 100 | 100 | 0.90 | 1.24 | 0.000 | 0 | 76040 |
| /quiz/ | desktop | 100 | 100 | 100 | 100 | 0.24 | 0.29 | 0.007 | 0 | 76111 |
| /quiz/hund/ | mobile | 100 | 100 | 100 | 100 | 0.95 | 1.24 | 0.000 | 0 | 77494 |
| /quiz/hund/ | desktop | 100 | 100 | 100 | 100 | 0.25 | 0.30 | 0.000 | 0 | 77519 |
| /pages/blog/hund-arthrose/ | mobile | 99 | 100 | 100 | 100 | 1.24 | 2.14 | 0.002 | 0 | 310165 |
| /pages/blog/hund-arthrose/ | desktop | 100 | 100 | 100 | 100 | 0.34 | 0.50 | 0.000 | 0 | 339233 |

Scores are lab measurements, not real-user Core Web Vitals. Performance varies between runs; repeated runs use the median. A deliberate noindex directive can lower the SEO score.

## Cookies, storage and external requests

Technical checks passed: 26/26.

Each page/profile starts in a fresh browser context and is scrolled to load lazy resources. Cookie names and storage keys are recorded without their values. Forms are not submitted; outgoing social links are not opened. HTTP cache headers describe browser caching and do not imply cookie use. These checks do not decide legal consent requirements.

