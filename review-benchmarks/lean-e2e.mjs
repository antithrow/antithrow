import { bench, do_not_optimize, group, run, summary } from "mitata";
const stock = await import("../packages/antithrow/dist/index.js");
const lean = await import("./variants/lean/index.js");

const INPUTS = [];
for (let i = 0; i < 1000; i++) INPUTS.push(i % 10 === 9 ? "not-a-number" : String(1 + (i % 60000)));

function makeOps({ Ok, Err }) {
	return {
		parseNum: (s) => { const n = Number(s); return Number.isFinite(n) ? new Ok(n) : new Err({ type: "nan", raw: s }); },
		checkRange: (n) => (n > 0 && n < 65536 ? new Ok(n) : new Err({ type: "range", n })),
		addOffset: (n) => new Ok(n + 1000),
	};
}

group("andThen chain x3 (varied, 10% err)", () => {
	summary(() => {
		for (const [name, mod] of [["stock", stock], ["lean", lean]]) {
			const ops = makeOps(mod);
			bench(name, function* () {
				let i = 0;
				yield () => {
					const s = INPUTS[i++ % INPUTS.length];
					return do_not_optimize(ops.parseNum(s).andThen(ops.checkRange).andThen(ops.addOffset).unwrapOr(0));
				};
			});
		}
	});
});

const records = [];
for (let i = 0; i < 10_000; i++) records.push({ id: i, email: i % 10 === 0 ? "bad" : `u${i}@x.com`, age: String(20 + (i % 50)) });

group("10k batch validation (10% err)", () => {
	summary(() => {
		for (const [name, mod] of [["stock", stock], ["lean", lean]]) {
			const { Ok, Err } = mod;
			const vEmail = (r) => (r.email.includes("@") ? new Ok(r) : new Err({ id: r.id, type: "email" }));
			const pAge = (r) => { const age = Number(r.age); return age >= 18 ? new Ok({ ...r, age }) : new Err({ id: r.id, type: "age" }); };
			bench(name, () => {
				let good = 0, bad = 0;
				for (const r of records) {
					const res = vEmail(r).andThen(pAge);
					if (res.isOk()) good++; else bad++;
				}
				return do_not_optimize(good + bad);
			});
		}
	});
});

group("Result.do sync x3 (varied, 10% err)", () => {
	summary(() => {
		for (const [name, mod] of [["stock", stock], ["lean", lean]]) {
			const ops = makeOps(mod);
			const { Result } = mod;
			bench(name, function* () {
				let i = 0;
				yield () => {
					const s = INPUTS[i++ % INPUTS.length];
					return do_not_optimize(Result.do(function* () {
						const a = yield* ops.parseNum(s);
						const b = yield* ops.checkRange(a);
						return yield* ops.addOffset(b);
					}));
				};
			});
		}
	});
});
await run();
