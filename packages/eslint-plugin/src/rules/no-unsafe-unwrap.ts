import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import { createRule } from "../create-rule.js";
import { isResultType } from "./utils/result-type.js";

/** @lintignore */
export const MessageId = {
	UNSAFE_UNWRAP: "unsafeUnwrap",
} as const;
export type MessageId = (typeof MessageId)[keyof typeof MessageId];

const BANNED_METHOD_NAMES = new Set(["unwrap", "unwrapErr", "expect", "expectErr"]);

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

/**
 * Like {@link getStaticMemberName} but for destructuring patterns.
 * Extracts the key name from `{ key: value }` in an `ObjectPattern`.
 * Handles identifier keys, string literal keys, and static template
 * literal keys. Returns `null` for computed keys with dynamic expressions.
 */
function getDestructuredPropertyName(node: TSESTree.Property): string | null {
	if (node.computed) {
		if (node.key.type === "Literal" && typeof node.key.value === "string") {
			return node.key.value;
		}

		if (node.key.type === "TemplateLiteral" && node.key.expressions.length === 0) {
			const [quasi] = node.key.quasis;
			return quasi?.value.cooked ?? null;
		}

		return null;
	}

	if (node.key.type === "Identifier") {
		return node.key.name;
	}

	if (node.key.type === "Literal" && typeof node.key.value === "string") {
		return node.key.value;
	}

	return null;
}

export const noUnsafeUnwrap = createRule<[], MessageId>({
	name: "no-unsafe-unwrap",
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow unsafe unwrap APIs on Result and ResultAsync values to prevent unexpected throws.",
			recommended: true,
			requiresTypeChecking: true,
		},
		messages: {
			[MessageId.UNSAFE_UNWRAP]:
				"Avoid `{{ method }}` on Result values. Handle both branches explicitly instead.",
		},
		schema: [],
	},
	defaultOptions: [],
	create(context) {
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();

		return {
			MemberExpression(node) {
				const method = getStaticMemberName(node);
				if (!method || !BANNED_METHOD_NAMES.has(method)) {
					return;
				}

				const tsNode = services.esTreeNodeToTSNodeMap.get(node.object);
				const type = checker.getTypeAtLocation(tsNode);

				if (!isResultType(type)) {
					return;
				}

				context.report({
					node,
					messageId: MessageId.UNSAFE_UNWRAP,
					data: { method },
				});
			},
			Property(node) {
				if (node.parent.type !== "ObjectPattern") {
					return;
				}

				const method = getDestructuredPropertyName(node);
				if (!method || !BANNED_METHOD_NAMES.has(method)) {
					return;
				}

				// Resolve the node whose type represents the value being destructured.
				// For most contexts (variable declarations, function parameters, for-of
				// loops), the ObjectPattern itself carries the correct type. However, in
				// assignment destructuring (`({ unwrap } = result)`), the pattern's type
				// reflects the target bindings, not the source, so we use the RHS instead.
				const pattern = node.parent;
				let typeSourceNode: TSESTree.Node = pattern;
				if (pattern.parent.type === "AssignmentExpression" && pattern.parent.left === pattern) {
					typeSourceNode = pattern.parent.right;
				}

				const tsNode = services.esTreeNodeToTSNodeMap.get(typeSourceNode);
				const type = checker.getTypeAtLocation(tsNode);

				if (!isResultType(type)) {
					return;
				}

				context.report({
					node,
					messageId: MessageId.UNSAFE_UNWRAP,
					data: { method },
				});
			},
		};
	},
});
