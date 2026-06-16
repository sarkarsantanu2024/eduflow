"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#666", marginTop: "0.5rem" }}>{error.message || "Unexpected error"}</p>
        <button
          onClick={reset}
          style={{
            marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: "0.5rem",
            background: "#F2630E", color: "#fff", border: "none", cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
