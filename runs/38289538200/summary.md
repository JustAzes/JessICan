# Lighthouse technical audit

Measured: 2026-10-12T18:14:31.110Z. Lighthouse 13.5.0, Chrome 154.0.8037.97.

Target: https://tierheilpraxis-jessican.de/. Real production requests with standard Lighthouse simulated mobile/desktop throttling.

Completed: 26/26 Lighthouse measurements, 26/26 cookie/storage/network audits.

| Page | Profile | Performance | Accessibility | Best practices | SEO | FCP (s) | LCP (s) | CLS | TBT (ms) | Bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| / | mobile | 93 | 100 | 100 | 100 | 1.41 | 1.93 | 0.145 | 2 | 333189 |
| / | desktop | 99 | 100 | 100 | 100 | 0.34 | 0.40 | 0.078 | 0 | 600858 |
| /behandlung/behandlungsmethoden/ | mobile | 99 | 100 | 100 | 100 | 1.11 | 1.86 | 0.020 | 0 | 311860 |
| /behandlung/behandlungsmethoden/ | desktop | 100 | 100 | 100 | 100 | 0.32 | 0.44 | 0.019 | 0 | 1401686 |
| /behandlung/vorgehen/ | mobile | 98 | 100 | 100 | 100 | 1.13 | 2.41 | 0.021 | 15 | 304942 |
| /behandlung/vorgehen/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.52 | 0.004 | 0 | 304930 |
| /kurse/ | mobile | 99 | 100 | 100 | 100 | 1.25 | 1.85 | 0.002 | 0 | 302698 |
| /kurse/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.41 | 0.004 | 0 | 307542 |
| /pages/blog/ | mobile | 96 | 100 | 100 | 66 | 1.25 | 2.75 | 0.002 | 0 | 371947 |
| /pages/blog/ | desktop | 100 | 100 | 100 | 66 | 0.30 | 0.54 | 0.003 | 0 | 371945 |
| /about/ | mobile | 93 | 100 | 100 | 100 | 1.40 | 3.13 | 0.002 | 0 | 516034 |
| /about/ | desktop | 100 | 100 | 100 | 100 | 0.25 | 0.65 | 0.002 | 0 | 573839 |
| /contact/ | mobile | 98 | 100 | 100 | 100 | 1.25 | 2.45 | 0.003 | 0 | 325724 |
| /contact/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.49 | 0.003 | 0 | 325732 |
| /elemente/ | mobile | 100 | 100 | 100 | 100 | 1.14 | 1.29 | 0.002 | 32 | 86004 |
| /elemente/ | desktop | 100 | 100 | 100 | 100 | 0.31 | 0.35 | 0.002 | 0 | 86005 |
| /elemente/hund/ | mobile | 99 | 100 | 100 | 100 | 1.05 | 2.25 | 0.002 | 0 | 626745 |
| /elemente/hund/ | desktop | 100 | 100 | 100 | 100 | 0.30 | 0.50 | 0.002 | 0 | 626725 |
| /elemente/holz/ | mobile | 99 | 100 | 100 | 100 | 1.12 | 1.95 | 0.001 | 10 | 354281 |
| /elemente/holz/ | desktop | 100 | 100 | 100 | 100 | 0.29 | 0.37 | 0.001 | 0 | 192661 |
| /quiz/ | mobile | 100 | 100 | 100 | 100 | 1.05 | 1.20 | 0.001 | 0 | 91634 |
| /quiz/ | desktop | 95 | 100 | 100 | 100 | 0.29 | 0.33 | 0.142 | 0 | 91606 |
| /quiz/hund/ | mobile | 100 | 100 | 100 | 100 | 1.05 | 1.20 | 0.001 | 0 | 93106 |
| /quiz/hund/ | desktop | 100 | 100 | 100 | 100 | 0.28 | 0.32 | 0.001 | 0 | 93103 |
| /pages/blog/hund-arthrose/ | mobile | 98 | 100 | 100 | 100 | 1.41 | 2.31 | 0.006 | 6 | 325584 |
| /pages/blog/hund-arthrose/ | desktop | 100 | 100 | 100 | 100 | 0.34 | 0.50 | 0.023 | 0 | 421871 |

Scores are lab measurements, not real-user Core Web Vitals. Performance varies between runs; repeated runs use the median. A deliberate noindex directive can lower the SEO score.

## Cookies, storage and external requests

Technical checks passed: 26/26.

Each page/profile starts in a fresh browser context and is scrolled to load lazy resources. Cookie names and storage keys are recorded without their values. Forms are not submitted; outgoing social links are not opened. HTTP cache headers describe browser caching and do not imply cookie use. These checks do not decide legal consent requirements.

