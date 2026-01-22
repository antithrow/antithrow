/**
 * Example 04: Pattern Matching
 *
 * Demonstrates the match method for handling both Ok and Err cases.
 */
import type { Result } from "antithrow";
import { err, ok } from "antithrow";

interface User {
	id: number;
	name: string;
}

function getUser(id: number): Result<User, string> {
	if (id === 1) {
		return ok({ id: 1, name: "Alice" });
	}

	return err(`User ${id} not found`);
}

const greeting1 = getUser(1).match({
	ok: (user) => `Hello, ${user.name}!`,
	err: (error) => `Error: ${error}`,
});
console.log(greeting1); // "Hello, Alice!"

const greeting2 = getUser(999).match({
	ok: (user) => `Hello, ${user.name}!`,
	err: (error) => `Error: ${error}`,
});
console.log(greeting2); // "Error: User 999 not found"

function httpResponse(result: Result<User, string>): { status: number; body: string } {
	return result.match({
		ok: (user) => ({
			status: 200,
			body: JSON.stringify(user),
		}),
		err: (error) => ({
			status: 404,
			body: JSON.stringify({ error }),
		}),
	});
}

console.log(httpResponse(getUser(1)));
console.log(httpResponse(getUser(999)));
