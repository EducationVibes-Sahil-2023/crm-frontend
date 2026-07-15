import type { IconName } from "@/components/icons";

// `children` turns an item into a collapsible dropdown (e.g. the HRMS menu).
// `color` is an optional per-item icon colour (set from the menu editor).
// `desc` is an optional one-line subtitle shown under the label (Control-Center
// style rows) when the "Item descriptions" appearance option is on.
export type NavItem = { label: string; href: string; icon: IconName; color?: string; desc?: string; children?: NavItem[] };
export type NavGroup = { heading?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard", desc: "Pipeline at a glance" },
      { label: "AI Assistant", href: "/assistant", icon: "ai", desc: "Ask, draft & summarise" },
      { label: "Leads", href: "/leads", icon: "leads", desc: "Manage your pipeline" },
      { label: "Lead Forms", href: "/forms", icon: "edit", desc: "Capture forms & embeds" },
      { label: "Excel Import", href: "/leads/import", icon: "upload", desc: "Import from Excel/CSV" },
      { label: "Lead Transfers", href: "/lead-transfers", icon: "refresh", desc: "Reassign & route leads" },
      { label: "Visitor Tracker", href: "/visitor-tracker", icon: "eye", desc: "Website visitors" },
      { label: "Follow-ups", href: "/follow-ups", icon: "bell", desc: "Reminders & call-backs" },
      { label: "Task Management", href: "/tasks", icon: "task", desc: "Plan & assign work" },
      {
        label: "Reports",
        href: "/reports",
        icon: "trendUp",
        desc: "Analytics & insights",
        children: [
          { label: "Overview", href: "/reports", icon: "dashboard" },
          { label: "Sales Report", href: "/reports/sales", icon: "revenue" },
          { label: "Leads Report", href: "/reports/leads", icon: "leads" },
          { label: "Inventory Report", href: "/reports/inventory", icon: "inventory" },
          { label: "Financial Report", href: "/account-reports", icon: "trendUp" },
        ],
      },
    ],
  },
  {
    heading: "Communication",
    items: [
      { label: "Gmail", href: "/gmail", icon: "gmail", desc: "Inbox & compose" },
      { label: "Chat", href: "/chat", icon: "chat", desc: "Team messaging" },
      { label: "WhatsApp", href: "/whatsapp", icon: "whatsapp", desc: "Chat with leads" },
      { label: "Media", href: "/media", icon: "media", desc: "Files & attachments" },
      { label: "Announcement", href: "/announcement", icon: "announcement", desc: "Broadcast notices" },
    ],
  },
  {
    heading: "Marketing",
    items: [
      {
        label: "Marketing",
        href: "/marketing",
        icon: "announcement",
        desc: "Campaigns & broadcasts",
        children: [
          { label: "Overview", href: "/marketing", icon: "dashboard" },
          { label: "WhatsApp Marketing", href: "/marketing/whatsapp", icon: "whatsapp" },
          { label: "Email Marketing", href: "/marketing/email", icon: "gmail" },
          { label: "SMS Marketing", href: "/marketing/sms", icon: "message" },
          { label: "Templates", href: "/marketing/templates", icon: "fileText" },
          { label: "Audiences", href: "/marketing/audiences", icon: "users" },
        ],
      },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Calendar", href: "/calendar", icon: "calendar", desc: "Schedule & events" },
      {
        label: "Call Tracker",
        href: "/call-tracker",
        icon: "call",
        desc: "Call log & analytics",
        children: [
          { label: "Call Dashboard", href: "/call-tracker/dashboard", icon: "dashboard" },
          { label: "Call Log", href: "/call-tracker", icon: "list" },
        ],
      },
      {
        label: "Mobile App",
        href: "/downloads",
        icon: "download",
        desc: "Apps & tracking",
        children: [
          { label: "App Downloads", href: "/downloads", icon: "download" },
          { label: "Live Tracking", href: "/live-tracking", icon: "pin" },
          { label: "App Security", href: "/app-security", icon: "shield" },
        ],
      },
      { label: "Lead Visitor", href: "/lead-visitor", icon: "visitor", desc: "Walk-in visitors" },
      { label: "Support Ticket", href: "/support-ticket", icon: "ticket", desc: "Helpdesk & tickets" },
    ],
  },
  {
    heading: "Financial",
    items: [
      {
        label: "Accounts",
        href: "/account-dashboard",
        icon: "revenue",
        desc: "Invoices & payments",
        children: [
          { label: "Accounts Dashboard", href: "/account-dashboard", icon: "dashboard" },
          { label: "Invoices", href: "/invoices", icon: "fileText" },
          { label: "Payments", href: "/payments", icon: "payment" },
          { label: "Quotations", href: "/quotations", icon: "quotation" },
          { label: "Expenses", href: "/expenses", icon: "payment" },
          { label: "Bills & Payables", href: "/bills", icon: "fileText" },
          { label: "Ledger", href: "/ledger", icon: "list" },
          { label: "Reports", href: "/account-reports", icon: "trendUp" },
        ],
      },
      {
        label: "Asset Management",
        href: "/asset-dashboard",
        icon: "asset",
        desc: "Track company assets",
        children: [
          { label: "Asset Dashboard", href: "/asset-dashboard", icon: "dashboard" },
          { label: "Asset Register", href: "/asset-management", icon: "asset" },
          { label: "Assignments", href: "/asset-assignments", icon: "briefcase" },
          { label: "Maintenance", href: "/asset-maintenance", icon: "settings" },
          { label: "Warranty & AMC", href: "/asset-warranty", icon: "shield" },
          { label: "Depreciation", href: "/asset-depreciation", icon: "trendUp" },
          { label: "Audit Log", href: "/asset-audit", icon: "activity" },
        ],
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: "inventory",
        desc: "Stock & suppliers",
        children: [
          { label: "Dashboard", href: "/inventory/dashboard", icon: "dashboard" },
          { label: "All Items", href: "/inventory", icon: "asset" },
          { label: "Low Stock", href: "/inventory/low-stock", icon: "alert" },
          { label: "Stock Movements", href: "/inventory/movements", icon: "refresh" },
          { label: "Categories", href: "/inventory/categories", icon: "grid" },
          { label: "Suppliers", href: "/inventory/suppliers", icon: "briefcase" },
        ],
      },
      { label: "Vendors", href: "/vendors", icon: "briefcase", desc: "Supplier directory" },
      { label: "Knowledge Base", href: "/knowledge-base", icon: "knowledge", desc: "Guides & help docs" },
    ],
  },
  {
    heading: "Human Resources",
    items: [
      {
        label: "HRMS",
        href: "/hrms",
        icon: "users",
        desc: "People & payroll",
        children: [
          { label: "HR Dashboard", href: "/hrms", icon: "dashboard" },
          { label: "Attendance", href: "/attendance", icon: "clock" },
          { label: "All Attendance", href: "/attendance-monitor", icon: "activity" },
          { label: "Leave Management", href: "/leaves", icon: "calendar" },
          { label: "Holidays", href: "/holidays", icon: "star" },
          { label: "Payroll & Salary", href: "/payroll", icon: "payment" },
          { label: "Payslips", href: "/payslips", icon: "fileText" },
          { label: "Policies", href: "/policies", icon: "knowledge" },
          { label: "Awards", href: "/awards", icon: "win" },
          { label: "Engagement", href: "/engagement", icon: "chat" },
          { label: "Posts / Notices", href: "/posts", icon: "announcement" },
          { label: "Medical", href: "/medical", icon: "ticket" },
          { label: "Letters", href: "/letters", icon: "fileText" },
        ],
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "Users", href: "/users", icon: "users", desc: "Team & access" },
      { label: "Activity Logs", href: "/activity-logs", icon: "activity", desc: "Audit trail" },
      { label: "Subscription", href: "/subscription", icon: "star", desc: "Plan & billing" },
      { label: "Admin Setup", href: "/admin-setup", icon: "settings", desc: "Configure workspace" },
    ],
  },
  // NOTE: the platform owner's "Super Admin" menu is intentionally NOT in the
  // client sidebar — client logins must never see it. The super-admin console
  // lives at /admin (its own login at /admin/login + its own navigation).
];
