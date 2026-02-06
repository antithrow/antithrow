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

		return {
			ExpressionStatement(node) {
				if (node.expression.type === "UnaryExpression" && node.expression.operator === "void") {
					return;
				}

				const tsNode = services.esTreeNodeToTSNodeMap.get(node.expression);
				const type = checker.getTypeAtLocation(tsNode);

				if (!isResultType(type)) {
					return;
				}

				context.report({
					node,
					messageId: "unusedResult",
				});
			},
		};
	},
});
