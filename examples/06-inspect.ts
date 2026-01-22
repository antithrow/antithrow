/**
 * Example 06: Inspect
 *
 * Sometimes you need side effects (logging, debugging) without changing
 * the Result. inspect() and inspectErr() let you "peek" at the value,
 * run a callback, and pass the Result through unchanged.
 */
import { err, ok } from "antithrow";

// inspect() runs the callback only for Ok values, then returns the same Result.
// This lets you insert logging anywhere in a chain without breaking the flow
ok(42)
	.inspect((value) => console.log(`Got value: ${value}`))
	.map((x) => x * 2)
	.inspect((value) => console.log(`Doubled: ${value}`));
// Logs: "Got value: 42"
// Logs: "Doubled: 84"

// inspectErr() is the counterpart for Err values.
// inspect() on an Err does nothing; inspectErr() on an Ok does nothing
err("something went wrong")
	.inspect((value) => console.log(`Value: ${value}`)) // Never called—this is Err
	.inspectErr((error) => console.error(`Error occurred: ${error}`));
// Logs: "Error occurred: something went wrong"

// Practical use: add debug logging throughout a pipeline.
// Each inspect/inspectErr acts as a checkpoint without affecting the logic
function processWithLogging(value: number) {
	return ok(value)
		.inspect((v) => console.log(`[DEBUG] Starting with: ${v}`))
		.map((v) => v * 2)
		.inspect((v) => console.log(`[DEBUG] After doubling: ${v}`))
		.andThen((v) => (v > 100 ? err("too large") : ok(v)))
		.inspectErr((e) => console.error(`[ERROR] ${e}`));
}

// Success path: both inspect() calls run, inspectErr() is skipped
processWithLogging(10);
// [DEBUG] Starting with: 10
// [DEBUG] After doubling: 20

// Failure path: inspect() calls run until the error, then inspectErr() runs
processWithLogging(60);
// [DEBUG] Starting with: 60
// [DEBUG] After doubling: 120
// [ERROR] too large
