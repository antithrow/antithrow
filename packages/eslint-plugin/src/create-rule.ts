import { ESLintUtils } from "@typescript-eslint/utils";

/** @lintignore */
export interface AntithrowPluginDocs {
	description: string;
	recommended?: boolean;
	requiresTypeChecking?: boolean;
}

export const createRule = ESLintUtils.RuleCreator<AntithrowPluginDocs>(
	(name) =>
		`https://github.com/antithrow/antithrow/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);
