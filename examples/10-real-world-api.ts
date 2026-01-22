/**
 * Example 10: Real-World API Example
 *
 * A comprehensive example showing how to use Result types
 * in a realistic API scenario.
 */
import type { Result } from "antithrow";
import { chain, err, ok } from "antithrow";

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

function validateEmail(email: string): Result<string, ApiError> {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function validateInput(input: CreateUserInput): Result<CreateUserInput, ApiError> {
	return chain(function* () {
		const email = yield* validateEmail(input.email);
		const password = yield* validatePassword(input.password);
		const name = yield* validateName(input.name);

		return { email, password, name };
	});
}

async function checkEmailExists(email: string): Promise<Result<boolean, ApiError>> {
	await new Promise((resolve) => setTimeout(resolve, 10));

	const existingEmails = ["alice@example.com", "bob@example.com"];

	return ok(existingEmails.includes(email));
}

async function saveUser(input: CreateUserInput): Promise<Result<User, ApiError>> {
	await new Promise((resolve) => setTimeout(resolve, 10));

	return ok({
		id: crypto.randomUUID(),
		email: input.email,
		name: input.name,
	});
}

async function createUser(input: CreateUserInput): Promise<Result<User, ApiError>> {
	return chain(async function* () {
		const validatedInput = yield* validateInput(input);

		const emailExists = yield* await checkEmailExists(validatedInput.email);
		if (emailExists) {
			return yield* err<User, ApiError>({
				type: "validation",
				message: "Email already exists",
			});
		}

		const user = yield* await saveUser(validatedInput);
		return user;
	});
}

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

async function main() {
	const result1 = await createUser({
		email: "newuser@example.com",
		name: "New User",
		password: "securepassword123",
	});
	result1.match({
		ok: (user) => console.log("Created user:", user),
		err: (error) => console.log("Failed:", formatApiError(error)),
	});

	const result2 = await createUser({
		email: "invalid-email",
		name: "Test",
		password: "short",
	});
	result2.match({
		ok: (user) => console.log("Created user:", user),
		err: (error) => console.log("Failed:", formatApiError(error)),
	});

	const result3 = await createUser({
		email: "alice@example.com",
		name: "Alice Clone",
		password: "securepassword123",
	});
	result3.match({
		ok: (user) => console.log("Created user:", user),
		err: (error) => console.log("Failed:", formatApiError(error)),
	});
}

main();
