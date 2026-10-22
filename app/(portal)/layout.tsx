/** Bare chrome for the signed-in portal. */
export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-deep">{children}</div>;
}
