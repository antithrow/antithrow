import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import type { Scope } from "@typescript-eslint/utils/ts-eslint";
import ts from "typescript";
import { createRule } from "../create-rule.js";

/** @lintignore */
export const MessageId = {
	THROWING_CALL: "throwingCall",
} as const;
export type MessageId = (typeof MessageId)[keyof typeof MessageId];

const BANNED_GLOBAL_CALLS = new Set([
	"fetch",
	"atob",
	"btoa",
	"structuredClone",
	"decodeURI",
	"decodeURIComponent",
	"encodeURI",
	"encodeURIComponent",
	"JSON.parse",
	"JSON.stringify",
]);

const RESPONSE_BODY_METHODS = new Set(["json", "text", "arrayBuffer", "blob", "formData"]);

const BANNED_FS_PROMISES_CALLS = new Set([
	"readFile",
	"writeFile",
	"appendFile",
	"truncate",
	"open",
	"readdir",
	"mkdir",
	"rmdir",
	"rm",
	"mkdtemp",
	"opendir",
	"readlink",
	"link",
	"symlink",
	"unlink",
	"realpath",
	"stat",
	"lstat",
	"statfs",
	"access",
	"chmod",
	"chown",
	"lchown",
	"utimes",
	"lutimes",
	"copyFile",
	"cp",
	"rename",
]);

const FS_PROMISES_MODULE_NAMES = new Set(["node:fs/promises", "fs/promises"]);

const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self"]);

const NULLISH_TYPE_FLAGS = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;

interface StaticCalleePath {
	segments: string[];
	rootIdentifier: TSESTree.Identifier;
	memberExpression: TSESTree.MemberExpression | null;
}

/**
 * Extracts the property name from a `MemberExpression` when it can be
 * statically determined. Handles `obj.prop`, `obj["prop"]`, and
 * `` obj[`prop`] `` (template literals with no interpolations).
 * Returns `null` for dynamic access like `obj[variable]`.
 */
function getStaticMemberName(node: TSESTree.MemberExpression): string | null {
	if (!node.computed && node.property.type === "Identifier") {
		return node.property.name;
	}

	if (
		node.computed &&
		node.property.type === "Literal" &&
		typeof node.property.value === "string"
	) {
		return node.property.value;
	}

	if (
		node.computed &&
		node.property.type === "TemplateLiteral" &&
		node.property.expressions.length === 0
	) {
		const [quasi] = node.property.quasis;
		return quasi?.value.cooked ?? null;
	}

	return null;
}

function isImplicitGlobal(name: string, scope: Scope.Scope): boolean {
	let current: Scope.Scope | null = scope;
	while (current) {
		const variable = current.set.get(name);
		if (variable) {
			return variable.defs.length === 0;
		}
		current = current.upper;
	}
	return true;
}

function collectStaticMemberPath(
	node: TSESTree.MemberExpression,
): Pick<StaticCalleePath, "segments" | "rootIdentifier"> | null {
	const propertyName = getStaticMemberName(node);
	if (!propertyName) {
		return null;
	}

	if (node.object.type === "Identifier") {
		return {
			segments: [node.object.name, propertyName],
			rootIdentifier: node.object,
		};
	}

	if (node.object.type !== "MemberExpression") {
		return null;
	}

	const parentPath = collectStaticMemberPath(node.object);
	if (!parentPath) {
		return null;
	}

	return {
		segments: [...parentPath.segments, propertyName],
		rootIdentifier: parentPath.rootIdentifier,
	};
}

function getStaticCalleePath(callee: TSESTree.Expression): StaticCalleePath | null {
	if (callee.type === "Identifier") {
		return {
			segments: [callee.name],
			rootIdentifier: callee,
			memberExpression: null,
		};
	}

	if (callee.type !== "MemberExpression") {
		return null;
	}

	const memberPath = collectStaticMemberPath(callee);
	if (!memberPath) {
		return null;
	}

	return {
		segments: memberPath.segments,
		rootIdentifier: memberPath.rootIdentifier,
		memberExpression: callee,
	};
}

