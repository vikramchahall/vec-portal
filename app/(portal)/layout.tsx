import type { Metadata } from "next";
import "./portal.css";

export const metadata: Metadata = { title: "VEC Portal", robots: { index: false, follow: false } };

// Theme is applied before paint from the saved choice, so dark mode does not flash light.
const themeScript = `try{var t=localStorage.getItem('vec-theme');if(t)document.currentScript.parentElement.dataset.theme=t}catch(e){}`;

export default function PortalGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vec-app" data-theme="light" id="vec-app" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </div>
  );
}
