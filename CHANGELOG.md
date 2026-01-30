# antithrow

## 1.1.0

### Minor Changes

- [#25](https://github.com/jack-weilage/antithrow/pull/25) [`e1dce52`](https://github.com/jack-weilage/antithrow/commit/e1dce52a280d8f16f841157be2ecd52e53c3446a) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat: allow `ok` and `okAsync` to accept a void success value

- [#34](https://github.com/jack-weilage/antithrow/pull/34) [`f7389af`](https://github.com/jack-weilage/antithrow/commit/f7389af1788426124abf6d0ed32ea8a9e3126b5e) Thanks [@jack-weilage](https://github.com/jack-weilage)! - docs: update README

- [#23](https://github.com/jack-weilage/antithrow/pull/23) [`7c7ec96`](https://github.com/jack-weilage/antithrow/commit/7c7ec9642f34f0d36c08265a939da1b6dc232155) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat: implement boolean operators `and`/`or`

- [#19](https://github.com/jack-weilage/antithrow/pull/19) [`6f56327`](https://github.com/jack-weilage/antithrow/commit/6f5632726913c7a42f755bd9e8ef371c5f431e62) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat(async): implement `ResultAsync.fromPromise` and `ResultAsync.fromResult` constructors

- [#24](https://github.com/jack-weilage/antithrow/pull/24) [`b333d64`](https://github.com/jack-weilage/antithrow/commit/b333d64b9929b66781bdebb806f585db61ff577f) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat: added `expect` and `expectErr` methods for additional control over unwrapping

- [#31](https://github.com/jack-weilage/antithrow/pull/31) [`0fb8c41`](https://github.com/jack-weilage/antithrow/commit/0fb8c410141f34500851617a7945808d2609bda0) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat: add `isOkAnd` and `isErrAnd` methods

- [#33](https://github.com/jack-weilage/antithrow/pull/33) [`367a788`](https://github.com/jack-weilage/antithrow/commit/367a788c5bda93a0d06d399177c01756e0105a68) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat: add `flatten` method to unnest results

### Patch Changes

- [#22](https://github.com/jack-weilage/antithrow/pull/22) [`3846cbc`](https://github.com/jack-weilage/antithrow/commit/3846cbc96a7825045352bca78e1495f60dc6663c) Thanks [@jack-weilage](https://github.com/jack-weilage)! - perf: reduce unnecessary allocations by re-using results

## 1.0.0

### Major Changes

- [`73c1953`](https://github.com/jack-weilage/antithrow/commit/73c195390d92d38ed3a2259cfa7564e9ede89da1) Thanks [@jack-weilage](https://github.com/jack-weilage)! - Initial release!

  Includes the initial implementation of the `Result` and `ResultAsync` types alongside the `chain` helper function.
