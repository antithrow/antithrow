import type { TSESTree } from "@typescript-eslint/utils";
import { ASTUtils, ESLintUtils } from "@typescript-eslint/utils";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";
import { createRule } from "../create-rule.js";
import { getResultVariant, isResultType, ResultVariant } from "./utils/result-type.js";

/** @lintignore */
export const MessageId = {
	UNSAFE_UNWRAP: "unsafeUnwrap",
	UNWRAP_OK_VALUE: "unwrapOkValue",
	UNWRAP_ERR_ERROR: "unwrapErrError",
} as const;
export type MessageId = (typeof MessageId)[keyof typeof MessageId];

const BANNED_METHOD_NAMES = new Set(["unwrap", "unwrapErr", "expect", "expectErr"]);
const FIXABLE_OK_METHOD_NAMES = new Set(["unwrap"]);
const FIXABLE_ERR_METHOD_NAMES = new Set(["unwrapErr"]);

function getCallExpression(node: TSESTree.MemberExpression): TSESTree.CallExpression | null {
	if (node.parent.type === "CallExpression" && node.parent.callee === node) {
		return node.parent;
	}

	return null;
}

function getFixedMemberExpressionText(
	node: TSESTree.MemberExpression,
	method: string,
	propertyName: "value" | "error",
	sourceCode: Readonly<SourceCode>,
): string | null {
	const memberText = sourceCode.getText(node);
	const propertyText = sourceCode.getText(node.property);

	const oldSuffix = node.computed
		? `${node.optional ? "?.[" : "["}${propertyText}]`
		: `${node.optional ? "?." : "."}${method}`;

	if (!memberText.endsWith(oldSuffix)) {
		return null;
	}

	const baseText = memberText.slice(0, memberText.length - oldSuffix.length);

	return `${baseText}${node.optional ? "?." : "."}${propertyName}`;
}

export const noUnsafeUnwrap = createRule<[], MessageId>({
	name: "no-unsafe-unwrap",
	meta: {
		type: "problem",
		fixable: "code",
		docs: {
			description:
				"Disallow unsafe unwrap APIs on Result and ResultAsync values to prevent unexpected throws.",
			recommended: true,
			requiresTypeChecking: true,
		},
		messages: {
			[MessageId.UNSAFE_UNWRAP]:
				"Avoid `{{ method }}` on Result values. Handle both branches explicitly instead.",
			[MessageId.UNWRAP_OK_VALUE]: "`{{ method }}` on `Ok` is unnecessary. Use `.value` instead.",
			[MessageId.UNWRAP_ERR_ERROR]: "`{{ method }}` on `Err` is unnecessary. Use `.error` instead.",
		},
		schema: [],
	},
	defaultOptions: [],
	create(context) {
		const services = ESLintUtils.getParserServices(context);
		return {
			MemberExpression(node) {
				const method = ASTUtils.getPropertyName(node);
				if (!(method && BANNED_METHOD_NAMES.has(method))) {
					return;
				}

				const type = services.getTypeAtLocation(node.object);

				if (!isResultType(type)) {
					return;
				}

				const callExpression = getCallExpression(node);
				const variant = getResultVariant(type);

				if (callExpression && variant === ResultVariant.OK && FIXABLE_OK_METHOD_NAMES.has(method)) {
					context.report({
						node,
						messageId: MessageId.UNWRAP_OK_VALUE,
						data: { method },
						fix(fixer) {
							const fixedText = getFixedMemberExpressionText(
								node,
								method,
								"value",
								context.sourceCode,
							);
							if (!fixedText) {
								return null;
							}

							return fixer.replaceText(callExpression, fixedText);
						},
					});

					return;
				}

				if (
					callExpression &&
					variant === ResultVariant.ERR &&
					FIXABLE_ERR_METHOD_NAMES.has(method)
				) {
					context.report({
						node,
						messageId: MessageId.UNWRAP_ERR_ERROR,
						data: { method },
						fix(fixer) {
							const fixedText = getFixedMemberExpressionText(
								node,
								method,
								"error",
								context.sourceCode,
							);
							if (!fixedText) {
								return null;
							}

							return fixer.replaceText(callExpression, fixedText);
						},
					});

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

				const method = ASTUtils.getPropertyName(node);
				if (!(method && BANNED_METHOD_NAMES.has(method))) {
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

				const type = services.getTypeAtLocation(typeSourceNode);

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
