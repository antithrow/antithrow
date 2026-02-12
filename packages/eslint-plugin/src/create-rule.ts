import { ESLintUtils } from "@typescript-eslint/utils";

/** @lintignore */
export interface AntithrowPluginDocs {
	description: string;
	recommended?: boolean;
	requiresTypeChecking?: boolean;
}

export const createRule = ESLintUtils.RuleCreator<AntithrowPluginDocs>(
	(name) => `https://antithrow.dev/docs/api/eslint-plugin/${name}`,
);
