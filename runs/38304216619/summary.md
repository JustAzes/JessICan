# Lighthouse technical audit

Measured: 2026-10-12T20:26:38.937Z. Lighthouse 13.5.0, Chrome 154.0.8037.97.

Target: https://tierheilpraxis-jessican.de/. Real production requests with standard Lighthouse simulated mobile/desktop throttling.

Completed: 26/26 Lighthouse measurements, 26/26 cookie/storage/network audits.

| Page | Profile | Performance | Accessibility | Best practices | SEO | FCP (s) | LCP (s) | CLS | TBT (ms) | Bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| / | mobile | 99 | 100 | 100 | 100 | 1.40 | 1.70 | 0.023 | 0 | 271283 |
| / | desktop | 100 | 100 | 100 | 100 | 0.35 | 0.39 | 0.006 | 0 | 538938 |
| /behandlung/behandlungsmethoden/ | mobile | 100 | 100 | 100 | 100 | 0.94 | 1.69 | 0.010 | 0 | 296160 |
| /behandlung/behandlungsmethoden/ | desktop | 100 | 100 | 100 | 100 | 0.32 | 0.44 | 0.008 | 0 | 1385912 |
| /behandlung/vorgehen/ | mobile | 98 | 100 | 100 | 100 | 1.12 | 2.40 | 0.000 | 8 | 289392 |
| /behandlung/vorgehen/ | desktop | 100 | 100 | 100 | 100 | 0.31 | 0.51 | 0.000 | 0 | 289438 |
| /kurse/ | mobile | 100 | 100 | 100 | 100 | 1.09 | 1.69 | 0.000 | 0 | 286927 |
| /kurse/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.39 | 0.000 | 0 | 291952 |
| /pages/blog/ | mobile | 99 | 100 | 100 | 66 | 1.25 | 2.00 | 0.000 | 0 | 218465 |
| /pages/blog/ | desktop | 100 | 100 | 100 | 66 | 0.28 | 0.40 | 0.000 | 0 | 218471 |
| /about/ | mobile | 98 | 100 | 100 | 100 | 1.25 | 2.22 | 0.000 | 0 | 330065 |
| /about/ | desktop | 100 | 100 | 100 | 100 | 0.33 | 0.45 | 0.000 | 0 | 387833 |
| /contact/ | mobile | 98 | 100 | 100 | 100 | 1.21 | 2.41 | 0.000 | 0 | 310607 |
| /contact/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.50 | 0.000 | 0 | 310655 |
| /elemente/ | mobile | 100 | 100 | 100 | 100 | 0.97 | 1.27 | 0.000 | 16 | 70329 |
| /elemente/ | desktop | 100 | 100 | 100 | 100 | 0.24 | 0.28 | 0.000 | 0 | 70304 |
| /elemente/hund/ | mobile | 99 | 100 | 100 | 100 | 0.90 | 2.25 | 0.000 | 0 | 611179 |
| /elemente/hund/ | desktop | 100 | 100 | 100 | 100 | 0.26 | 0.50 | 0.000 | 0 | 611114 |
| /elemente/holz/ | mobile | 99 | 100 | 100 | 100 | 0.96 | 1.93 | 0.000 | 4 | 338704 |
| /elemente/holz/ | desktop | 100 | 100 | 100 | 100 | 0.26 | 0.34 | 0.000 | 0 | 177131 |
| /quiz/ | mobile | 100 | 100 | 100 | 100 | 0.95 | 1.28 | 0.000 | 0 | 76020 |
| /quiz/ | desktop | 100 | 100 | 100 | 100 | 0.26 | 0.31 | 0.007 | 0 | 76052 |
| /quiz/hund/ | mobile | 100 | 100 | 100 | 100 | 0.90 | 1.24 | 0.000 | 0 | 77520 |
| /quiz/hund/ | desktop | 100 | 100 | 100 | 100 | 0.24 | 0.29 | 0.000 | 0 | 77346 |
| /pages/blog/hund-arthrose/ | mobile | 99 | 100 | 100 | 100 | 1.24 | 2.14 | 0.002 | 0 | 310136 |
| /pages/blog/hund-arthrose/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.46 | 0.000 | 0 | 339270 |

Scores are lab measurements, not real-user Core Web Vitals. Performance varies between runs; repeated runs use the median. A deliberate noindex directive can lower the SEO score.

## Cookies, storage and external requests

Technical checks passed: 26/26.

Each page/profile starts in a fresh browser context and is scrolled to load lazy resources. Cookie names and storage keys are recorded without their values. Forms are not submitted; outgoing social links are not opened. HTTP cache headers describe browser caching and do not imply cookie use. These checks do not decide legal consent requirements.

