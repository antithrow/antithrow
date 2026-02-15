import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import { createRule } from "../create-rule.js";
import { isResultType } from "./utils/result-type.js";

function needsParentheses(node: TSESTree.Expression): boolean {
	switch (node.type) {
		case "SequenceExpression":
		case "AssignmentExpression":
		case "ConditionalExpression":
		case "LogicalExpression":
		case "BinaryExpression":
		case "TSAsExpression":
		case "TSSatisfiesExpression":
			return true;
		default:
			return false;
	}
}

/** @lintignore */
export const MessageId = {
	UNUSED_RESULT: "unusedResult",
	ADD_VOID: "addVoid",
} as const;
export type MessageId = (typeof MessageId)[keyof typeof MessageId];

export const noUnusedResult = createRule<[], MessageId>({
	name: "no-unused-result",
	meta: {
		type: "problem",
		hasSuggestions: true,
		docs: {
			description:
				"Require Result and ResultAsync values to be used, preventing silently ignored errors.",
			recommended: true,
			requiresTypeChecking: true,
		},
		messages: {
			[MessageId.UNUSED_RESULT]:
				"This Result must be used. Handle the error case or explicitly discard it with `void`.",
			[MessageId.ADD_VOID]: "Explicitly discard the Result with `void`.",
		},
		schema: [],
	},
	defaultOptions: [],
	create(context) {
		const services = ESLintUtils.getParserServices(context);

		function checkExpression(
			node: TSESTree.Expression,
			statement: TSESTree.ExpressionStatement,
		): void {
			switch (node.type) {
				case "UnaryExpression":
					if (node.operator === "void") {
						return;
					}
					checkExpression(node.argument, statement);
					return;

				case "ConditionalExpression":
					checkExpression(node.consequent, statement);
					checkExpression(node.alternate, statement);
					return;

				case "LogicalExpression":
					checkExpression(node.left, statement);
					checkExpression(node.right, statement);
					return;

				case "SequenceExpression":
					for (const expr of node.expressions) {
						checkExpression(expr, statement);
					}
					return;

				case "TSAsExpression":
				case "TSNonNullExpression":
					checkExpression(node.expression, statement);
					return;

				case "ChainExpression":
					checkExpression(node.expression, statement);
					return;
			}

			const type = services.getTypeAtLocation(node);

			if (!isResultType(type)) {
				return;
			}

			context.report({
				node,
				messageId: MessageId.UNUSED_RESULT,
				suggest: [
					{
						messageId: MessageId.ADD_VOID,
						fix(fixer) {
							const expr = statement.expression;
							if (needsParentheses(expr)) {
								return [fixer.insertTextBefore(expr, "void ("), fixer.insertTextAfter(expr, ")")];
							}

							return fixer.insertTextBefore(expr, "void ");
						},
					},
				],
			});
		}

		return {
			ExpressionStatement(node) {
				checkExpression(node.expression, node);
			},
		};
	},
});
