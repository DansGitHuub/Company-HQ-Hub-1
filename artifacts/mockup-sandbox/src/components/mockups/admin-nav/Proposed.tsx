export function Proposed() {
  const sidebarItems = [
    { icon: "⚙️", label: "Admin Panel", active: true },
    { icon: "👥", label: "Employees" },
    { icon: "📋", label: "Hiring" },
    { icon: "💳", label: "Invoices" },
    { icon: "📊", label: "Reports" },
    { icon: "💰", label: "MORS Budget" },
  ];

  const panelGroups = [
    {
      title: "Daily Operations",
      subtitle: "Payroll, hours & billing — used every day",
      color: "#22c55e",
      badge: "⭐ Quick access",
      badgeColor: "#22c55e",
      items: [
        { label: "Time Reports", desc: "View & adjust all employee hours", icon: "⏱️", highlight: true },
        { label: "Time Archive", desc: "Archive old completed entries", icon: "🗂️", highlight: false },
        { label: "QuickBooks Export", desc: "Export time to QuickBooks payroll", icon: "💼", highlight: true },
        { label: "Invoices", desc: "Manage customer billing", icon: "💳", highlight: true },
        { label: "Worksheet Review", desc: "Review daily crew worksheets", icon: "📋", highlight: false },
      ],
    },
    {
      title: "People",
      subtitle: "Staff, hiring & HR communications",
      color: "#3b82f6",
      badge: null,
      badgeColor: null,
      items: [
        { label: "User Management", desc: "Roles, access & permissions", icon: "👤", highlight: false },
        { label: "HR Communications", desc: "Messages & requests", icon: "💬", highlight: false },
        { label: "Agreement Templates", desc: "Position-based agreements", icon: "📝", highlight: false },
        { label: "Suggestions", desc: "Customer improvement ideas", icon: "💡", highlight: false },
      ],
    },
    {
      title: "Settings",
      subtitle: "Company info, divisions & integrations",
      color: "#a855f7",
      badge: null,
      badgeColor: null,
      items: [
        { label: "Company Info & Branding", desc: "Name, logo, colors", icon: "🏢", highlight: false },
        { label: "Divisions", desc: "Business divisions", icon: "🗂️", highlight: false },
        { label: "Work Areas", desc: "Service zones", icon: "📍", highlight: false },
        { label: "Service Types", desc: "Job service categories", icon: "🌿", highlight: false },
        { label: "Estimate Templates", desc: "Default estimate types", icon: "📄", highlight: false },
        { label: "Terms & Conditions", desc: "Legal terms", icon: "⚖️", highlight: false },
        { label: "QuickBooks Sync", desc: "QB connection settings", icon: "🔄", highlight: false },
        { label: "Catalog", desc: "Materials & labor catalog", icon: "📦", highlight: false },
        { label: "Plant Library", desc: "Plant card database", icon: "🌱", highlight: false },
      ],
    },
    {
      title: "Content & SOPs",
      subtitle: "Training, documents & shared resources",
      color: "#f59e0b",
      badge: null,
      badgeColor: null,
      items: [
        { label: "SOP Pipeline", desc: "Create & schedule SOPs", icon: "📚", highlight: false },
        { label: "Documents", desc: "Shared file library", icon: "📁", highlight: false },
      ],
    },
    {
      title: "System & Advanced",
      subtitle: "Technical tools — rarely needed",
      color: "#475569",
      badge: "🔒 Advanced",
      badgeColor: "#475569",
      collapsed: true,
      items: [
        { label: "AI Setup", desc: "AI assistant configuration", icon: "🤖", highlight: false },
        { label: "AI Logs", desc: "AI usage history", icon: "📜", highlight: false },
        { label: "Integration Wizard", desc: "Connect services", icon: "🔌", highlight: false },
        { label: "Process Auditor", desc: "Run process audits", icon: "🔍", highlight: false },
        { label: "CC Reconciliation", desc: "CompanyCam sync", icon: "📸", highlight: false },
        { label: "CC Webhook Health", desc: "Webhook status", icon: "🩺", highlight: false },
        { label: "Customer Duplicates", desc: "Find duplicate records", icon: "🔁", highlight: false },
        { label: "App Testing", desc: "Internal testing tools", icon: "🧪", highlight: false },
        { label: "Diagnostics", desc: "System diagnostics", icon: "⚙️", highlight: false },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, sans-serif", background: "#0f172a" }}>
      {/* App Sidebar */}
      <div style={{ width: 200, background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 12px", borderBottom: "1px solid #334155" }}>
          <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>🌿 Chapin HQ</div>
        </div>

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

        <div style={{ marginTop: "auto", padding: "8px 16px", borderTop: "1px solid #334155" }}>
          <div style={{ background: "#14532d20", border: "1px solid #22c55e", borderRadius: 6, padding: "6px 10px", textAlign: "center" }}>
            <div style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>✓ 6 sidebar items</div>
          </div>
        </div>
      </div>

      {/* Admin Panel Content */}
      <div style={{ flex: 1, background: "#0f172a", overflow: "auto" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, margin: 0 }}>Admin Panel</h1>
            <p style={{ color: "#64748b", fontSize: 12, margin: "2px 0 0" }}>Proposed structure — 5 groups, clearly organized</p>
          </div>
          <div style={{ background: "#14532d20", border: "1px solid #22c55e", borderRadius: 8, padding: "6px 14px" }}>
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>✓ Easy to navigate</span>
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {panelGroups.map((group) => (
            <div
              key={group.title}
              style={{
                background: group.collapsed ? "#131c2e" : "#1e293b",
                borderRadius: 10,
                border: `1px solid ${group.collapsed ? "#1e293b" : "#334155"}`,
                overflow: "hidden",
                opacity: group.collapsed ? 0.75 : 1,
              }}
            >
              <div style={{ padding: "10px 16px", borderBottom: group.collapsed ? "none" : "1px solid #334155", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: group.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{group.title}</span>
                    {group.badge && (
                      <span style={{ background: group.badgeColor + "20", border: `1px solid ${group.badgeColor}`, borderRadius: 10, padding: "1px 8px", fontSize: 10, color: group.badgeColor, fontWeight: 600 }}>
                        {group.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>{group.subtitle}</div>
                </div>
                {group.collapsed && (
                  <span style={{ color: "#475569", fontSize: 12 }}>▼ {group.items.length} items hidden</span>
                )}
              </div>
              {!group.collapsed && (
                <div style={{ padding: "8px 0", display: "grid", gridTemplateColumns: group.items.length > 4 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 0 }}>
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: "8px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        background: item.highlight ? "#14532d15" : "transparent",
                        borderLeft: item.highlight ? "3px solid #22c55e" : "3px solid transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <div>
                        <div style={{ color: item.highlight ? "#86efac" : "#cbd5e1", fontSize: 12, fontWeight: item.highlight ? 600 : 400 }}>
                          {item.label}
                          {item.highlight && <span style={{ marginLeft: 6, background: "#14532d", border: "1px solid #22c55e40", borderRadius: 4, padding: "1px 5px", fontSize: 9, color: "#22c55e" }}>DAILY USE</span>}
                        </div>
                        <div style={{ color: "#475569", fontSize: 10, marginTop: 1 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Win callout */}
          <div style={{ background: "#14532d15", borderRadius: 10, border: "1px solid #22c55e30", padding: 14 }}>
            <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✓ What's improved</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                "Payroll & hours at the very top of the panel",
                "QuickBooks payroll export is front and center",
                "Sidebar trimmed from 10 → 6 items",
                "Company & Company Settings merged into one",
                "Technical tools collapsed out of the way",
                "Each item shows what it actually does",
              ].map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ color: "#22c55e", fontSize: 12, marginTop: 1 }}>✓</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
