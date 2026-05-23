// Shown by Next while a server-rendered (app) page is fetching. Without this,
// navigations would block on the old page until all server data resolved.

export default function AppLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        opacity: 0.6,
      }}
    >
      <div
        style={{
          height: 38,
          width: "min(320px, 60%)",
          borderRadius: 6,
          background: "var(--sand)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        height: 72,
        borderRadius: 10,
        background: "var(--card-2)",
        border: "1px solid var(--rule)",
      }}
    />
  );
}
