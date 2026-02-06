import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import ts from "typescript";
import { createRule } from "../create-rule.js";

const RESULT_TYPE_NAMES = new Set(["Ok", "Err", "ResultAsync"]);

function isResultType(type: ts.Type): boolean {
	if (type.isUnion()) {
		return type.types.some((t) => isResultType(t));
	}

	const flags = type.getFlags();
	if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) {
		return false;
	}

	const symbol = type.getSymbol();
	if (!symbol || !RESULT_TYPE_NAMES.has(symbol.getName())) {
		return false;
	}

	const declarations = symbol.getDeclarations() ?? [];

	return declarations.some((decl) => {
		const sourceFile = decl.getSourceFile();
		return sourceFile.fileName.includes("antithrow");
	});
}

export const noUnusedResult = createRule({
	name: "no-unused-result",
	meta: {
		type: "problem",
		docs: {
			description:
				"Require Result and ResultAsync values to be used, preventing silently ignored errors.",
			recommended: true,
			requiresTypeChecking: true,
		},
		messages: {
			unusedResult:
				"This Result must be used. Handle the error case or explicitly discard it with `void`.",
		},
		schema: [],
	},
	defaultOptions: [],
	create(context) {
		const services = ESLintUtils.getParserServices(context);
		const checker = services.program.getTypeChecker();

		function checkExpression(node: TSESTree.Expression): void {
			switch (node.type) {
				case "UnaryExpression":
					if (node.operator === "void") {
						return;
					}
					break;

				case "ConditionalExpression":
					checkExpression(node.consequent);
					checkExpression(node.alternate);
					return;

				case "LogicalExpression":
					checkExpression(node.left);
					checkExpression(node.right);
					return;

				case "SequenceExpression":
					for (const expr of node.expressions) {
						checkExpression(expr);
					}
					return;

				case "TSAsExpression":
				case "TSNonNullExpression":
					checkExpression(node.expression);
					return;

				case "ChainExpression":
					checkExpression(node.expression);
					return;
			}

			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			const type = checker.getTypeAtLocation(tsNode);

			if (!isResultType(type)) {
				return;
			}

			context.report({
				node,
				messageId: "unusedResult",
			});
		}

		return {
			ExpressionStatement(node) {
				checkExpression(node.expression);
			},
		};
	},
});
