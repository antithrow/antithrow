/**
 * Example 03: Chaining Operations
 *
 * When each step in a pipeline can fail, use andThen() to chain them.
 * If any step fails, the chain short-circuits and the error propagates.
 * This is like the ? operator in Rust, or flatMap for monads.
 */
import type { Result } from "antithrow";
import { err, ok } from "antithrow";

// Three functions that each might fail—perfect candidates for chaining
function parseNumber(s: string): Result<number, string> {
	const n = Number(s);
	if (Number.isNaN(n)) {
		return err(`"${s}" is not a valid number`);
	}

	return ok(n);
}

function validatePositive(n: number): Result<number, string> {
	if (n <= 0) {
		return err(`${n} is not positive`);
	}

	return ok(n);
}

function sqrt(n: number): Result<number, string> {
	if (n < 0) {
		return err("Cannot take square root of negative number");
	}

	return ok(Math.sqrt(n));
}

// andThen() chains operations: each step receives the previous Ok value.
// Unlike map(), the callback returns a Result, enabling sequential validation
const result1 = parseNumber("16").andThen(validatePositive).andThen(sqrt);
console.log(result1.unwrap()); // 4

// If any step fails, the rest of the chain is skipped.
// Here validatePositive fails, so sqrt is never called
const result2 = parseNumber("-5").andThen(validatePositive).andThen(sqrt);
console.log(result2.unwrapErr()); // "-5 is not positive"

// The error from the first failing step is preserved
const result3 = parseNumber("abc").andThen(validatePositive).andThen(sqrt);
console.log(result3.unwrapErr()); // "\"abc\" is not a valid number"

// and() returns the provided Result when the current value is Ok
const next = ok(2).and(ok("next"));
console.log(next.unwrap()); // "next"

// orElse() is the opposite: it runs only on Err, allowing recovery.
// If recovery succeeds, you get an Ok
const recovered = err<number, string>("failed")
	.orElse(() => ok(42))
	.unwrap();
console.log(recovered); // 42

// Recovery can also fail, replacing the original error
const stillFailed = err<number, string>("first error")
	.orElse(() => err("second error"))
	.unwrapErr();
console.log(stillFailed); // "second error"

// or() returns the fallback Result only when this is Err
const fallback = err<number, string>("missing").or(ok(0));
console.log(fallback.unwrap()); // 0
