/**
 * Example 06: Inspect
 *
 * Demonstrates inspect and inspectErr for side effects without consuming the Result.
 */
import { err, ok } from "antithrow";

ok(42)
	.inspect((value) => console.log(`Got value: ${value}`))
	.map((x) => x * 2)
	.inspect((value) => console.log(`Doubled: ${value}`));
// Logs: "Got value: 42"
// Logs: "Doubled: 84"

err("something went wrong")
	.inspect((value) => console.log(`Value: ${value}`)) // Never called
	.inspectErr((error) => console.error(`Error occurred: ${error}`));
// Logs: "Error occurred: something went wrong"

function processWithLogging(value: number) {
	return ok(value)
		.inspect((v) => console.log(`[DEBUG] Starting with: ${v}`))
		.map((v) => v * 2)
		.inspect((v) => console.log(`[DEBUG] After doubling: ${v}`))
		.andThen((v) => (v > 100 ? err("too large") : ok(v)))
		.inspectErr((e) => console.error(`[ERROR] ${e}`));
}

processWithLogging(10);
// [DEBUG] Starting with: 10
// [DEBUG] After doubling: 20

processWithLogging(60);
// [DEBUG] Starting with: 60
// [DEBUG] After doubling: 120
// [ERROR] too large
