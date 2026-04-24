---
"@antithrow/std": patch
---

Fix `structuredClone` by using an explicit synchronous `try`/`catch`, preserving its `Settled` return type even for promise-like values.
