/**
 * Example 09: Chain (Asynchronous)
 *
 * Demonstrates async chain for composing multiple async Result operations
 * with early-return on errors.
 */
import type { ResultAsync } from "antithrow";
import { chain, errAsync, okAsync } from "antithrow";

async function fetchUser(id: number): Promise<ResultAsync<{ id: number; name: string }, string>> {
	await new Promise((resolve) => setTimeout(resolve, 10));
	if (id === 1) {
		return okAsync({ id: 1, name: "Alice" });
	}

	return errAsync(`User ${id} not found`);
}

async function fetchOrders(userId: number): Promise<ResultAsync<string[], string>> {
	await new Promise((resolve) => setTimeout(resolve, 10));
	if (userId === 1) {
		return okAsync(["order-1", "order-2"]);
	}

	return errAsync(`No orders for user ${userId}`);
}

async function main() {
	const result1 = await chain(async function* () {
		const userResult = await fetchUser(1);
		const user = yield* userResult;

		const ordersResult = await fetchOrders(user.id);
		const orders = yield* ordersResult;

		return { user, orders };
	});
	console.log(result1.unwrap());
	// { user: { id: 1, name: "Alice" }, orders: ["order-1", "order-2"] }

	const result2 = await chain(async function* () {
		const userResult = await fetchUser(999);
		const user = yield* userResult;

		const ordersResult = await fetchOrders(user.id);
		const orders = yield* ordersResult;

		return { user, orders };
	});
	console.log(result2.unwrapErr()); // "User 999 not found"

	const dataResult = chain(async function* () {
		const user = yield* await fetchUser(1);
		const orders = yield* await fetchOrders(user.id);

		const processedOrders = await Promise.all(
			orders.map(async (orderId) => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return { orderId, status: "processed" };
			}),
		);

		return { userName: user.name, processedOrders };
	});

	const data = await dataResult;
	console.log(data.unwrap());
}

main();
