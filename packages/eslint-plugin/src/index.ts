import type { TSESLint } from "@typescript-eslint/utils";
import packageJson from "../package.json" with { type: "json" };
import { noUnsafeUnwrap, noUnusedResult } from "./rules/index.js";

type Plugin = TSESLint.FlatConfig.Plugin & {
	configs: Record<string, TSESLint.FlatConfig.Config>;
};

const plugin: Plugin = {
	meta: {
		name: packageJson.name,
		version: packageJson.version,
	},
	rules: {
		"no-unsafe-unwrap": noUnsafeUnwrap,
		"no-unused-result": noUnusedResult,
	},
	configs: {},
};

plugin.configs = {
	...plugin.configs,
	recommended: {
		plugins: {
			"@antithrow": plugin,
		},
		rules: {
			"@antithrow/no-unsafe-unwrap": "warn",
			"@antithrow/no-unused-result": "error",
		},
	},
};

export default plugin;
