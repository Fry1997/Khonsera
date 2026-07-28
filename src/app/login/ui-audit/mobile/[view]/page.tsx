export default async function MobileAuditFrame({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const target = view === "plan" ? "plan" : "today";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "start center",
        background: "var(--canvas)",
      }}
    >
      <iframe
        src={`/login/ui-audit/${target}`}
        title={`${target} mobile responsive audit`}
        width="390"
        height="844"
        style={{ border: 0, background: "var(--canvas)" }}
      />
    </main>
  );
}
