# Generates patched copies of packages/antithrow/dist used by ab.mjs / construct2.mjs / lean-e2e.mjs.
# Run from review-benchmarks/: `python3 make-variants.py` (build the package first).
#
# Variants:
#   noext    - Ok/Err/Pending no longer `extends ResultBase` (no super() call)
#   fastiter - generator-based [Symbol.iterator]/[Symbol.asyncIterator] replaced
#              with hand-written iterator objects
#   both     - noext + fastiter
#   hoist    - fromPromise per-call closures hoisted to module scope
#   lean     - noext + the `value;`/`error;`/`promise;` field pre-initialization
#              removed (matches the legacy API's emitted constructor shape)
import pathlib
import re
import shutil

HERE = pathlib.Path(__file__).parent
DIST = HERE / ".." / "packages" / "antithrow" / "dist"
OUT = HERE / "variants"

OK_ITER = """    [Symbol.iterator]() {
        const value = this.value;
        return {
            next: () => ({ done: true, value }),
            [Symbol.iterator]() { return this; },
        };
    }"""

ERR_ITER = """    [Symbol.iterator]() {
        let yielded = false;
        return {
            next: () => {
                if (yielded) throw new Error("Unreachable: generator should have been halted");
                yielded = true;
                return { done: false, value: this };
            },
            return: (value) => ({ done: true, value }),
            [Symbol.iterator]() { return this; },
        };
    }"""

PENDING_ITER = """    [Symbol.asyncIterator]() {
        let yielded = false;
        return {
            next: async () => {
                if (yielded) throw new Error("Unreachable: generator should have been halted");
                const settled = await this.promise;
                if (settled.isErr()) {
                    yielded = true;
                    return { done: false, value: settled };
                }
                return { done: true, value: settled.value };
            },
            return: async (value) => ({ done: true, value }),
            [Symbol.asyncIterator]() { return this; },
        };
    }"""


def strip_extends(d, strip_fields=False):
    for name, field in [("ok.js", "value"), ("err.js", "error"), ("pending.js", "promise")]:
        p = d / name
        s = p.read_text()
        s = re.sub(r'import \{ ResultBase \} from "\./base\.js";\n', "", s)
        s = s.replace(" extends ResultBase", "")
        s = re.sub(r"\n\s*super\(\);", "", s)
        if strip_fields:
            s = re.sub(rf"\n    {field};(\n    constructor)", r"\1", s)
            assert f"\n    {field};" not in s
        p.write_text(s)


def fast_iters(d):
    p = d / "ok.js"
    s = p.read_text()
    s = re.sub(
        r"    // biome-ignore[^\n]*\n    \*\[Symbol\.iterator\]\(\) \{\n        return this\.value;\n    \}",
        OK_ITER,
        s,
    )
    assert "next: () => ({ done: true, value })" in s
    p.write_text(s)
    p = d / "err.js"
    s = p.read_text()
    s = re.sub(
        r"    \*\[Symbol\.iterator\]\(\) \{\n        yield this;\n        throw new Error\(\"Unreachable: generator should have been halted\"\);\n    \}",
        ERR_ITER,
        s,
    )
    assert "yielded = true;" in s
    p.write_text(s)
    p = d / "pending.js"
    s = p.read_text()
    s = re.sub(
        r"    async \*\[Symbol\.asyncIterator\]\(\) \{\n        return yield\* await this\.promise;\n    \}",
        PENDING_ITER,
        s,
    )
    assert "settled.isErr()" in s
    p.write_text(s)


def hoist(d):
    p = d / "result.js"
    s = p.read_text()
    old = """function fromPromise(promise) {
    return new Pending(promise.then((ok) => new Ok(ok), (err) => new Err(err)));
}"""
    new = """const wrapOk = (ok) => new Ok(ok);
const wrapErr = (err) => new Err(err);
function fromPromise(promise) {
    return new Pending(promise.then(wrapOk, wrapErr));
}"""
    assert old in s
    p.write_text(s.replace(old, new))


if OUT.exists():
    shutil.rmtree(OUT)
for v in ["noext", "fastiter", "both", "hoist", "lean"]:
    shutil.copytree(DIST, OUT / v)
    shutil.rmtree(OUT / v / "legacy")

strip_extends(OUT / "noext")
fast_iters(OUT / "fastiter")
strip_extends(OUT / "both")
fast_iters(OUT / "both")
hoist(OUT / "hoist")
strip_extends(OUT / "lean", strip_fields=True)
print("variants ready in", OUT)
