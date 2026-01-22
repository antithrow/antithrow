/**
 * Example 04: Pattern Matching
 *
 * The match() method handles both Ok and Err in one expression.
 * TypeScript enforces that you handle both cases, making it impossible
 * to forget error handling—a common source of bugs with exceptions.
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

// match() takes an object with ok and err handlers.
// Both handlers must return the same type—here, a string
const greeting1 = getUser(1).match({
	ok: (user) => `Hello, ${user.name}!`,
	err: (error) => `Error: ${error}`,
});
console.log(greeting1); // "Hello, Alice!"

// The appropriate handler runs based on the Result variant
const greeting2 = getUser(999).match({
	ok: (user) => `Hello, ${user.name}!`,
	err: (error) => `Error: ${error}`,
});
console.log(greeting2); // "Error: User 999 not found"

// match() shines when converting Results to other types.
// Here we transform a Result into an HTTP response object
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

console.log(httpResponse(getUser(1))); // { status: 200, body: '{"id":1,"name":"Alice"}' }
console.log(httpResponse(getUser(999))); // { status: 404, body: '{"error":"User 999 not found"}' }
