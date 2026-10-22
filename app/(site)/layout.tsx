import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import Splash from "@/components/Splash";

/**
 * Chrome for the public marketing site only. The login page and the portal
 * sit in their own route groups and deliberately do not get the splash
 * screen, the anchor nav or the marketing footer.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Splash />
      <Reveal />
      <Header />
      {/* No top padding: the hero sits under the transparent header. */}
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
