import type * as Preset from "@docusaurus/preset-classic";
import npm2yarn from "@docusaurus/remark-plugin-npm2yarn";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
	title: "antithrow",
	tagline: "Rust-style Result types for type-safe error handling in TypeScript",
	favicon: "img/favicon.ico",

	future: {
		v4: true,
	},

	url: "https://antithrow.dev",
	baseUrl: "/",

	organizationName: "antithrow",
	projectName: "antithrow",

	onBrokenLinks: "throw",

	i18n: {
		defaultLocale: "en",
		locales: ["en"],
	},

	presets: [
		[
			"classic",
			{
				docs: {
					sidebarPath: "./sidebars.ts",
					editUrl: "https://github.com/antithrow/antithrow/tree/main/apps/docs/",
					remarkPlugins: [[npm2yarn, { sync: true }]],
				},
				blog: false,
				theme: {
					customCss: "./src/css/custom.css",
				},
			} satisfies Preset.Options,
		],
	],

	themeConfig: {
		image: "img/docusaurus-social-card.jpg",
		colorMode: {
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: "antithrow",
			logo: {
				alt: "antithrow Logo",
				src: "img/logo.svg",
			},
			items: [
				{
					type: "docSidebar",
					sidebarId: "tutorialSidebar",
					position: "left",
					label: "Docs",
				},
				{
					href: "https://github.com/antithrow/antithrow",
					label: "GitHub",
					position: "right",
				},
				{
					href: "https://www.npmjs.com/package/antithrow",
					label: "npm",
					position: "right",
				},
			],
		},
		footer: {
			style: "dark",
			links: [
				{
					title: "Legacy Docs",
					items: [
						{
							label: "antithrow",
							to: "/docs/legacy/result",
						},
					],
				},
				{
					title: "Packages",
					items: [
						{
							label: "@antithrow/std",
							to: "/docs/legacy/std",
						},
						{
							label: "@antithrow/node",
							to: "/docs/legacy/node",
						},
						{
							label: "@antithrow/jose",
							to: "/docs/legacy/jose",
						},
						{
							label: "@antithrow/standard-schema",
							to: "/docs/legacy/standard-schema",
						},
						{
							label: "@antithrow/eslint-plugin",
							to: "/docs/legacy/eslint-plugin",
						},
					],
				},
				{
					title: "More",
					items: [
						{
							label: "GitHub",
							href: "https://github.com/antithrow/antithrow",
						},
						{
							label: "npm",
							href: "https://www.npmjs.com/package/antithrow",
						},
					],
				},
			],
			copyright: `Copyright © ${new Date().getFullYear()} antithrow contributors. MIT License.`,
		},
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula,
		},
	} satisfies Preset.ThemeConfig,
};

export default config;
