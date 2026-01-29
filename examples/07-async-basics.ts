/**
 * Example 07: Async Basics
 *
 * ResultAsync wraps a Promise<Result> and provides the same chainable API.
 */
import { errAsync, okAsync, ResultAsync } from "antithrow";

interface User {
	id: number;
	name: string;
}

// Simulate an async operation that might fail
function fetchUser(id: number): ResultAsync<User, string> {
	if (id === 1) {
		return okAsync({ id: 1, name: "Alice" });
	}
	return errAsync(`User ${id} not found`);
}

async function main() {
	// Chain operations on ResultAsync just like Result.
	// Each method returns a new ResultAsync, keeping everything async
	const userGreeting = fetchUser(1)
		.map((user) => user.name)
		.map((name) => `Hello, ${name}!`);

	// Awaiting a ResultAsync gives you a plain Result
	const result = await userGreeting;

	// Now TypeScript can narrow the type after isOk()/isErr() checks
	if (result.isOk()) {
		console.log(result.value); // "Hello, Alice!" — TypeScript knows this is Ok
	} else {
		console.log(result.error); // TypeScript knows this is Err
	}

	// For quick extraction, you can await methods directly
	console.log(await fetchUser(1).unwrap()); // { id: 1, name: "Alice" }
	console.log(await fetchUser(1).expect("expected user")); // { id: 1, name: "Alice" }
	console.log(await fetchUser(999).unwrapOr({ id: 0, name: "Guest" })); // { id: 0, name: "Guest" }
	console.log(await fetchUser(999).expectErr("expected error")); // "User 999 not found"

	// ResultAsync.try() wraps async functions that might throw, and awaiting it
	// returns a `Result`.
	const fetched = await ResultAsync.try(async () => {
		const response = await fetch("https://api.example.com/data");
		return response.json();
	});

	if (fetched.isErr()) {
		console.log("Fetch failed:", fetched.error);
	}
}

main();
