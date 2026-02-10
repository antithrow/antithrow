/**
 * Example 10: Real-World API Example
 *
 * This example ties together everything from the previous examples:
 * typed errors, validation chains, async operations, and pattern matching.
 * It shows how Result types create a clean, type-safe API layer.
 */
import type { Result } from "antithrow";
import { chain, err, errAsync, ok, okAsync, type ResultAsync } from "antithrow";

// Define a discriminated union for all possible API errors.
// This gives exhaustive checking when handling errors
type ApiError =
	| { type: "validation"; message: string }
	| { type: "not_found"; resource: string }
	| { type: "unauthorized" }
	| { type: "network"; cause: Error };

interface User {
	id: string;
	email: string;
	name: string;
}

interface CreateUserInput {
	email: string;
	name: string;
	password: string;
}

// --- Validation functions ---
// Each returns Result<ValidatedValue, ApiError>, making errors explicit

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(email: string): Result<string, ApiError> {
	if (!emailRegex.test(email)) {
		return err({ type: "validation", message: "Invalid email format" });
	}
	return ok(email);
}

function validatePassword(password: string): Result<string, ApiError> {
	if (password.length < 8) {
		return err({ type: "validation", message: "Password must be at least 8 characters" });
	}
	return ok(password);
}

function validateName(name: string): Result<string, ApiError> {
	const trimmed = name.trim();
	if (trimmed.length === 0) {
		return err({ type: "validation", message: "Name cannot be empty" });
	}
	return ok(trimmed);
}

// Compose validators with chain()—first validation error stops the chain
function validateInput(input: CreateUserInput): Result<CreateUserInput, ApiError> {
	return chain(function* () {
		const email = yield* validateEmail(input.email);
		const password = yield* validatePassword(input.password);
		const name = yield* validateName(input.name);

		return { email, password, name };
	});
}

// --- Async data layer ---
// Simulated database operations returning ResultAsync

function checkEmailExists(email: string): ResultAsync<boolean, ApiError> {
	const existingEmails = ["alice@example.com", "bob@example.com"];
	return okAsync(existingEmails.includes(email));
}

function saveUser(input: CreateUserInput): ResultAsync<User, ApiError> {
	return okAsync({
		id: crypto.randomUUID(),
		email: input.email,
		name: input.name,
	});
}

// --- Main API handler ---
// Combines sync validation with async operations in one chain

function createUser(input: CreateUserInput): ResultAsync<User, ApiError> {
	return chain(async function* () {
		// Sync validation first
		const validatedInput = yield* validateInput(input);

		// Then async checks
		const emailExists = yield* checkEmailExists(validatedInput.email);
		if (emailExists) {
			return yield* errAsync<User, ApiError>({
				type: "validation",
				message: "Email already exists",
			});
		}

		// Finally, persist
		return yield* saveUser(validatedInput);
	});
}

// --- Response formatting ---
// Convert typed errors to HTTP responses with exhaustive matching

function formatApiError(error: ApiError): { status: number; body: object } {
	switch (error.type) {
		case "validation":
			return { status: 400, body: { error: error.message } };
		case "not_found":
			return { status: 404, body: { error: `${error.resource} not found` } };
		case "unauthorized":
			return { status: 401, body: { error: "Unauthorized" } };
		case "network":
			return { status: 503, body: { error: "Service unavailable" } };
	}
}

// --- Demo ---

async function main() {
	// Success case: valid input, new email
	const result1 = await createUser({
		email: "newuser@example.com",
		name: "New User",
		password: "securepassword123",
	});
	result1.match({
		ok: (user) => console.log("Created user:", user),
		err: (error) => console.log("Failed:", formatApiError(error)),
	});

	// Validation failure: invalid email format
	const result2 = await createUser({
		email: "invalid-email",
		name: "Test",
		password: "short",
	});
	result2.match({
		ok: (user) => console.log("Created user:", user),
		err: (error) => console.log("Failed:", formatApiError(error)),
	});
	// Failed: { status: 400, body: { error: "Invalid email format" } }

	// Business logic failure: email already exists
	const result3 = await createUser({
		email: "alice@example.com",
		name: "Alice Clone",
		password: "securepassword123",
	});
	result3.match({
		ok: (user) => console.log("Created user:", user),
		err: (error) => console.log("Failed:", formatApiError(error)),
	});
	// Failed: { status: 400, body: { error: "Email already exists" } }
}

main();
