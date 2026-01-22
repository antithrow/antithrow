/**
 * Example 01: Basic Usage
 *
 * Demonstrates the fundamental concepts of Result types:
 * creating Ok and Err values, and extracting their contents.
 */
import type { Result } from "antithrow";
import { err, ok } from "antithrow";

function divide(a: number, b: number): Result<number, string> {
	if (b === 0) {
		return err("Division by zero");
	}

	return ok(a / b);
}

const success = divide(10, 2);
const failure = divide(10, 0);

console.log(success.isOk()); // true
console.log(success.isErr()); // false
console.log(failure.isOk()); // false
console.log(failure.isErr()); // true

console.log(success.unwrap()); // 5
console.log(failure.unwrapOr(0)); // 0
console.log(failure.unwrapOrElse((e) => e.length)); // 16

if (success.isOk()) {
	console.log(`Success value: ${success.value}`);
}

if (failure.isErr()) {
	console.log(`Error: ${failure.error}`);
}
