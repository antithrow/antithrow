// Realistic batch workloads: validate/transform 10k records, varying error rates.
import { bench, do_not_optimize, group, run, summary } from "mitata";
import { Err, Ok } from "../packages/antithrow/dist/index.js";

function makeRecords(n, errEvery) {
	const recs = [];
	for (let i = 0; i < n; i++) {
		recs.push({
			id: i,
			email: i % errEvery === 0 ? "bad-email" : `user${i}@example.com`,
			age: String(20 + (i % 50)),
		});
	}
	return recs;
}

const validateEmail = (r) =>
	r.email.includes("@") ? new Ok(r) : new Err({ id: r.id, type: "email" });
const parseAge = (r) => {
	const age = Number(r.age);
	return Number.isFinite(age) && age >= 18
		? new Ok({ ...r, age })
		: new Err({ id: r.id, type: "age" });
};

const validateEmailThrow = (r) => {
	if (!r.email.includes("@")) throw { id: r.id, type: "email" };
	return r;
};
const parseAgeThrow = (r) => {
	const age = Number(r.age);
	if (!(Number.isFinite(age) && age >= 18)) throw { id: r.id, type: "age" };
	return { ...r, age };
};

for (const [label, errEvery] of [
	["10% errors", 10],
	["50% errors", 2],
]) {
	const records = makeRecords(10_000, errEvery);
	group(`10k records, 2-step validation, ${label}`, () => {
		summary(() => {
			bench("Result: andThen + isOk partition", () => {
				const good = [];
				const bad = [];
				for (const r of records) {
					const res = validateEmail(r).andThen(parseAge);
					if (res.isOk()) good.push(res.value);
					else bad.push(res.error);
				}
				return do_not_optimize(good.length + bad.length);
			});
			bench("baseline: try/catch per record", () => {
				const good = [];
				const bad = [];
				for (const r of records) {
					try {
						good.push(parseAgeThrow(validateEmailThrow(r)));
					} catch (e) {
						bad.push(e);
					}
				}
				return do_not_optimize(good.length + bad.length);
			});
			bench("baseline: null-return + manual check", () => {
				const good = [];
				const bad = [];
				for (const r of records) {
					if (!r.email.includes("@")) {
						bad.push({ id: r.id, type: "email" });
						continue;
					}
					const age = Number(r.age);
					if (!(Number.isFinite(age) && age >= 18)) {
						bad.push({ id: r.id, type: "age" });
						continue;
					}
					good.push({ ...r, age });
				}
				return do_not_optimize(good.length + bad.length);
			});
		});
	});
}

await run();
