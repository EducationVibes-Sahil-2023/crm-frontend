import type { IconName } from "@/components/icons";

// `children` turns an item into a collapsible dropdown (e.g. the HRMS menu).
export type NavItem = { label: string; href: string; icon: IconName; children?: NavItem[] };
export type NavGroup = { heading?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { label: "AI Assistant", href: "/assistant", icon: "ai" },
      { label: "Leads", href: "/leads", icon: "leads" },
      { label: "Lead Forms", href: "/forms", icon: "edit" },
      { label: "Lead Transfers", href: "/lead-transfers", icon: "refresh" },
      { label: "Visitor Tracker", href: "/visitor-tracker", icon: "eye" },
      { label: "Follow-ups", href: "/follow-ups", icon: "bell" },
      { label: "Task Management", href: "/tasks", icon: "task" },
      {
        label: "Reports",
        href: "/reports",
        icon: "trendUp",
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
      { label: "Gmail", href: "/gmail", icon: "gmail" },
      { label: "Chat", href: "/chat", icon: "chat" },
      { label: "WhatsApp", href: "/whatsapp", icon: "whatsapp" },
      { label: "Media", href: "/media", icon: "media" },
      { label: "Announcement", href: "/announcement", icon: "announcement" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Calendar", href: "/calendar", icon: "calendar" },
      {
        label: "Call Tracker",
        href: "/call-tracker",
        icon: "call",
        children: [
          { label: "Call Dashboard", href: "/call-tracker/dashboard", icon: "dashboard" },
          { label: "Call Log", href: "/call-tracker", icon: "list" },
        ],
      },
      {
        label: "Mobile App",
        href: "/downloads",
        icon: "download",
        children: [
          { label: "App Downloads", href: "/downloads", icon: "download" },
          { label: "Live Tracking", href: "/live-tracking", icon: "pin" },
          { label: "App Security", href: "/app-security", icon: "shield" },
        ],
      },
      { label: "Lead Visitor", href: "/lead-visitor", icon: "visitor" },
      { label: "Support Ticket", href: "/support-ticket", icon: "ticket" },
    ],
  },
  {
    heading: "Financial",
    items: [
      {
        label: "Accounts",
        href: "/account-dashboard",
        icon: "revenue",
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
        children: [
          { label: "Dashboard", href: "/inventory/dashboard", icon: "dashboard" },
          { label: "All Items", href: "/inventory", icon: "asset" },
          { label: "Low Stock", href: "/inventory/low-stock", icon: "alert" },
          { label: "Stock Movements", href: "/inventory/movements", icon: "refresh" },
          { label: "Categories", href: "/inventory/categories", icon: "grid" },
          { label: "Suppliers", href: "/inventory/suppliers", icon: "briefcase" },
        ],
      },
      { label: "Vendors", href: "/vendors", icon: "briefcase" },
      { label: "Knowledge Base", href: "/knowledge-base", icon: "knowledge" },
    ],
  },
  {
    heading: "Human Resources",
    items: [
      {
        label: "HRMS",
        href: "/hrms",
        icon: "users",
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
      { label: "Users", href: "/users", icon: "users" },
      { label: "Activity Logs", href: "/activity-logs", icon: "activity" },
      { label: "Subscription", href: "/subscription", icon: "star" },
      { label: "Admin Setup", href: "/admin-setup", icon: "settings" },
    ],
  },
  {
    heading: "Platform",
    items: [
      {
        label: "Super Admin",
        href: "/admin",
        icon: "shield",
        children: [
          { label: "Overview", href: "/admin", icon: "dashboard" },
          { label: "Clients", href: "/admin/clients", icon: "briefcase" },
          { label: "Platform Settings", href: "/admin/settings", icon: "settings" },
          { label: "Landing Page", href: "/", icon: "media" },
        ],
      },
    ],
  },
];
