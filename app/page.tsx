import LandingPage from "../components/LandingPage";
import { homeSoftwareApplicationJsonLd } from "../lib/seo";

export default function Home() {
  const jsonLd = homeSoftwareApplicationJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
