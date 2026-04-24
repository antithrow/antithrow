---
"antithrow": patch
---

Fix `Result.try` overload typing for callbacks that may return either a sync value or a `PromiseLike`, preserving precise sync and async inference while widening maybe-async callbacks to `Result`.
