# Lighthouse technical audit

Measured: 2026-10-12T21:36:25.403Z. Lighthouse 13.5.0, Chrome 154.0.8037.97.

Target: https://tierheilpraxis-jessican.de/. Real production requests with standard Lighthouse simulated mobile/desktop throttling.

Completed: 26/26 Lighthouse measurements, 26/26 cookie/storage/network audits.

| Page | Profile | Performance | Accessibility | Best practices | SEO | FCP (s) | LCP (s) | CLS | TBT (ms) | Bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| / | mobile | 97 | 100 | 100 | 100 | 1.52 | 1.82 | 0.000 | 24 | 271405 |
| / | desktop | 100 | 100 | 100 | 100 | 0.34 | 0.38 | 0.007 | 0 | 538918 |
| /behandlung/behandlungsmethoden/ | mobile | 100 | 100 | 100 | 100 | 1.02 | 1.77 | 0.010 | 0 | 296180 |
| /behandlung/behandlungsmethoden/ | desktop | 100 | 100 | 100 | 100 | 0.33 | 0.45 | 0.008 | 0 | 1385846 |
| /behandlung/vorgehen/ | mobile | 98 | 100 | 100 | 100 | 1.13 | 2.41 | 0.000 | 15 | 289455 |
| /behandlung/vorgehen/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.50 | 0.000 | 0 | 289412 |
| /kurse/ | mobile | 100 | 100 | 100 | 100 | 1.08 | 1.68 | 0.000 | 0 | 287116 |
| /kurse/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.39 | 0.000 | 0 | 291995 |
| /pages/blog/ | mobile | 100 | 100 | 100 | 66 | 0.99 | 1.74 | 0.000 | 0 | 218428 |
| /pages/blog/ | desktop | 100 | 100 | 100 | 66 | 0.29 | 0.41 | 0.000 | 0 | 218419 |
| /about/ | mobile | 99 | 100 | 100 | 100 | 1.23 | 2.13 | 0.000 | 0 | 329860 |
| /about/ | desktop | 100 | 100 | 100 | 100 | 0.34 | 0.50 | 0.000 | 0 | 387808 |
| /contact/ | mobile | 98 | 100 | 100 | 100 | 1.24 | 2.44 | 0.000 | 0 | 310478 |
| /contact/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.49 | 0.000 | 0 | 310438 |
| /elemente/ | mobile | 100 | 100 | 100 | 100 | 0.97 | 1.27 | 0.000 | 15 | 70574 |
| /elemente/ | desktop | 100 | 100 | 100 | 100 | 0.27 | 0.31 | 0.000 | 0 | 70325 |
| /elemente/hund/ | mobile | 99 | 100 | 100 | 100 | 0.91 | 2.26 | 0.000 | 0 | 611004 |
| /elemente/hund/ | desktop | 100 | 100 | 100 | 100 | 0.34 | 0.58 | 0.000 | 0 | 611174 |
| /elemente/holz/ | mobile | 99 | 100 | 100 | 100 | 0.97 | 1.95 | 0.000 | 10 | 338703 |
| /elemente/holz/ | desktop | 100 | 100 | 100 | 100 | 0.26 | 0.34 | 0.000 | 0 | 177184 |
| /quiz/ | mobile | 100 | 100 | 100 | 100 | 0.91 | 1.24 | 0.000 | 0 | 76069 |
| /quiz/ | desktop | 100 | 100 | 100 | 100 | 0.26 | 0.31 | 0.007 | 0 | 76123 |
| /quiz/hund/ | mobile | 100 | 100 | 100 | 100 | 0.90 | 1.24 | 0.000 | 0 | 77504 |
| /quiz/hund/ | desktop | 100 | 100 | 100 | 100 | 0.25 | 0.30 | 0.000 | 0 | 77498 |
| /pages/blog/hund-arthrose/ | mobile | 99 | 100 | 100 | 100 | 1.24 | 2.14 | 0.002 | 0 | 310175 |
| /pages/blog/hund-arthrose/ | desktop | 100 | 100 | 100 | 100 | 0.33 | 0.49 | 0.000 | 0 | 339266 |

Scores are lab measurements, not real-user Core Web Vitals. Performance varies between runs; repeated runs use the median. A deliberate noindex directive can lower the SEO score.

## Cookies, storage and external requests

Technical checks passed: 26/26.

Each page/profile starts in a fresh browser context and is scrolled to load lazy resources. Cookie names and storage keys are recorded without their values. Forms are not submitted; outgoing social links are not opened. HTTP cache headers describe browser caching and do not imply cookie use. These checks do not decide legal consent requirements.

