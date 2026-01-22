/**
 * Example 08: Chain (Synchronous)
 *
 * Deeply nested andThen() chains can become hard to read. The chain()
 * function uses generator syntax to provide early-return style:
 * yield* unwraps an Ok or exits immediately on Err—like Rust's ? operator.
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

// chain() takes a generator function. Inside, yield* unwraps each Result:
// - If Ok, the value is returned and execution continues
// - If Err, the generator exits immediately with that error
const result1 = chain(function* () {
	const a = yield* parseNumber("10"); // a = 10
	const b = yield* parseNumber("2"); // b = 2
	const quotient = yield* divide(a, b); // quotient = 5
	return quotient * 2; // Final value wrapped in Ok
});
console.log(result1.unwrap()); // 10

// When any step fails, subsequent steps are never executed.
// Here divide(10, 0) fails, so the generator exits with that error
const result2 = chain(function* () {
	const a = yield* parseNumber("10");
	const b = yield* parseNumber("0");
	const quotient = yield* divide(a, b); // Fails here
	return quotient;
});
console.log(result2.unwrapErr()); // "Division by zero"

// The first error wins—parseNumber("abc") fails before we even try "2"
const result3 = chain(function* () {
	const a = yield* parseNumber("abc"); // Fails here
	const b = yield* parseNumber("2");
	return a + b;
});
console.log(result3.unwrapErr()); // "Invalid number: abc"

// chain() shines for complex validation with multiple exit points.
// Use `yield* err(...)` to bail out early with a custom error
interface Order {
	id: string;
	items: Array<{ name: string; price: number; quantity: number }>;
	discount: number;
}

function calculateTotal(order: Order): Result<number, string> {
	return chain(function* () {
		if (order.items.length === 0) {
			return yield* err("Order has no items"); // Early exit
		}

		const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

		if (order.discount < 0 || order.discount > 1) {
			return yield* err("Invalid discount"); // Early exit
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
