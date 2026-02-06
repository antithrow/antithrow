/**
 * Example 09: Chain (Asynchronous)
 *
 * chain() also works with async generators for composing async operations.
 * yield* on a ResultAsync automatically awaits it and unwraps the value,
 * or exits early on error—no separate await needed.
 */
import type { ResultAsync } from "antithrow";
import { chain, errAsync, okAsync } from "antithrow";

// Simulate async operations that return ResultAsync
function fetchUser(id: number): ResultAsync<{ id: number; name: string }, string> {
	if (id === 1) {
		return okAsync({ id: 1, name: "Alice" });
	}
	return errAsync(`User ${id} not found`);
}

function fetchOrders(userId: number): ResultAsync<string[], string> {
	if (userId === 1) {
		return okAsync(["order-1", "order-2"]);
	}
	return errAsync(`No orders for user ${userId}`);
}

async function main() {
	// yield* handles both awaiting and unwrapping in one step.
	// If Ok, you get the value. If Err, the generator exits immediately
	const result1 = await chain(async function* () {
		const user = yield* fetchUser(1);
		const orders = yield* fetchOrders(user.id);
		return { user, orders };
	});
	console.log(result1.unwrap());
	// { user: { id: 1, name: "Alice" }, orders: ["order-1", "order-2"] }

	// Early exit works the same as sync chain—fetchOrders is never called
	const result2 = await chain(async function* () {
		const user = yield* fetchUser(999); // Fails here
		const orders = yield* fetchOrders(user.id);
		return { user, orders };
	});
	console.log(result2.unwrapErr()); // "User 999 not found"

	// You can mix Result operations with regular async code.
	// Use yield* for Results, regular await for Promises
	const result3 = await chain(async function* () {
		const user = yield* fetchUser(1);
		const orders = yield* fetchOrders(user.id);

		// Regular async operations still use await
		const processedOrders = await Promise.all(
			orders.map(async (orderId) => {
				return { orderId, status: "processed" };
			}),
		);

		return { userName: user.name, processedOrders };
	});
	console.log(result3.unwrap());
	// { userName: "Alice", processedOrders: [{ orderId: "order-1", status: "processed" }, ...] }
}

main();