function normalizeGlobalPath(calleePath: StaticCalleePath, scope: Scope.Scope): string[] | null {
	// Invariant: getStaticCalleePath always returns at least one segment.
	const [root = "", ...rest] = calleePath.segments;

	if (GLOBAL_OBJECTS.has(root)) {
		if (!isImplicitGlobal(root, scope)) {
			return null;
		}

		return rest.length > 0 ? rest : null;
	}

	if (!isImplicitGlobal(root, scope)) {
		return null;
	}

	return calleePath.segments;
}

function isFsPromisesDeclaration(decl: ts.Declaration): boolean {
	let current: ts.Node = decl;
	while (current) {
		if (
			ts.isModuleDeclaration(current) &&
			ts.isStringLiteral(current.name) &&
			FS_PROMISES_MODULE_NAMES.has(current.name.text)
		) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

function getFsPromisesCallViolation(checker: ts.TypeChecker, tsCallNode: ts.Node): string | null {
	const signature = checker.getResolvedSignature(tsCallNode as ts.CallExpression);

	const decl = signature?.getDeclaration();
	if (!decl) {
		return null;
	}

	if (!isFsPromisesDeclaration(decl)) {
		return null;
	}

	const name = ts.isFunctionDeclaration(decl) ? decl.name?.text : undefined;
	if (!(name && BANNED_FS_PROMISES_CALLS.has(name))) {
		return null;
	}

	return name;
}

function containsGlobalResponseType(
	type: ts.Type,
	globalResponseType: ts.Type,
	checker: ts.TypeChecker,
): boolean {
	if (type.isUnionOrIntersection()) {
		return type.types.some((member) =>
			containsGlobalResponseType(member, globalResponseType, checker),
		);
	}

	const flags = type.getFlags();
	if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | NULLISH_TYPE_FLAGS)) {
		return false;
	}

	if (checker.isTypeAssignableTo(type, globalResponseType)) {
		return true;
	}

	const constraint = checker.getBaseConstraintOfType(type);
	if (constraint && constraint !== type) {
		return containsGlobalResponseType(constraint, globalResponseType, checker);
	}

	return false;
}

export const noThrowingCall = createRule<[], MessageId>({
	name: "no-throwing-call",
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow calls to known throwing built-in APIs that have @antithrow/std replacements.",
			recommended: true,
			requiresTypeChecking: true,
		},
		messages: {
			[MessageId.THROWING_CALL]:
				"`{{ api }}` can throw. A non-throwing wrapper is available from `{{ replacement }}`.",
		},
		schema: [],
	},
	defaultOptions: [],
	create(context) {
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();
		const globalResponseSymbol = checker.resolveName(
			"Response",
			undefined,
			ts.SymbolFlags.Type,
			false,
		);
		const globalResponseType = globalResponseSymbol
			? checker.getDeclaredTypeOfSymbol(globalResponseSymbol)
			: null;

		return {
			CallExpression(node) {
				const calleePath = getStaticCalleePath(node.callee);
				if (!calleePath) {
					return;
				}

				const rootScope = context.sourceCode.getScope(calleePath.rootIdentifier);
				const normalizedGlobalPath = normalizeGlobalPath(calleePath, rootScope);
				if (normalizedGlobalPath) {
					const api = normalizedGlobalPath.join(".");
					if (BANNED_GLOBAL_CALLS.has(api)) {
						context.report({
							node,
							messageId: MessageId.THROWING_CALL,
							data: { api, replacement: "@antithrow/std" },
						});
						return;
					}
				}

				const tsCallNode = services.esTreeNodeToTSNodeMap.get(node);
				const fsApi = getFsPromisesCallViolation(checker, tsCallNode);
				if (fsApi) {
					context.report({
						node,
						messageId: MessageId.THROWING_CALL,
						data: { api: fsApi, replacement: "@antithrow/node/fs/promises" },
					});
					return;
				}

				const methodName = calleePath.segments[calleePath.segments.length - 1];
				const { memberExpression } = calleePath;
				if (
					methodName &&
					memberExpression &&
					RESPONSE_BODY_METHODS.has(methodName) &&
					globalResponseType
				) {
					const tsNode = services.esTreeNodeToTSNodeMap.get(memberExpression.object);
					const type = checker.getTypeAtLocation(tsNode);
					if (containsGlobalResponseType(type, globalResponseType, checker)) {
						context.report({
							node,
							messageId: MessageId.THROWING_CALL,
							data: { api: `response.${methodName}`, replacement: "@antithrow/std" },
						});
					}
				}
			},
		};
	},
});
