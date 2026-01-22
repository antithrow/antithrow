/**
 * Example 02: Transformations
 *
 * Results can be transformed without unwrapping them first.
 * This lets you build pipelines that stay in "Result space"
 * until you're ready to handle both success and error cases.
 */
import { err, ok } from "antithrow";

const success = ok<number, string>(5);
const failure = err<number, string>("not found");

// map() transforms the Ok value, leaving Err untouched.
// Think of it as: "if this succeeded, do something with the value"
const doubled = success.map((x) => x * 2);
console.log(doubled.unwrap()); // 10

// When called on an Err, map() does nothing—the error passes through
const stillError = failure.map((x) => x * 2);
console.log(stillError.isErr()); // true

// mapErr() is the opposite: transforms Err, leaves Ok untouched.
// Useful for normalizing or enriching error messages
const uppercased = failure.mapErr((e) => e.toUpperCase());
console.log(uppercased.unwrapErr()); // "NOT FOUND"

// When called on an Ok, mapErr() does nothing
const successUnchanged = success.mapErr((e) => e.toUpperCase());
console.log(successUnchanged.unwrap()); // 5

// mapOr() transforms and unwraps in one step, with a default for Err.
// Returns a plain value, not a Result—useful at the end of a chain
const value1 = success.mapOr(0, (x) => x * 3);
const value2 = failure.mapOr(0, (x) => x * 3);
console.log(value1); // 15
console.log(value2); // 0

// mapOrElse() is like mapOr(), but computes the default from the error.
// First function handles Err, second handles Ok
const value3 = success.mapOrElse(
	(e) => e.length,
	(x) => x * 4,
);
const value4 = failure.mapOrElse(
	(e) => e.length,
	(x) => x * 4,
);
console.log(value3); // 20
console.log(value4); // 9 (length of "not found")
