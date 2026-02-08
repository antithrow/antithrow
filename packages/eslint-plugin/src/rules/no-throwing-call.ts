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

const GLOBAL_FUNCTIONS = new Set([
	"fetch",
	"atob",
	"btoa",
	"structuredClone",
	"decodeURI",
	"decodeURIComponent",
	"encodeURI",
	"encodeURIComponent",
]);

const JSON_METHODS = new Set(["parse", "stringify"]);

const RESPONSE_BODY_METHODS = new Set(["json", "text", "arrayBuffer", "blob", "formData"]);

const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self"]);

const NULLISH_TYPE_FLAGS = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;

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

function isImplicitGlobalObject(node: TSESTree.Identifier, scope: Scope.Scope): boolean {
	return GLOBAL_OBJECTS.has(node.name) && isImplicitGlobal(node.name, scope);
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
				"`{{ api }}` can throw. A non-throwing wrapper is available from `@antithrow/std`.",
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
				const callee = node.callee;

				// fetch(), atob(), etc.
				if (callee.type === "Identifier" && GLOBAL_FUNCTIONS.has(callee.name)) {
					const scope = context.sourceCode.getScope(callee);
					if (isImplicitGlobal(callee.name, scope)) {
						context.report({
							node,
							messageId: MessageId.THROWING_CALL,
							data: { api: callee.name },
						});
					}
					return;
				}

				if (callee.type !== "MemberExpression") {
					return;
				}

				const methodName = getStaticMemberName(callee);
				if (!methodName) {
					return;
				}

				// globalThis.fetch(), window.atob(), self.structuredClone(), etc.
				if (
					GLOBAL_FUNCTIONS.has(methodName) &&
					callee.object.type === "Identifier" &&
					isImplicitGlobalObject(callee.object, context.sourceCode.getScope(callee.object))
				) {
					context.report({
						node,
						messageId: MessageId.THROWING_CALL,
						data: { api: methodName },
					});
					return;
				}

				// JSON.parse(), JSON.stringify()
				if (
					JSON_METHODS.has(methodName) &&
					callee.object.type === "Identifier" &&
					callee.object.name === "JSON"
				) {
					const scope = context.sourceCode.getScope(callee.object);
					if (isImplicitGlobal("JSON", scope)) {
						context.report({
							node,
							messageId: MessageId.THROWING_CALL,
							data: { api: `JSON.${methodName}` },
						});
					}
					return;
				}

				// globalThis.JSON.parse(), window.JSON.stringify(), etc.
				if (
					JSON_METHODS.has(methodName) &&
					callee.object.type === "MemberExpression" &&
					getStaticMemberName(callee.object) === "JSON" &&
					callee.object.object.type === "Identifier" &&
					isImplicitGlobalObject(
						callee.object.object,
						context.sourceCode.getScope(callee.object.object),
					)
				) {
					context.report({
						node,
						messageId: MessageId.THROWING_CALL,
						data: { api: `JSON.${methodName}` },
					});
					return;
				}

				if (RESPONSE_BODY_METHODS.has(methodName) && globalResponseType) {
					const tsNode = services.esTreeNodeToTSNodeMap.get(callee.object);
					const type = checker.getTypeAtLocation(tsNode);
					if (containsGlobalResponseType(type, globalResponseType, checker)) {
						context.report({
							node,
							messageId: MessageId.THROWING_CALL,
							data: { api: `response.${methodName}` },
						});
					}
				}
			},
		};
	},
});
