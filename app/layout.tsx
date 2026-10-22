import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { company } from "@/lib/content";

const siteUrl = "https://vikramengineering.co.in";

/**
 * Type: Space Grotesk for headings and the wordmark, Inter for body copy.
 * Both are variable fonts loaded as CSS variables, so swapping either one
 * means changing only the import and the family name here.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${company.tradeName} — O&M & Manpower`,
    template: `%s — ${company.tradeName}`,
  },
  description:
    "Bathinda-based engineering contractor. Operation & maintenance of water, effluent and RO-DM treatment plants, skilled contract manpower, mechanical erection, pipeline laying and industrial painting for refineries and process plants across Punjab, Rajasthan and Uttar Pradesh.",
  keywords: [
    "ETP O&M contractor",
    "STP operation and maintenance",
    "contract manpower supply Punjab",
    "refinery manpower contractor Bathinda",
    "RO DM plant O&M",
    "mechanical erection contractor",
    "Vikram Engineering Co",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: company.tradeName,
    title: `${company.tradeName} —O&M & Manpower`,
    description:
      "Operation & maintenance of water, effluent and RO-DM plants, skilled contract manpower and mechanical contracting since 2015.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "dark",
};

const organisationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: company.tradeName,
  legalName: company.legalName,
  url: siteUrl,
  email: company.email,
  telephone: company.phones[0],
  foundingDate: String(company.trackRecordFrom),
  address: {
    "@type": "PostalAddress",
    streetAddress: "B-526, Sushant City Phase-II, Mansa Road",
    addressLocality: "Bathinda",
    addressRegion: "Punjab",
    postalCode: "151001",
    addressCountry: "IN",
  },
  areaServed: company.states.map((s) => ({ "@type": "State", name: s })),
  description:
    "Engineering contractor providing O&M of water and effluent treatment plants, contract manpower, mechanical erection, pipeline laying and industrial painting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organisationJsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}
