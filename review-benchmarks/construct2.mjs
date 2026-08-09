import { bench, do_not_optimize, group, run, summary } from "mitata";
import { Ok } from "../packages/antithrow/dist/index.js";
import { Ok as LeanOk } from "./variants/lean/index.js";
import { Ok as LegacyOk } from "../packages/antithrow/dist/legacy/index.js";
group("construction: emit shapes", () => {
	summary(() => {
		bench("stock (field pre-init + super)", function* () { let i = 0; yield () => do_not_optimize(new Ok(i++)); });
		bench("lean (no field pre-init, no super)", function* () { let i = 0; yield () => do_not_optimize(new LeanOk(i++)); });
		bench("legacy class (reference)", function* () { let i = 0; yield () => do_not_optimize(new LegacyOk(i++)); });
	});
});
await run();
