/**
 * Example 01: Basic Usage
 *
 * A Result<T, E> represents either success (Ok) or failure (Err).
 * Instead of throwing exceptions, functions return Results that
 * callers must explicitly handle—making error cases visible in types.
 */
import type { Result } from "antithrow";
import { err, ok } from "antithrow";

// A function that can fail returns Result<SuccessType, ErrorType>.
// The caller sees from the signature that this operation might fail.
function divide(a: number, b: number): Result<number, string> {
	if (b === 0) {
		// Return an Err when the operation fails
		return err("Division by zero");
	}

	// Return an Ok when the operation succeeds
	return ok(a / b);
}

const success = divide(10, 2);
const failure = divide(10, 0);

// Use isOk() and isErr() to check which variant you have
console.log(success.isOk()); // true
console.log(success.isErr()); // false
console.log(failure.isOk()); // false
console.log(failure.isErr()); // true

// Extract the success value with unwrap() (throws if Err!)
console.log(success.unwrap()); // 5

// Ok with no arguments represents a void/empty success
const empty = ok();
console.log(empty.unwrap()); // undefined

// If you want a custom panic message, use expect()
console.log(success.expect("expected a value")); // 5

// Safely extract with a fallback using unwrapOr()
console.log(failure.unwrapOr(0)); // 0

// Or compute a fallback from the error using unwrapOrElse()
console.log(failure.unwrapOrElse((e) => e.length)); // 16

// You can assert an Err using expectErr()
console.log(failure.expectErr("expected an error")); // "Division by zero"

// After isOk()/isErr() checks, TypeScript narrows the type,
// giving you direct access to .value or .error
if (success.isOk()) {
	console.log(`Success value: ${success.value}`);
}

if (failure.isErr()) {
	console.log(`Error: ${failure.error}`);
}
