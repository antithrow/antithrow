import { Redirect } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";

export default function Home() {
	const docsIntroUrl = useBaseUrl("/docs/intro");

	return <Redirect to={docsIntroUrl} />;
}
