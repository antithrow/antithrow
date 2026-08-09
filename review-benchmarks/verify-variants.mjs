const variants = ["noext", "fastiter", "both", "hoist", "lean"];
const base = "./variants";
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

for (const v of variants) {
	const { Ok, Err, Pending, Result } = await import(`${base}/${v}/index.js`);

	// sync do: happy
	const r1 = Result.do(function* () {
		const a = yield* new Ok(20);
		const b = yield* new Ok(22);
		return a + b;
	});
	assert(r1.isOk() && r1.unwrap() === 42, `${v}: sync happy`);

	// sync do: fail-fast + finally cleanup
	let cleaned = false;
	const r2 = Result.do(function* () {
		try {
			yield* new Ok(1);
			yield* new Err("boom");
			return 0;
		} finally {
			cleaned = true;
		}
	});
	assert(r2.isErr() && r2.unwrapErr() === "boom" && cleaned, `${v}: sync fail cleanup`);

	// async do: happy with yield* Pending
	const r3 = await Result.do(async function* () {
		const a = yield* new Pending(Promise.resolve(new Ok(20)));
		const b = yield* new Ok(22);
		return a + b;
	}).settle();
	assert(r3.isOk() && r3.unwrap() === 42, `${v}: async happy`);

	// async do: fail via Pending->Err + cleanup
	let cleaned2 = false;
	const r4 = await Result.do(async function* () {
		try {
			yield* new Ok(1);
			const x = yield* new Pending(Promise.resolve(new Err("bad")));
			return x;
		} finally {
			cleaned2 = true;
		}
	}).settle();
	assert(r4.isErr() && r4.unwrapErr() === "bad" && cleaned2, `${v}: async fail cleanup`);

	// chains
	const r5 = new Ok(2).map((x) => x + 1).andThen((x) => new Ok(x * 2)).unwrapOr(0);
	assert(r5 === 6, `${v}: chain`);
	const r6 = await Result.fromPromise(Promise.reject("nope")).mapErr((e) => e + "!").settle();
	assert(r6.isErr() && r6.unwrapErr() === "nope!", `${v}: fromPromise reject`);

	// flatten + instanceof still works
	const r7 = new Ok(new Err("inner")).flatten();
	assert(r7.isErr() && r7.unwrapErr() === "inner", `${v}: flatten`);

	// state checks
	assert(new Ok(1).isOk() && !new Ok(1).isErr() && new Err(1).isErr() && new Pending(Promise.resolve(new Ok(1))).isPending(), `${v}: states`);
	console.log(`${v}: all OK`);
}
