import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    window.location.href = "/dashboard.html";
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#f0f2f5", fontFamily: "Inter, sans-serif"
    }}>
      <div style={{ textAlign: "center", color: "#6b7280" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "linear-gradient(135deg,#0866ff,#2589ff)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", boxShadow: "0 4px 16px rgba(8,102,255,.3)"
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Redirecionando para o Dashboard F3F…</p>
      </div>
    </div>
  );
};

export default Index;
