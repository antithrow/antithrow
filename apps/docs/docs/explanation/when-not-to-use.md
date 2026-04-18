---
title: When not to use antithrow
description: Honest trade-offs and the cases where exceptions or another tool are the better choice.
sidebar_position: 7
---

# When not to use antithrow

antithrow is useful in most TypeScript codebases, but not all of them. This page lists the cases where reaching for it is the wrong call, so you can make the decision with your eyes open.

## When the surrounding code is all exception-based

If you are extending a codebase that already throws consistently — every function, every library, every test — introducing `Result` at a single boundary tends to create a third state that nobody wanted: some code uses exceptions, some uses `Result`, and every interop point needs `Result.try` or a `match`-and-throw wrapper.

The cost is ergonomic, not technical. If you cannot migrate at least a coherent slice of the codebase, the noise often outweighs the benefit. Pick a module or subsystem and convert it fully, or wait for a bigger rewrite.

## When you need cancellation, retries, or resource brackets as primitives

antithrow does not model cancellation. A `Pending` is backed by a plain promise; there is no uniform way to abort it mid-flight. `orElse` handles recovery but does not implement structured retry policies. `map` does not run inside a scope.

If these features are central to your problem — you are writing an orchestration layer, a long-running pipeline, a server with strict cancellation semantics — [`Effect`](./comparison#effect) is the better tool. Its lazy model gives the runtime the handle it needs to implement those primitives.

## When performance-critical code runs in tight loops

`Result` allocates. Constructing `Ok(value)` is cheap, but it is not free, and a loop that returns millions of `Result` instances per second will show up in a profile.

In those paths, consider:

- Returning `T | null` and branching explicitly at the call site.
- Using an error sentinel value (`-1`, `""`) where the domain allows it.
- Throwing and catching once at the loop boundary.

antithrow is not designed around hot-path allocation. The overhead is small but real, and in code where allocation itself is the bottleneck, plain shapes are the right tool.

## When you need structured logging of every failure

A typed error says "this failed and here is why." It does not say "this failed, and here is the stack trace, the request id, the user context, and the downstream call that triggered it." An `Error` subclass with a captured stack is often a better carrier for diagnostic information.

You can combine the two — put an `Error` inside your `Err` and forward it up — but if every caller needs the stack trace, you might as well throw.

## When the failure mode really is a bug

If a branch can only be reached because of a programmer mistake — a switch that missed a case, a postcondition you control internally — throwing is reasonable. `Result` is for failures your caller should handle. Bugs are for the author to fix; letting them crash loudly is the correct response.

antithrow's own `UnwrapError` is an example: it is thrown precisely when `unwrap()` is called on an `Err`, which is a bug.

## Picking intentionally

If you are unsure, the default is probably still "use antithrow." The cases above are real, but they are minority cases. Most TypeScript code benefits from making failure modes visible in signatures.

What you do not want is a mixed codebase where the rule is "sometimes this throws, sometimes it returns a `Result`, and you have to read each function to find out." That is the worst of both worlds. Pick a discipline, apply it within a clearly drawn boundary, and stick to it.
