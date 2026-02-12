# antithrow

## 2.0.0

### Major Changes

- [#99](https://github.com/antithrow/antithrow/pull/99) [`82be825`](https://github.com/antithrow/antithrow/commit/82be82527e7081fb5b7805de61fa349a9a70ea0b) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat!: remove redundant `ResultAsync.fromResult` method

  Use `toAsync()` to convert a `Result` to a `ResultAsync`:

  ```ts
  // Before
  ResultAsync.fromResult(ok(1)).map(async (x) => x * 2);

  // After
  ok(1)
    .toAsync()
    .map(async (x) => x * 2);
  ```

- [#99](https://github.com/antithrow/antithrow/pull/99) [`915a93b`](https://github.com/antithrow/antithrow/commit/915a93bdeec9d3f6d745d63486e4f52514b65107) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat!: replace 6 sync-to-async bridge methods with `toAsync()`

  Removed `mapAsync`, `mapErrAsync`, `andThenAsync`, `orElseAsync`, `inspectAsync`, and `inspectErrAsync` from `Result`. Use `toAsync()` to convert to `ResultAsync`, then chain normally:

  ```ts
  // Before
  ok(2).mapAsync(async (x) => x * 2);
  ok(2).andThenAsync(async (x) => ok(x * 2));
  err("oops").orElseAsync(async (e) => ok(0));

  // After
  ok(2)
    .toAsync()
    .map(async (x) => x * 2);
  ok(2)
    .toAsync()
    .andThen(async (x) => ok(x * 2));
  err("oops")
    .toAsync()
    .orElse(async (e) => ok(0));
  ```

### Minor Changes

- [#97](https://github.com/antithrow/antithrow/pull/97) [`2e5b3fa`](https://github.com/antithrow/antithrow/commit/2e5b3fa808eae9c4c40e5c2f07887f958d0098c6) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat: implement new `Result.all` static function

### Patch Changes

- [#94](https://github.com/antithrow/antithrow/pull/94) [`329cdb9`](https://github.com/antithrow/antithrow/commit/329cdb96295c573c0810608b64cfa39ef729622c) Thanks [@jack-weilage](https://github.com/jack-weilage)! - fix: preserve unified Err union inference for `andThen` and `andThenAsync` on inferred `Ok | Err` receivers

- [#91](https://github.com/antithrow/antithrow/pull/91) [`c7d3468`](https://github.com/antithrow/antithrow/commit/c7d34684d586e7de93ed619c7d7d5e2ebcc86e9c) Thanks [@jack-weilage](https://github.com/jack-weilage)! - fix: improve `chain` type inference to preserve unions of yielded `Err` types in sync and async generators

- [#93](https://github.com/antithrow/antithrow/pull/93) [`0dd07d1`](https://github.com/antithrow/antithrow/commit/0dd07d191ca8cb86d636ee37c16ca5e3b064a33e) Thanks [@jack-weilage](https://github.com/jack-weilage)! - chore: mark packages as tree-shakable

## 1.2.0

### Minor Changes

- [#42](https://github.com/jack-weilage/antithrow/pull/42) [`13b0df6`](https://github.com/jack-weilage/antithrow/commit/13b0df6523828a2208e828558d7d822b5cbc5644) Thanks [@jack-weilage](https://github.com/jack-weilage)! - feat: add async methods converting `Result` to `ResultAsync`

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
