/**
 * Example 07: Async Basics
 *
 * Demonstrates ResultAsync for handling asynchronous operations.
 */
import { errAsync, okAsync, ResultAsync } from "antithrow";

async function main() {
	const success = okAsync(42);
	const failure = errAsync<number, string>("async error");

	console.log(await success.isOk()); // true
	console.log(await failure.isErr()); // true
	console.log(await success.unwrap()); // 42
	console.log(await failure.unwrapOr(0)); // 0

	const doubled = success.map((x) => x * 2);
	console.log(await doubled.unwrap()); // 84

	const result = await okAsync(10)
		.map((x) => x + 5)
		.andThen((x) => okAsync(x * 2))
		.match({
			ok: (v) => `Result: ${v}`,
			err: (e) => `Error: ${e}`,
		});
	console.log(result); // "Result: 30"

	const fetched = ResultAsync.try(async () => {
		const response = await fetch("https://api.example.com/data");
		return response.json();
	});
	console.log(await fetched.isErr()); // true (fetch will fail in this example)
}

main();
