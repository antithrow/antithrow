/**
 * Example 05: Result.try
 *
 * Demonstrates wrapping throwing functions safely with Result.try.
 */
import { Result } from "antithrow";

const jsonResult = Result.try(() => JSON.parse('{"name": "Alice", "age": 30}'));
console.log(jsonResult.unwrap()); // { name: "Alice", age: 30 }

const invalidJson = Result.try(() => JSON.parse("not valid json"));
console.log(invalidJson.isErr()); // true
console.log(invalidJson.unwrapErr()); // SyntaxError

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

const config2 = parseConfig('{"port": "not a number", "host": "localhost"}');
console.log(config2.isErr()); // true

const config3 = parseConfig("invalid");
console.log(config3.isErr()); // true
