// Async paths: fromPromise, Pending chains, async Result.do vs native async/await.
import { bench, do_not_optimize, group, run, summary } from "mitata";
import { Err, Ok, Pending, Result } from "../packages/antithrow/dist/index.js";
import { ResultAsync, okAsync } from "../packages/antithrow/dist/legacy/index.js";

const double = (x) => x * 2;

group("wrap + await (single async value)", () => {
	summary(() => {
		bench("Result.fromPromise + await", async () => {
			const r = await Result.fromPromise(Promise.resolve(42));
			return do_not_optimize(r);
		});
		bench("legacy ResultAsync.fromPromise + await", async () => {
			const r = await ResultAsync.fromPromise(Promise.resolve(42));
			return do_not_optimize(r);
		});
		bench("baseline: await promise", async () => {
			const v = await Promise.resolve(42);
			return do_not_optimize(v);
		});
		bench("baseline: await promise + try/catch", async () => {
			try {
				const v = await Promise.resolve(42);
				return do_not_optimize(v);
			} catch (e) {
				return do_not_optimize(e);
			}
		});
	});
});

group("3-step async chain", () => {
	summary(() => {
		bench("Pending: map->map->map + await", async () => {
			const r = await Result.fromPromise(Promise.resolve(1)).map(double).map(double).map(double);
			return do_not_optimize(r);
		});
		bench("legacy ResultAsync: map x3 + await", async () => {
			const r = await okAsync(1).map(double).map(double).map(double);
			return do_not_optimize(r);
		});
		bench("baseline: promise.then x3 + await", async () => {
			const v = await Promise.resolve(1).then(double).then(double).then(double);
			return do_not_optimize(v);
		});
		bench("baseline: async/await sequential", async () => {
			let v = await Promise.resolve(1);
			v = double(v);
			v = double(v);
			v = double(v);
			return do_not_optimize(v);
		});
	});
});

// Simulated request handler: three dependent async ops, error checked between each.
const fetchUser = (id) =>
	Result.fromPromise(Promise.resolve({ id, name: "u" + id }));
const fetchOrgSettled = (user) =>
	user.id % 10 === 9
		? new Err({ status: 404, message: "no org" })
		: new Ok({ org: "org-" + user.id });
const save = (org) => Result.fromPromise(Promise.resolve({ saved: true, ...org }));

const fetchUserRaw = (id) => Promise.resolve({ id, name: "u" + id });
const fetchOrgRaw = (user) => {
	if (user.id % 10 === 9) throw { status: 404, message: "no org" };
	return { org: "org-" + user.id };
};
const saveRaw = (org) => Promise.resolve({ saved: true, ...org });

group("request handler (3 async steps, happy)", () => {
	summary(() => {
		bench("Result.do async + yield*", async () => {
			const r = await Result.do(async function* () {
				const user = yield* fetchUser(1);
				const org = yield* fetchOrgSettled(user);
				return yield* save(org);
			}).settle();
			return do_not_optimize(r);
		});
		bench("Pending andThen chain", async () => {
			const r = await fetchUser(1).andThen(fetchOrgSettled).andThen(save).settle();
			return do_not_optimize(r);
		});
		bench("baseline: async/await + try/catch", async () => {
			try {
				const user = await fetchUserRaw(1);
				const org = fetchOrgRaw(user);
				const saved = await saveRaw(org);
				return do_not_optimize({ ok: true, value: saved });
			} catch (e) {
				return do_not_optimize({ ok: false, error: e });
			}
		});
	});
});

group("request handler (fails at step 2)", () => {
	summary(() => {
		bench("Result.do async + yield*", async () => {
			const r = await Result.do(async function* () {
				const user = yield* fetchUser(9);
				const org = yield* fetchOrgSettled(user);
				return yield* save(org);
			}).settle();
			return do_not_optimize(r);
		});
		bench("Pending andThen chain", async () => {
			const r = await fetchUser(9).andThen(fetchOrgSettled).andThen(save).settle();
			return do_not_optimize(r);
		});
		bench("baseline: async/await + try/catch (throws)", async () => {
			try {
				const user = await fetchUserRaw(9);
				const org = fetchOrgRaw(user);
				const saved = await saveRaw(org);
				return do_not_optimize({ ok: true, value: saved });
			} catch (e) {
				return do_not_optimize({ ok: false, error: e });
			}
		});
	});
});

// await Pending vs await settle(): does the PromiseLike hop cost anything?
group("await pending directly vs settle()", () => {
	summary(() => {
		bench("await pending", async () => {
			const r = await Result.fromPromise(Promise.resolve(42));
			return do_not_optimize(r);
		});
		bench("await pending.settle()", async () => {
			const r = await Result.fromPromise(Promise.resolve(42)).settle();
			return do_not_optimize(r);
		});
	});
});

await run();
