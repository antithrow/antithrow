/**
 * Example 08: Chain (Synchronous)
 *
 * Demonstrates the chain function for early-return style error handling
 * using generator syntax.
 */
import type { Result } from "antithrow";
import { chain, err, ok } from "antithrow";

function parseNumber(s: string): Result<number, string> {
	const n = Number(s);
	return Number.isNaN(n) ? err(`Invalid number: ${s}`) : ok(n);
}

function divide(a: number, b: number): Result<number, string> {
	return b === 0 ? err("Division by zero") : ok(a / b);
}

const result1 = chain(function* () {
	const a = yield* parseNumber("10");
	const b = yield* parseNumber("2");
	const quotient = yield* divide(a, b);
	return quotient * 2;
});
console.log(result1.unwrap()); // 10

const result2 = chain(function* () {
	const a = yield* parseNumber("10");
	const b = yield* parseNumber("0");
	const quotient = yield* divide(a, b);
	return quotient;
});
console.log(result2.unwrapErr()); // "Division by zero"

const result3 = chain(function* () {
	const a = yield* parseNumber("abc");
	const b = yield* parseNumber("2");
	return a + b;
});
console.log(result3.unwrapErr()); // "Invalid number: abc"

interface Order {
	id: string;
	items: Array<{ name: string; price: number; quantity: number }>;
	discount: number;
}

function calculateTotal(order: Order): Result<number, string> {
	return chain(function* () {
		if (order.items.length === 0) {
			return yield* err("Order has no items");
		}

		const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

		if (order.discount < 0 || order.discount > 1) {
			return yield* err("Invalid discount");
		}

		return subtotal * (1 - order.discount);
	});
}

const order: Order = {
	id: "123",
	items: [
		{ name: "Widget", price: 10, quantity: 2 },
		{ name: "Gadget", price: 25, quantity: 1 },
	],
	discount: 0.1,
};
console.log(calculateTotal(order).unwrap()); // 40.5
