export function Current() {
  const sidebarItems = [
    { icon: "⚙️", label: "Admin Panel", active: true },
    { icon: "👥", label: "Employees" },
    { icon: "📋", label: "Hiring" },
    { icon: "💳", label: "Invoices" },
    { icon: "📊", label: "Reports" },
    { icon: "⏱️", label: "Time Admin" },
    { icon: "💰", label: "MORS Budget" },
    { icon: "📦", label: "Catalog" },
    { icon: "🌿", label: "Plant Cards" },
    { icon: "🔧", label: "Tools" },
  ];

  const panelGroups = [
    {
      title: "People & HR",
      color: "#22c55e",
      items: ["User Management", "HR Communications 3", "Agreement Templates", "Task Access", "Suggestions"],
    },
    {
      title: "Content",
      color: "#3b82f6",
      items: ["SOP Pipeline", "Documents", "Shared Links", "Help Reports"],
    },
    {
      title: "Company",
      color: "#a855f7",
      items: ["Company Info & Branding"],
    },
    {
      title: "Company Settings",
      color: "#f59e0b",
      items: ["Divisions", "Estimate Templates", "QuickBooks", "Terms & Conditions", "Integration Wizard", "QB Export"],
    },
    {
      title: "AI & Automation",
      color: "#06b6d4",
      items: ["AI Assistant", "AI Logs", "AI Agents (Master)"],
    },
    {
      title: "Operations",
      color: "#ef4444",
      items: ["Time Reports", "Process Auditor", "Worksheet Review", "Work Areas", "Service Types", "Archive", "CC Reconciliation", "CC Webhook Health", "Customer Duplicates"],
    },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, sans-serif", background: "#0f172a" }}>
      {/* App Sidebar */}
      <div style={{ width: 200, background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 12px", borderBottom: "1px solid #334155" }}>
          <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>🌿 Chapin HQ</div>
        </div>

        {/* Other nav sections (collapsed) */}
        <div style={{ padding: "8px 0" }}>
          {[
            { label: "My Workspace", icon: "🏠" },
            { label: "Work", icon: "📁" },
            { label: "People", icon: "👤" },
            { label: "Company", icon: "🏢" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "7px 16px", display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              {s.label}
            </div>
          ))}
        </div>

        {/* ADMIN section */}
        <div style={{ padding: "8px 0", borderTop: "1px solid #334155" }}>
          <div style={{ padding: "4px 16px 8px", fontSize: 10, fontWeight: 600, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Admin
          </div>
          {sidebarItems.map((item) => (
            <div
              key={item.label}
              style={{
                padding: "7px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                cursor: "pointer",
                background: item.active ? "#0f3d1f" : "transparent",
                color: item.active ? "#22c55e" : "#94a3b8",
                borderRight: item.active ? "2px solid #22c55e" : "2px solid transparent",
              }}
            >
              <span style={{ fontSize: 13 }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        {/* Count badge */}
        <div style={{ marginTop: "auto", padding: "8px 16px", borderTop: "1px solid #334155" }}>
          <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 6, padding: "6px 10px", textAlign: "center" }}>
            <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 600 }}>10 sidebar items</div>
          </div>
        </div>
      </div>

      {/* Admin Panel Content */}
      <div style={{ flex: 1, background: "#0f172a", overflow: "auto" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, margin: 0 }}>Admin Panel</h1>
            <p style={{ color: "#64748b", fontSize: 12, margin: "2px 0 0" }}>Current structure — 6 groups, 28 items</p>
          </div>
          <div style={{ background: "#ef444415", border: "1px solid #ef4444", borderRadius: 8, padding: "6px 14px" }}>
            <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>😵 Hard to navigate</span>
          </div>
        </div>

        {/* Groups grid */}
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {panelGroups.map((group) => (
            <div key={group.title} style={{ background: "#1e293b", borderRadius: 10, border: "1px solid #334155", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: group.color }} />
                <span style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{group.title}</span>
                <span style={{ marginLeft: "auto", background: "#334155", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "#94a3b8" }}>
                  {group.items.length}
                </span>
              </div>
              <div style={{ padding: "8px 0" }}>
                {group.items.map((item) => (
                  <div key={item} style={{ padding: "6px 14px", fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#475569", flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pain points callout */}
        <div style={{ margin: "0 24px 24px", background: "#1e293b", borderRadius: 10, border: "1px solid #ef444430", padding: 16 }}>
          <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>⚠️ Navigation Pain Points</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              "Payroll & Hours buried in Operations group",
              '"Company" group has only 1 item',
              "2 separate Company/Settings groups",
              "Technical tools mixed with daily-use tools",
              "10 sidebar items — too long to scan",
              "Time Admin + Time Reports = confusing names",
            ].map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ color: "#ef4444", fontSize: 12, marginTop: 1 }}>✗</span>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
