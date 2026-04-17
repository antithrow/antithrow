import { Redirect } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";

export default function Home() {
	const docsIntroUrl = useBaseUrl("/docs/legacy");

	return <Redirect to={docsIntroUrl} />;
}
