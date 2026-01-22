/**
 * Example 02: Transformations
 *
 * Demonstrates map, mapErr, mapOr, and mapOrElse for transforming
 * Result values without unwrapping them.
 */
import { err, ok } from "antithrow";

const success = ok<number, string>(5);
const failure = err<number, string>("not found");

const doubled = success.map((x) => x * 2);
console.log(doubled.unwrap()); // 10

const stillError = failure.map((x) => x * 2);
console.log(stillError.isErr()); // true

const uppercased = failure.mapErr((e) => e.toUpperCase());
console.log(uppercased.unwrapErr()); // "NOT FOUND"

const successUnchanged = success.mapErr((e) => e.toUpperCase());
console.log(successUnchanged.unwrap()); // 5

const value1 = success.mapOr(0, (x) => x * 3);
const value2 = failure.mapOr(0, (x) => x * 3);
console.log(value1); // 15
console.log(value2); // 0

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
