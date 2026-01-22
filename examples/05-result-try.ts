/**
 * Example 05: Result.try
 *
 * Most existing JavaScript APIs throw exceptions. Result.try() bridges
 * the gap by catching exceptions and converting them to Err values.
 * This lets you use throwing code within a Result-based workflow.
 */
import { Result } from "antithrow";

// Result.try() wraps a function that might throw.
// If it throws, you get Err(error). If it succeeds, you get Ok(value).
//
// Create reusable safe wrappers around throwing functions—this is the
// recommended pattern for integrating with existing APIs
function jsonParseSafe(json: string): Result<unknown, SyntaxError> {
	return Result.try(() => JSON.parse(json));
}

// Now JSON parsing returns a Result instead of throwing
const jsonResult = jsonParseSafe('{"name": "Alice", "age": 30}');
console.log(jsonResult.unwrap()); // { name: "Alice", age: 30 }

// Invalid JSON becomes an Err containing the SyntaxError
const invalidJson = jsonParseSafe("not valid json");
console.log(invalidJson.isErr()); // true
console.log(invalidJson.unwrapErr().message); // Prints the SyntaxError message

// Combine Result.try() with validation for more complex parsing.
// The callback can throw for any validation failure
interface Config {
	port: number;
	host: string;
}

function parseConfig(json: string): Result<Config, Error> {
	return Result.try<Config, Error>(() => {
		const data = JSON.parse(json);

		if (typeof data.port !== "number") {
			throw new Error("port must be a number");
		}
		if (typeof data.host !== "string") {
			throw new Error("host must be a string");
		}

		return data as Config;
	});
}

const config1 = parseConfig('{"port": 3000, "host": "localhost"}');
console.log(config1.unwrap()); // { port: 3000, host: "localhost" }

// Validation errors become Err values
const config2 = parseConfig('{"port": "not a number", "host": "localhost"}');
console.log(config2.unwrapErr().message); // "port must be a number"

// Parse errors from JSON.parse are also captured
const config3 = parseConfig("invalid");
console.log(config3.isErr()); // true
