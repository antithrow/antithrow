// Result.do generator overhead vs andThen chains vs imperative early-return.
import { bench, do_not_optimize, group, run, summary } from "mitata";
import { Err, Ok, Result } from "../packages/antithrow/dist/index.js";
import { chain as legacyChain, err as legacyErr, ok as legacyOk } from "../packages/antithrow/dist/legacy/index.js";

const parseNum = (s) => {
	const n = Number(s);
	return Number.isFinite(n) ? new Ok(n) : new Err({ type: "nan", raw: s });
};
const checkRange = (n) => (n > 0 && n < 65536 ? new Ok(n) : new Err({ type: "range", n }));
const addOffset = (n) => new Ok(n + 1000);

const legacyParseNum = (s) => {
	const n = Number(s);
	return Number.isFinite(n) ? legacyOk(n) : legacyErr({ type: "nan", raw: s });
};
const legacyCheckRange = (n) => (n > 0 && n < 65536 ? legacyOk(n) : legacyErr({ type: "range", n }));
const legacyAddOffset = (n) => legacyOk(n + 1000);

group("3-step composition (happy path)", () => {
	summary(() => {
		bench("Result.do + yield*", () =>
			do_not_optimize(
				Result.do(function* () {
					const a = yield* parseNum("8080");
					const b = yield* checkRange(a);
					const c = yield* addOffset(b);
					return c;
				}),
			),
		);
		bench("legacy chain()", () =>
			do_not_optimize(
				legacyChain(function* () {
					const a = yield* legacyParseNum("8080");
					const b = yield* legacyCheckRange(a);
					const c = yield* legacyAddOffset(b);
					return c;
				}),
			),
		);
		bench("andThen chain", () =>
			do_not_optimize(parseNum("8080").andThen(checkRange).andThen(addOffset)),
		);
		bench("imperative isOk early-return", () => {
			const a = parseNum("8080");
			if (!a.isOk()) return do_not_optimize(a);
			const b = checkRange(a.value);
			if (!b.isOk()) return do_not_optimize(b);
			return do_not_optimize(addOffset(b.value));
		});
	});
});

group("3-step composition (fail at step 2)", () => {
	summary(() => {
		bench("Result.do + yield*", () =>
			do_not_optimize(
				Result.do(function* () {
					const a = yield* parseNum("99999999");
					const b = yield* checkRange(a);
					return yield* addOffset(b);
				}),
			),
		);
		bench("andThen chain", () =>
			do_not_optimize(parseNum("99999999").andThen(checkRange).andThen(addOffset)),
		);
		bench("imperative isOk early-return", () => {
			const a = parseNum("99999999");
			if (!a.isOk()) return do_not_optimize(a);
			const b = checkRange(a.value);
			if (!b.isOk()) return do_not_optimize(b);
			return do_not_optimize(addOffset(b.value));
		});
	});
});

// 10-step chain: amortized per-step cost at depth
group("10-step map chain (happy path)", () => {
	summary(() => {
		const inc = (x) => x + 1;
		bench("modern 10x map", () => {
			let r = new Ok(0);
			for (let i = 0; i < 10; i++) r = r.map(inc);
			return do_not_optimize(r);
		});
		bench("Result.do 10x yield*", () =>
			do_not_optimize(
				Result.do(function* () {
					let v = 0;
					for (let i = 0; i < 10; i++) v = yield* new Ok(v + 1);
					return v;
				}),
			),
		);
		bench("baseline: 10x plain calls", () => {
			let v = 0;
			for (let i = 0; i < 10; i++) v = inc(v);
			return do_not_optimize(v);
		});
	});
});

await run();
