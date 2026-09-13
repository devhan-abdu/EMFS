

export default  function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}
