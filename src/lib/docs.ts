import type { IconName } from "@/components/icons";

export type DocArticle = {
  id: string;
  title: string;
  icon: IconName;
  category: string;
  summary: string;
  intro: string;
  steps: string[];
  tips?: string[];
};

export const DOC_CATEGORIES = [
  "Getting Started",
  "Sales",
  "Communication",
  "Operations",
  "Finance",
  "People",
  "Administration",
];

export const DOCS: DocArticle[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "dashboard",
    category: "Getting Started",
    summary: "Sign in, navigate, and find your way around.",
    intro:
      "Nexus CRM is an all-in-one workspace for sales, communication, operations, finance and people. This guide covers signing in and moving around the app.",
    steps: [
      "Open the app — you'll land on the Sign in screen.",
      "Enter your email and password (demo: admin@nexus.com / admin123) and click Execute Sign In.",
      "You'll arrive at the Dashboard. Use the left sidebar to switch between modules.",
      "Click the menu (☰) icon in the sidebar or top bar to collapse it to an icon-only rail and reclaim space.",
      "Use the search box in the top bar to look up accounts, leads or deals.",
      "Open the avatar menu (top-right) to view your profile or log out.",
    ],
    tips: [
      "Your collapsed/expanded sidebar choice is remembered between visits.",
      "If a page shows 'authentication required', log out and back in to refresh your session.",
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "dashboard",
    category: "Getting Started",
    summary: "Your daily overview of pipeline and tasks.",
    intro:
      "The Dashboard summarizes your day: key metrics, the sales pipeline by stage, and upcoming tasks.",
    steps: [
      "Read the four stat cards at the top — Total Revenue, New Leads, Active Deals and Win Rate — each with a trend vs. the previous period.",
      "Review the Sales Pipeline chart to see how many deals sit at each stage.",
      "Check Upcoming Tasks on the right for what needs attention, with priority badges.",
      "Use the date-range button and Export to pull the numbers for a period.",
    ],
  },
  {
    id: "leads",
    title: "Leads",
    icon: "leads",
    category: "Sales",
    summary: "Capture, filter and manage your sales leads.",
    intro:
      "The Leads module is your pipeline of potential customers. You can search, filter, customize columns, and create new leads.",
    steps: [
      "Use the Search box and the Status / Source / Type / City / State filters to narrow the list.",
      "Click Columns to show/hide, rename or reorder columns — your layout is saved as your default.",
      "Click + Create Lead, fill in the form (name and email are required) and Save — it appears at the top.",
      "In each row, use the eye to view, pencil to edit, or trash to delete a lead.",
      "The Name and Actions columns stay frozen while you scroll sideways; use the pager (25 per page) at the bottom.",
    ],
    tips: [
      "Status, Source and Type options come from Admin Setup → Lead Setup, so they stay consistent.",
    ],
  },
  {
    id: "tasks",
    title: "Task Management",
    icon: "task",
    category: "Sales",
    summary: "Plan, assign and track work to completion.",
    intro: "Track to-dos and follow-ups so nothing slips through the cracks.",
    steps: [
      "Add a task with a title and (optionally) a due date and priority.",
      "Tick a task to mark it complete; completed tasks are visually struck through.",
      "Open tasks feed the 'Open Tasks' figure on the Dashboard.",
    ],
  },
  {
    id: "gmail",
    title: "Gmail",
    icon: "gmail",
    category: "Communication",
    summary: "Read and send email from a connected inbox.",
    intro:
      "The Gmail module gives you an inbox inside the CRM. Connect it from Admin Setup → Integrations to enable sending.",
    steps: [
      "Go to Admin Setup → Integrations and enable + connect Gmail.",
      "Open Gmail to browse Inbox, Starred, Sent, Drafts and Trash.",
      "Click Compose to write a message; it uses your configured send-as address and signature.",
      "Use the search box to find a conversation; star or trash messages from the list.",
    ],
    tips: ["Until Gmail is connected you'll see a demo inbox and sending is disabled."],
  },
  {
    id: "chat",
    title: "Chat",
    icon: "chat",
    category: "Communication",
    summary: "Real-time team and customer conversations.",
    intro: "Chat keeps your conversations in one place with presence and unread counts.",
    steps: [
      "Pick a conversation from the left list (filter by All, Unread or Pinned).",
      "Type a message and press Enter to send; you'll see delivery/read ticks.",
      "Pin important conversations so they stay at the top.",
    ],
  },
  {
    id: "media",
    title: "Media",
    icon: "media",
    category: "Communication",
    summary: "Store, organize and share files and images.",
    intro:
      "The Media library stores files and images in nested folders, backed by the server.",
    steps: [
      "Create folders to organize files; double-click a folder to open it (breadcrumbs show your path).",
      "Drag files onto the page or click Upload to add them to the current folder.",
      "Drag a file or folder onto another folder to move it; rename or delete from the item menu.",
      "Click an image to preview it.",
    ],
    tips: ["Uploads require you to be signed in — the library is protected by your token."],
  },
  {
    id: "announcement",
    title: "Announcements",
    icon: "announcement",
    category: "Communication",
    summary: "Broadcast updates and policies to your team.",
    intro: "Post company-wide announcements with categories and attachments.",
    steps: [
      "Click New Announcement, add a title and body, pick a category and (optionally) attach files.",
      "Publish — it appears for everyone, newest first.",
      "Pin important announcements; edit or delete from the card menu.",
      "Filter by category or search to find an announcement.",
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    icon: "calendar",
    category: "Operations",
    summary: "Schedule meetings and track events.",
    intro: "Plan and view your meetings and events by day, week or month.",
    steps: [
      "Switch between month/week views.",
      "Click a date or slot to add an event with a title, time and notes.",
      "Click an existing event to edit or remove it.",
    ],
  },
  {
    id: "call-tracker",
    title: "Call Tracker",
    icon: "call",
    category: "Operations",
    summary: "Log and analyze your sales calls.",
    intro: "Record call activity and review counts, durations and outcomes.",
    steps: [
      "Log a call against a lead/contact with its duration and outcome.",
      "Review call counts and durations, which also surface on the Leads table.",
    ],
  },
  {
    id: "support-ticket",
    title: "Support Tickets",
    icon: "ticket",
    category: "Operations",
    summary: "Manage and resolve customer support requests.",
    intro: "Track customer issues from open to resolved with priority and category.",
    steps: [
      "Create a ticket with subject, description, requester, category and priority.",
      "Assign it to a team member and update its status as you work it.",
      "Categories and priorities are managed in Admin Setup → Support Setup.",
    ],
  },
  {
    id: "quotations",
    title: "Quotations & Payments",
    icon: "quotation",
    category: "Finance",
    summary: "Create quotes, convert to invoices, track payments.",
    intro:
      "Build price quotes with line items, send them, and convert accepted quotes into invoices.",
    steps: [
      "Click New Quotation, add the customer and line items, set discount/tax — totals compute automatically.",
      "Move the quotation through Draft → Sent → Accepted.",
      "Convert an accepted quotation to an invoice (find it under Payments / Invoices).",
      "Track invoice status and payments from the Payments module.",
    ],
  },
  {
    id: "assets",
    title: "Asset Management",
    icon: "asset",
    category: "Operations",
    summary: "Assign, verify and track company assets.",
    intro:
      "Track company assets through a workflow: an admin assigns an asset, the user fills in details and submits, then an admin verifies it.",
    steps: [
      "As admin, click Assign new asset — pick a Category and Vendor (managed in Admin Setup → Asset Setup), assign an owner, and attach an image / purchase bill / warranty document.",
      "The asset tag (AST-####) is generated automatically.",
      "The assigned user opens the asset, completes the details (serial, cost, warranty, etc.) and clicks Submit.",
      "An admin reviews and Verifies (locks) the asset, or Rejects it with a reason so the user can fix and resubmit.",
      "Use the status tabs and search to find assets; the timeline shows every change.",
    ],
  },
  {
    id: "users",
    title: "Users",
    icon: "users",
    category: "People",
    summary: "Create and manage team members and access.",
    intro: "Manage who can use the CRM, their details, role and permissions.",
    steps: [
      "Click Add New User, fill in the profile, and optionally upload a profile photo using the camera button on the avatar.",
      "Pick a Designation, Department (from Admin Setup) and a Role, set a password, then save.",
      "Use the role to grant module permissions, or fine-tune extra permissions per user.",
      "Edit or remove users from the list; search and filter by role/department/status.",
    ],
  },
  {
    id: "activity-logs",
    title: "Activity Logs",
    icon: "activity",
    category: "Administration",
    summary: "See everything users do across the workspace.",
    intro:
      "Activity Logs record key actions (sign in/out, lead create/edit/delete, setup changes) per user.",
    steps: [
      "Select a user to see only their activity, or keep All Users.",
      "Filter by category (Auth, Lead, Setup, Media, Task) or search by action.",
      "Entries are grouped by day, newest first; use Clear log to reset.",
    ],
  },
  {
    id: "admin-setup",
    title: "Admin Setup",
    icon: "settings",
    category: "Administration",
    summary: "Configure the lists and options the CRM uses.",
    intro:
      "Admin Setup is where admins define the master data used across modules. Opening it swaps the sidebar to a dedicated setup menu; use Back to Menu to return.",
    steps: [
      "Lead Setup: manage Status, Source, Type, Sub Status and custom Lead Fields.",
      "User Setup: manage Departments, Designations, Roles & Permissions and User Fields.",
      "Support Setup: manage Ticket Category and Priority.",
      "Asset Setup: manage Asset Categories and Vendors.",
      "System Setup: configure Integrations (e.g. Gmail) and Payroll.",
      "In each list, add an item with a name and color, rename it, or delete it — changes apply everywhere immediately.",
    ],
  },
];
