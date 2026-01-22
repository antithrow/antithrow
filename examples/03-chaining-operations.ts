/**
 * Example 03: Chaining Operations
 *
 * Demonstrates andThen and orElse for chaining Result-returning functions.
 */
import type { Result } from "antithrow";
import { err, ok } from "antithrow";

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

const result1 = parseNumber("16").andThen(validatePositive).andThen(sqrt);
console.log(result1.unwrap()); // 4

const result2 = parseNumber("-5").andThen(validatePositive).andThen(sqrt);
console.log(result2.unwrapErr()); // "-5 is not positive"

const result3 = parseNumber("abc").andThen(validatePositive).andThen(sqrt);
console.log(result3.unwrapErr()); // "\"abc\" is not a valid number"

const recovered = err<number, string>("failed")
	.orElse(() => ok(42))
	.unwrap();
console.log(recovered); // 42

const stillFailed = err<number, string>("first error")
	.orElse(() => err("second error"))
	.unwrapErr();
console.log(stillFailed); // "second error"
