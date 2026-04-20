import ts from "typescript";

const RESULT_TYPE_NAMES = new Set(["Ok", "Err", "Pending"]);
const FIXABLE_OK_TYPE_NAMES = new Set(["Ok"]);
const FIXABLE_ERR_TYPE_NAMES = new Set(["Err"]);
export const NULLISH_TYPE_FLAGS = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;

export const ResultVariant = {
	NONE: "none",
	OK: "ok",
	ERR: "err",
	MIXED: "mixed",
} as const;
export type ResultVariant = (typeof ResultVariant)[keyof typeof ResultVariant];

function isAntithrowSourceFile(sourceFileName: string): boolean {
	const pathSegments = sourceFileName.replaceAll("\\", "/").split("/");

	for (const [index, segment] of pathSegments.entries()) {
		if (segment !== "antithrow") {
			continue;
		}

		if (!pathSegments.slice(index + 1).includes("legacy")) {
			return true;
		}
	}

	return false;
}

function isAntithrowResultTypeSymbol(symbol: ts.Symbol): boolean {
	if (!RESULT_TYPE_NAMES.has(symbol.getName())) {
		return false;
	}

	const declarations = symbol.getDeclarations() ?? [];

	return declarations.some((decl) => {
		const sourceFile = decl.getSourceFile();
		return isAntithrowSourceFile(sourceFile.fileName);
	});
}

interface ResultTypeCollection {
	hasNonResultMembers: boolean;
	names: Set<string>;
}

function collectResultTypes(type: ts.Type, collection: ResultTypeCollection): void {
	if (type.isUnion()) {
		for (const member of type.types) {
			collectResultTypes(member, collection);
		}

		return;
	}

	const flags = type.getFlags();
	if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | NULLISH_TYPE_FLAGS)) {
		return;
	}

	const symbol = type.getSymbol();
	if (!(symbol && isAntithrowResultTypeSymbol(symbol))) {
		collection.hasNonResultMembers = true;
		return;
	}

	collection.names.add(symbol.getName());
}

export function getResultVariant(type: ts.Type): ResultVariant {
	const collection: ResultTypeCollection = {
		hasNonResultMembers: false,
		names: new Set<string>(),
	};
	collectResultTypes(type, collection);
	const { names } = collection;

	if (names.size === 0) {
		return ResultVariant.NONE;
	}

	if (collection.hasNonResultMembers) {
		return ResultVariant.MIXED;
	}

	if (names.has("Pending")) {
		return ResultVariant.MIXED;
	}

	if (names.isSubsetOf(FIXABLE_OK_TYPE_NAMES)) {
		return ResultVariant.OK;
	}

	if (names.isSubsetOf(FIXABLE_ERR_TYPE_NAMES)) {
		return ResultVariant.ERR;
	}

	return ResultVariant.MIXED;
}

/**
 * Determines whether a type originates from antithrow's `Result` family.
 *
 * `Result<T, E>` is a union of `Ok<T, E> | Err<T, E> | Pending<T, E>`, so we
 * recurse into union members. We also guard against `any`/`unknown`/`never` to
 * avoid false positives on untyped code. Finally, we verify the symbol's
 * declaration lives inside the root `antithrow` entrypoint (excluding the
 * `antithrow/legacy` subpath) so that unrelated types with the same names
 * (e.g. a user-defined `Ok` class or the legacy `Ok`) are not flagged.
 */
export function isResultType(type: ts.Type): boolean {
	return getResultVariant(type) !== ResultVariant.NONE;
}
