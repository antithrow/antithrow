// A/B: stock dist vs patched variants. Varied inputs to prevent constant folding.
import { bench, do_not_optimize, group, run, summary } from "mitata";

const V = "./variants";
const stock = await import("../packages/antithrow/dist/index.js");
const noext = await import(`${V}/noext/index.js`);
const fastiter = await import(`${V}/fastiter/index.js`);
const both = await import(`${V}/both/index.js`);
const hoist = await import(`${V}/hoist/index.js`);

// cycling inputs, ~10% invalid
const INPUTS = [];
for (let i = 0; i < 1000; i++) INPUTS.push(i % 10 === 9 ? "not-a-number" : String(1 + (i % 60000)));

function makeOps({ Ok, Err }) {
	return {
		parseNum: (s) => {
			const n = Number(s);
			return Number.isFinite(n) ? new Ok(n) : new Err({ type: "nan", raw: s });
		},
		checkRange: (n) => (n > 0 && n < 65536 ? new Ok(n) : new Err({ type: "range", n })),
		addOffset: (n) => new Ok(n + 1000),
	};
}

const variants = { stock, noext, fastiter, both };

// --- construction ----------------------------------------------------------
group("construct: new Ok(i)", () => {
	summary(() => {
		for (const [name, mod] of Object.entries({ stock, noext })) {
			bench(`${name}`, function* () {
				let i = 0;
				yield () => do_not_optimize(new mod.Ok(i++));
			});
		}
	});
});

// --- 3-step andThen chain, varied inputs -----------------------------------
group("andThen chain x3 (varied inputs, 10% err)", () => {
	summary(() => {
		for (const [name, mod] of Object.entries({ stock, noext })) {
			const ops = makeOps(mod);
			bench(`${name}`, function* () {
				let i = 0;
				yield () => {
					const s = INPUTS[i++ % INPUTS.length];
					return do_not_optimize(
						ops.parseNum(s).andThen(ops.checkRange).andThen(ops.addOffset).unwrapOr(0),
					);
				};
			});
		}
		// honest baselines with the same varied inputs
		bench("baseline try/catch", function* () {
			const parse = (s) => {
				const n = Number(s);
				if (!Number.isFinite(n)) throw { type: "nan", raw: s };
				return n;
			};
			const range = (n) => {
				if (!(n > 0 && n < 65536)) throw { type: "range", n };
				return n;
			};
			let i = 0;
			yield () => {
				const s = INPUTS[i++ % INPUTS.length];
				try {
					return do_not_optimize(range(parse(s)) + 1000);
				} catch {
					return do_not_optimize(0);
				}
			};
		});
	});
});

// --- Result.do sync, varied inputs -----------------------------------------
group("Result.do sync x3 (varied inputs, 10% err)", () => {
	summary(() => {
		for (const [name, mod] of Object.entries(variants)) {
			const ops = makeOps(mod);
			const { Result } = mod;
			bench(`${name}`, function* () {
				let i = 0;
				yield () => {
					const s = INPUTS[i++ % INPUTS.length];
					return do_not_optimize(
						Result.do(function* () {
							const a = yield* ops.parseNum(s);
							const b = yield* ops.checkRange(a);
							return yield* ops.addOffset(b);
						}),
					);
				};
			});
		}
	});
});

// --- Result.do async request handler ---------------------------------------
group("Result.do async request handler (happy)", () => {
	summary(() => {
		for (const [name, mod] of Object.entries(variants)) {
			const { Ok, Err, Result } = mod;
			const fetchUser = (id) => Result.fromPromise(Promise.resolve({ id, name: "u" + id }));
			const fetchOrg = (user) =>
				user.id % 10 === 9 ? new Err({ status: 404 }) : new Ok({ org: "org-" + user.id });
			const save = (org) => Result.fromPromise(Promise.resolve({ saved: true, ...org }));
			bench(`${name}`, function* () {
				let i = 0;
				yield async () => {
					const id = i++ % 8; // always happy
					const r = await Result.do(async function* () {
						const user = yield* fetchUser(id);
						const org = yield* fetchOrg(user);
						return yield* save(org);
					}).settle();
					return do_not_optimize(r);
				};
			});
		}
	});
});

// --- fromPromise closure hoisting ------------------------------------------
group("fromPromise + await settle", () => {
	summary(() => {
		for (const [name, mod] of Object.entries({ stock, hoist })) {
			const { Result } = mod;
			bench(`${name}`, function* () {
				let i = 0;
				yield async () => do_not_optimize(await Result.fromPromise(Promise.resolve(i++)).settle());
			});
		}
	});
});

await run();
