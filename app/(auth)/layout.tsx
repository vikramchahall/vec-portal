/** Bare chrome: no splash, no marketing nav, no footer. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen">{children}</div>;
}
