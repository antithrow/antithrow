// Sync hot paths: construction, chaining, try, unwrap, settle.
import { bench, boxplot, do_not_optimize, group, run, summary } from "mitata";
import { Err, Ok, Result } from "../packages/antithrow/dist/index.js";
import {
	err as legacyErr,
	ok as legacyOk,
	Result as LegacyResult,
} from "../packages/antithrow/dist/legacy/index.js";

// --- construction -----------------------------------------------------------
group("construct Ok", () => {
	summary(() => {
		bench("new Ok(i)", function* () {
			let i = 0;
			yield () => do_not_optimize(new Ok(i++));
		});
		bench("legacy ok(i)", function* () {
			let i = 0;
			yield () => do_not_optimize(legacyOk(i++));
		});
		bench("object literal {ok,value}", function* () {
			let i = 0;
			yield () => do_not_optimize({ ok: true, value: i++ });
		});
	});
});

// --- single map -------------------------------------------------------------
const okVal = new Ok(42);
const errVal = new Err("failed");
const legacyOkVal = legacyOk(42);
const double = (x) => x * 2;

group("single map", () => {
	summary(() => {
		bench("Ok.map (allocates)", () => do_not_optimize(okVal.map(double)));
		bench("Err.map (returns this)", () => do_not_optimize(errVal.map(double)));
		bench("legacy Ok.map", () => do_not_optimize(legacyOkVal.map(double)));
	});
});

// --- 3-step happy-path chain ------------------------------------------------
const parseNum = (s) => {
	const n = Number(s);
	return Number.isFinite(n) ? new Ok(n) : new Err({ type: "nan", raw: s });
};
const checkRange = (n) => (n > 0 && n < 65536 ? new Ok(n) : new Err({ type: "range", n }));
const legacyParseNum = (s) => {
	const n = Number(s);
	return Number.isFinite(n) ? legacyOk(n) : legacyErr({ type: "nan", raw: s });
};
const legacyCheckRange = (n) => (n > 0 && n < 65536 ? legacyOk(n) : legacyErr({ type: "range", n }));

// try/catch baseline
const parseNumThrow = (s) => {
	const n = Number(s);
	if (!Number.isFinite(n)) throw { type: "nan", raw: s };
	return n;
};
const checkRangeThrow = (n) => {
	if (!(n > 0 && n < 65536)) throw { type: "range", n };
	return n;
};

group("3-step chain (happy path)", () => {
	summary(() => {
		bench("modern: andThen chain", () =>
			do_not_optimize(parseNum("8080").andThen(checkRange).map(double).unwrapOr(0)),
		);
		bench("legacy: andThen chain", () =>
			do_not_optimize(legacyParseNum("8080").andThen(legacyCheckRange).map(double).unwrapOr(0)),
		);
		bench("baseline: try/catch", () => {
			try {
				return do_not_optimize(double(checkRangeThrow(parseNumThrow("8080"))));
			} catch {
				return do_not_optimize(0);
			}
		});
	});
});

group("3-step chain (failure at step 1)", () => {
	summary(() => {
		bench("modern: andThen chain", () =>
			do_not_optimize(parseNum("oops").andThen(checkRange).map(double).unwrapOr(0)),
		);
		bench("legacy: andThen chain", () =>
			do_not_optimize(legacyParseNum("oops").andThen(legacyCheckRange).map(double).unwrapOr(0)),
		);
		bench("baseline: try/catch (throw)", () => {
			try {
				return do_not_optimize(double(checkRangeThrow(parseNumThrow("oops"))));
			} catch {
				return do_not_optimize(0);
			}
		});
	});
});

// --- Result.try -------------------------------------------------------------
group("Result.try (sync, success)", () => {
	summary(() => {
		bench("Result.try(() => JSON.parse)", () =>
			do_not_optimize(Result.try(() => JSON.parse('{"a":1}'))),
		);
		bench("legacy Result.try", () =>
			do_not_optimize(LegacyResult.try(() => JSON.parse('{"a":1}'))),
		);
		bench("baseline: bare try/catch", () => {
			try {
				return do_not_optimize({ ok: true, value: JSON.parse('{"a":1}') });
			} catch (e) {
				return do_not_optimize({ ok: false, error: e });
			}
		});
	});
});

group("Result.try (sync, throwing)", () => {
	summary(() => {
		bench("Result.try(() => JSON.parse) [bad]", () =>
			do_not_optimize(Result.try(() => JSON.parse("nope"))),
		);
		bench("baseline: bare try/catch [bad]", () => {
			try {
				return do_not_optimize({ ok: true, value: JSON.parse("nope") });
			} catch (e) {
				return do_not_optimize({ ok: false, error: e });
			}
		});
	});
});

// --- unwrapOr / isOk narrowing ---------------------------------------------
group("consume", () => {
	summary(() => {
		bench("unwrapOr", () => do_not_optimize(okVal.unwrapOr(0)));
		bench("isOk() + .value", () => do_not_optimize(okVal.isOk() ? okVal.value : 0));
		bench("mapOrElse", () =>
			do_not_optimize(
				okVal.mapOrElse(
					() => 0,
					(v) => v,
				),
			),
		);
	});
});

// --- settle allocation ------------------------------------------------------
group("settle() on settled results", () => {
	summary(() => {
		bench("Ok.settle() [allocates Promise]", () => do_not_optimize(okVal.settle()));
		bench("baseline: Promise.resolve(obj)", () => do_not_optimize(Promise.resolve(okVal)));
	});
});

await run();
