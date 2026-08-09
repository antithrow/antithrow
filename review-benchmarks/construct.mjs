import { bench, do_not_optimize, group, run, summary } from "mitata";
import { Ok } from "../packages/antithrow/dist/index.js";
import { Ok as LegacyOk, ok as legacyOk } from "../packages/antithrow/dist/legacy/index.js";

const mkOk = (v) => new Ok(v);

group("construction call shapes", () => {
	summary(() => {
		bench("new Ok(i) [modern]", function* () {
			let i = 0;
			yield () => do_not_optimize(new Ok(i++));
		});
		bench("factory mkOk(i) [modern]", function* () {
			let i = 0;
			yield () => do_not_optimize(mkOk(i++));
		});
		bench("new LegacyOk(i)", function* () {
			let i = 0;
			yield () => do_not_optimize(new LegacyOk(i++));
		});
		bench("legacy ok(i) factory", function* () {
			let i = 0;
			yield () => do_not_optimize(legacyOk(i++));
		});
	});
});
await run();
