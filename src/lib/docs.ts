import type { IconName } from "@/components/icons";

export type DocFaq = { q: string; a: string };

export type DocArticle = {
  id: string;
  title: string;
  icon: IconName;
  category: string;
  summary: string;
  /** Who typically uses this, e.g. "Everyone", "Admins", "Super Admin". */
  audience?: string;
  /** Plain-language overview a brand-new user can understand. */
  intro: string;
  /** What this module/feature is for (the "why"). */
  whatItDoes?: string;
  /** Key capabilities at a glance. */
  features?: string[];
  /** Step-by-step "how to use it". */
  steps: string[];
  tips?: string[];
  faqs?: DocFaq[];
};

export const DOC_CATEGORIES = [
  "Getting Started",
  "Sales & Leads",
  "Communication",
  "Operations",
  "Finance",
  "People & HR",
  "AI & Mobile",
  "Administration",
  "Platform (Super Admin)",
];

export const DOCS: DocArticle[] = [
  // ─────────────────────────── Getting Started ───────────────────────────
  {
    id: "overview",
    title: "How Nexus Works",
    icon: "dashboard",
    category: "Getting Started",
    audience: "Everyone — read this first",
    summary: "The big picture: what Nexus is and how the pieces fit together.",
    intro:
      "Nexus is an all-in-one business workspace that combines a CRM (managing leads, sales and customers), team communication, operations, finance and a full HRMS (human-resources system) in one place. This article explains how the whole system fits together so the rest of the manual makes sense.",
    whatItDoes:
      "Instead of juggling separate tools for sales, email, support, invoicing and HR, Nexus puts them under one login. Everything your team creates — leads, tasks, invoices, employees, tickets — lives in your own private workspace and is shared live with your colleagues.",
    features: [
      "One workspace per company. All your data is isolated from every other company that uses the platform.",
      "Modules: each area of the app (Leads, Tasks, Gmail, Finance, HRMS, etc.) is a 'module' you reach from the left sidebar.",
      "Roles & permissions decide which modules a person can see and whether they can view, create, edit or delete.",
      "Subscription plan decides which modules are unlocked for your whole workspace.",
      "Admin Setup is the control room: the dropdown lists (lead statuses, departments, ticket priorities…) you pick from everywhere are defined there.",
      "A Super Admin (the platform owner) creates client workspaces, sets plans and can assist clients.",
    ],
    steps: [
      "Sign in — you land on the Dashboard, your daily overview.",
      "Use the left sidebar to open a module (Leads, Tasks, Gmail, HRMS, etc.). Items you don't have access to are hidden.",
      "Create and edit records inside each module; changes save to your workspace's database automatically.",
      "Admins open Admin Setup to define the lists and options everyone else picks from.",
      "Use the top-bar search, notification bell and your profile menu (top-right) anywhere in the app.",
    ],
    tips: [
      "If a module isn't in your sidebar, either your plan doesn't include it or your role can't view it — ask an admin.",
      "Read 'Roles, Permissions & Plans' next to understand why you can or can't see certain things.",
    ],
    faqs: [
      { q: "Is my data shared with other companies?", a: "No. Each company gets its own isolated workspace and database. Only people you invite can see your data." },
      { q: "Where is my data stored?", a: "On the server, in your workspace's database — not just in your browser. So you see the same data on any device when you sign in." },
    ],
  },
  {
    id: "getting-started",
    title: "Signing In & Navigating",
    icon: "settings",
    category: "Getting Started",
    audience: "Everyone",
    summary: "Log in, move around, search, and sign out.",
    intro:
      "This covers the essentials: signing in, finding your way around, and the controls that appear on every screen.",
    features: [
      "Email/username + password sign-in, with optional two-step verification (2FA).",
      "Collapsible sidebar that remembers your choice.",
      "Global search, notifications and a profile menu in the top bar.",
      "A bottom tab bar on phones for the most-used screens.",
    ],
    steps: [
      "Open the app — you'll land on the Sign In screen.",
      "Enter your email/username and password and sign in. (If 2FA is on, you'll also enter a 6-digit code from your authenticator app.)",
      "You arrive at the Dashboard. Use the left sidebar to switch modules.",
      "Click the menu (☰) icon to collapse the sidebar to an icon-only rail and reclaim space.",
      "Use the top-bar search to look up records, the bell for notifications, and the avatar menu (top-right) for your profile or to log out.",
    ],
    tips: [
      "Your collapsed/expanded sidebar choice is remembered between visits.",
      "Forgot your password? Use 'Forgot password' on the sign-in screen to get a reset link by email.",
      "If a page says 'authentication required', your session expired — sign in again.",
    ],
    faqs: [
      { q: "Can I use Nexus on my phone?", a: "Yes — it's responsive in any mobile browser, can be installed as an app (Add to Home Screen), and there's a native Android/iOS app that wraps the same workspace." },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "dashboard",
    category: "Getting Started",
    audience: "Everyone",
    summary: "Your daily overview of pipeline, metrics and tasks.",
    intro:
      "The Dashboard is the first screen after signing in. It summarizes your day: key metrics, the sales pipeline by stage, and what needs attention.",
    features: [
      "Headline stat cards (revenue, new leads, active deals, win rate) with trends vs. the previous period.",
      "A sales pipeline chart showing how deals are spread across stages.",
      "An upcoming-tasks panel with priority badges.",
      "Date-range selection and export for the figures.",
    ],
    steps: [
      "Read the stat cards at the top — each shows a number and how it changed vs. the previous period.",
      "Review the Sales Pipeline chart to see how many deals sit at each stage.",
      "Check Upcoming Tasks for what needs attention next.",
      "Use the date-range button and Export to pull numbers for a chosen period.",
    ],
  },
  {
    id: "roles-access",
    title: "Roles, Permissions & Plans",
    icon: "shield",
    category: "Getting Started",
    audience: "Everyone (managed by Admins)",
    summary: "Why you can — or can't — see and do certain things.",
    intro:
      "Access in Nexus is decided by two layers working together: your subscription plan (what the whole workspace gets) and your role (what you personally can do).",
    whatItDoes:
      "The plan unlocks modules for the entire company; the role then decides, per person, which of those modules they can open and whether they can view, create, edit or delete inside them. A module only appears in your sidebar if both layers allow it.",
    features: [
      "Plan-level access: the Super Admin's plan for your workspace unlocks a set of modules (e.g. AI, HRMS, Accounts).",
      "Role-level access: each role grants View / Create / Edit / Delete per module.",
      "Per-user overrides: an admin can grant a single user extra permissions beyond their role.",
      "Administrators bypass role checks and see everything the plan allows.",
    ],
    steps: [
      "Your admin assigns you a role when creating your user (e.g. Administrator, Manager, Sales Rep).",
      "The role controls which modules appear and what you can do inside each.",
      "If you need access to something you can't see, ask an admin to adjust your role or grant a per-user permission.",
      "Admins manage roles in Admin Setup → User Setup → Roles & Permissions.",
    ],
    tips: [
      "A fresh workspace starts with no preset roles or lookups — an admin defines them first in Admin Setup.",
      "Missing a whole module (not just a button)? That's usually the plan, set by the Super Admin.",
    ],
  },
  {
    id: "profile",
    title: "Your Profile & 2FA",
    icon: "users",
    category: "Getting Started",
    audience: "Everyone",
    summary: "Update your details, photo, password and two-step verification.",
    intro:
      "Your profile holds your name, contact details, photo and security settings. Open it from the avatar menu in the top-right.",
    features: [
      "Edit your name, title/designation, department and contact details.",
      "Upload a profile photo.",
      "Change your password.",
      "Enable two-step verification (2FA) with an authenticator app for extra security.",
    ],
    steps: [
      "Click your avatar (top-right) → View profile.",
      "Edit your details and use the camera button on the avatar to upload a photo; save.",
      "To turn on 2FA, choose Enable two-step verification, scan the QR code in an authenticator app (Google Authenticator, Authy…), and enter the 6-digit code to confirm.",
      "After 2FA is on, each sign-in asks for a fresh code.",
    ],
    tips: [
      "Lost your authenticator? An admin can reset 2FA for your account so you can sign in and set it up again.",
    ],
  },

  // ─────────────────────────── Sales & Leads ───────────────────────────
  {
    id: "leads",
    title: "Leads",
    icon: "leads",
    category: "Sales & Leads",
    audience: "Sales / Counsellors",
    summary: "Capture, filter and manage your pipeline of prospects.",
    intro:
      "The Leads module is your pipeline of potential customers. Search, filter, customize the table, and create or update leads as they progress.",
    whatItDoes:
      "Every prospect is a lead with a status (where they are in your pipeline), a source (where they came from) and an owner (who's working it). The module is the day-to-day home for your sales team.",
    features: [
      "Powerful search and Status / Source / Type / City / State filters.",
      "Customizable columns — show/hide, rename and reorder; your layout is saved.",
      "A detail view per lead with notes, reminders, call logs, an activity timeline and transfers.",
      "Frozen Name and Actions columns while you scroll; paging for large lists.",
    ],
    steps: [
      "Use Search and the Status / Source / Type / City / State filters to narrow the list.",
      "Click Columns to show/hide, rename or reorder columns — your layout becomes your default.",
      "Click + Create Lead, fill in the form (name and email are required) and Save — it appears at the top.",
      "Use the eye to open a lead's full detail (notes, reminders, calls, timeline), the pencil to edit, or the trash to delete.",
      "Page through the list at the bottom; the Name and Actions columns stay put as you scroll sideways.",
    ],
    tips: [
      "Status, Source, Type and Sub-Status options come from Admin Setup → Lead Setup, so they stay consistent for everyone.",
      "On a brand-new workspace these dropdowns are empty until an admin adds options — define them first.",
    ],
    faqs: [
      { q: "Where do leads come from?", a: "You can create them manually, capture them through Lead Capture Forms (website embed, CSV import or webhook), or convert website visitors." },
      { q: "Can I reassign a lead to a colleague?", a: "Yes — use a Lead Transfer request, which a manager approves. See the Lead Transfers article." },
    ],
  },
  {
    id: "forms",
    title: "Lead Capture Forms",
    icon: "edit",
    category: "Sales & Leads",
    audience: "Sales / Marketing admins",
    summary: "Collect leads from your website, a link, CSV import or a webhook.",
    intro:
      "Forms let prospects submit their details and flow straight into your Leads list — no manual entry.",
    features: [
      "Build a form with the fields you want and default status/source/type for captured leads.",
      "Three channels: an embeddable website widget, a shareable public link, and a webhook/CSV import.",
      "Optional auto-assignment (round-robin or to a specific person) and duplicate detection.",
      "A custom success message shown after submission.",
    ],
    steps: [
      "Create a form, choose its fields and set the defaults new leads should get.",
      "Pick a channel: copy the embed snippet for your website, share the public link, or use the webhook URL / CSV import.",
      "Turn on auto-assign so each new lead rotates to a counsellor automatically.",
      "Submissions appear in Leads instantly; the form's submission counter ticks up.",
    ],
    tips: ["Use duplicate detection (by email/phone) to avoid the same person entering your pipeline twice."],
  },
  {
    id: "follow-ups",
    title: "Follow-ups",
    icon: "task",
    category: "Sales & Leads",
    audience: "Sales / Counsellors",
    summary: "Never miss the next touch with a lead.",
    intro:
      "Follow-ups track the next action due on each lead so prospects don't go cold. The module surfaces what's due, overdue and completed.",
    features: [
      "See follow-ups due today, upcoming and overdue at a glance.",
      "Completion tracking and simple analytics (aging, ghosted leads, conversion split).",
      "Tied to your leads so context is one click away.",
    ],
    steps: [
      "Open Follow-ups to see what's due, grouped by timing.",
      "Work the due items and mark them done as you go.",
      "Use the analytics to spot leads that have gone quiet.",
    ],
  },
  {
    id: "lead-transfers",
    title: "Lead Transfers",
    icon: "users",
    category: "Sales & Leads",
    audience: "Sales + Managers",
    summary: "Reassign a lead from one person to another, with approval.",
    intro:
      "When a lead should change owner (territory, language, workload), a transfer request keeps it accountable: someone requests, a manager decides.",
    steps: [
      "Open the lead (or the Lead Transfers module) and raise a transfer to the new owner with a reason.",
      "A manager reviews the request and approves or rejects it (with a note).",
      "On approval, ownership moves and the change is recorded on the lead's timeline.",
    ],
  },
  {
    id: "lead-visitor",
    title: "Lead Visitor Requests",
    icon: "pin",
    category: "Sales & Leads",
    audience: "Sales / Front desk",
    summary: "Schedule and track in-person visits for a lead.",
    intro:
      "Lead Visitor requests plan face-to-face meetings — campus tours, demos, document collection — for a prospect, with date, location and attendee.",
    steps: [
      "Create a visitor request: pick the lead, date/time, location, visit type and the attendee hosting it.",
      "Track its status (Pending → Approved → Completed / Cancelled).",
      "The request is logged against the lead so the whole team has context.",
    ],
  },
  {
    id: "call-tracker",
    title: "Call Tracker",
    icon: "call",
    category: "Sales & Leads",
    audience: "Sales / Counsellors",
    summary: "Log calls and match them to leads automatically.",
    intro:
      "Call Tracker records call activity and matches each call to a lead by phone number (primary or alternate), so you can review counts, durations and outcomes.",
    features: [
      "Calls matched to leads by number — no manual linking.",
      "Direction (incoming/outgoing/missed), duration and outcome captured.",
      "Call counts and durations also surface on the Leads table.",
    ],
    steps: [
      "Log a call against a lead with its direction, duration and outcome.",
      "Review the call list, filtered and matched to your leads.",
      "Use the per-lead call history (in the lead's detail view) for full context.",
    ],
  },
  {
    id: "tasks",
    title: "Task Management",
    icon: "task",
    category: "Sales & Leads",
    audience: "Everyone",
    summary: "Plan, assign and track work to completion.",
    intro: "Tasks keep to-dos and follow-ups visible so nothing slips through the cracks.",
    features: [
      "Title, due date, priority and assignees per task.",
      "Tick to complete; open tasks feed the Dashboard's task panel.",
      "Filter by status to focus on what's open.",
    ],
    steps: [
      "Add a task with a title and, optionally, a due date, priority and assignee.",
      "Tick a task to mark it complete (completed tasks are struck through).",
      "Open tasks roll up into the 'Upcoming Tasks' panel on the Dashboard.",
    ],
  },

  // ─────────────────────────── Communication ───────────────────────────
  {
    id: "gmail",
    title: "Gmail",
    icon: "gmail",
    category: "Communication",
    audience: "Everyone (admin connects it)",
    summary: "Read and send email from a connected inbox.",
    intro:
      "The Gmail module brings your inbox into Nexus. An admin connects the account once from Admin Setup → Integrations to enable real sending.",
    steps: [
      "An admin goes to Admin Setup → Integrations and connects Gmail (Google sign-in).",
      "Open Gmail to browse Inbox, Starred, Sent, Drafts and Trash.",
      "Click Compose to write a message using your send-as address and signature.",
      "Search to find a conversation; star or trash messages from the list.",
    ],
    tips: ["Until Gmail is connected, sending is disabled and you'll see a placeholder inbox."],
  },
  {
    id: "chat",
    title: "Team Chat",
    icon: "chat",
    category: "Communication",
    audience: "Everyone",
    summary: "Real-time conversations with your colleagues.",
    intro:
      "Chat keeps internal conversations in one place, with your real team members as contacts, presence and unread counts.",
    features: [
      "Your colleagues appear automatically as chat contacts.",
      "Unread counts, pinning and presence indicators.",
      "A floating chat widget available on most screens.",
    ],
    steps: [
      "Pick a conversation from the left list (filter by All, Unread or Pinned).",
      "Type a message and press Enter to send.",
      "Pin important conversations so they stay at the top.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    icon: "whatsapp",
    category: "Communication",
    audience: "Sales / Support",
    summary: "Start WhatsApp chats with leads and team using click-to-chat.",
    intro:
      "The WhatsApp module builds official wa.me click-to-chat links and keeps a log of messages you send, plus reusable message templates. It opens WhatsApp for you — no risky automation.",
    features: [
      "Reusable message templates with a {name} placeholder.",
      "Click-to-chat links for team members and your own custom contacts.",
      "A local log of the messages you've sent.",
    ],
    steps: [
      "Pick a contact (a team member or one you add) or paste a number.",
      "Choose a template or type a message; the {name} placeholder fills in automatically.",
      "Click to open WhatsApp with the message pre-filled, then send it there.",
    ],
    tips: ["This uses official click-to-chat only — it can't get a number banned because there's no bulk automation."],
  },
  {
    id: "announcement",
    title: "Announcements",
    icon: "announcement",
    category: "Communication",
    audience: "Everyone (admins post)",
    summary: "Broadcast company updates, policies and news.",
    intro:
      "Announcements share company-wide updates with categories, attachments and read tracking.",
    features: [
      "Rich text, categories and file attachments.",
      "Target everyone or specific departments/people.",
      "Pinning, read receipts, likes and comments.",
    ],
    steps: [
      "Click New Announcement, add a title and body, pick a category and (optionally) attach files.",
      "Choose the audience (everyone, or selected departments/users) and publish.",
      "Pin important ones; edit or delete from the card menu; filter or search to find any announcement.",
    ],
  },
  {
    id: "media",
    title: "Media Library",
    icon: "media",
    category: "Communication",
    audience: "Everyone",
    summary: "Store, organize and share files and images.",
    intro:
      "The Media library stores files and images in nested folders on the server, shared across your workspace.",
    steps: [
      "Create folders to organize files; double-click a folder to open it (breadcrumbs show your path).",
      "Drag files onto the page or click Upload to add them to the current folder.",
      "Drag a file/folder onto another folder to move it; rename or delete from the item menu.",
      "Click an image to preview it.",
    ],
    tips: ["You must be signed in to upload — the library is protected by your session."],
  },
  {
    id: "notifications",
    title: "Notifications & Web Push",
    icon: "bell",
    category: "Communication",
    audience: "Everyone (admin configures push)",
    summary: "Stay informed in-app and via browser/phone push.",
    intro:
      "Nexus has an in-app notification center (the bell in the top bar) and real push notifications that reach you even when the tab is closed.",
    features: [
      "In-app bell merging alerts, unread announcements and chat messages.",
      "Real web push on desktop/Android browsers (and iOS when installed as a Home-Screen app).",
      "Native push on the mobile app via Firebase.",
      "Admins choose which events trigger a push.",
    ],
    steps: [
      "Click the bell in the top bar to see your notifications; 'Mark all read' clears the count.",
      "To receive push: open Admin Setup → Notifications → Enable on this device, and allow the browser prompt.",
      "Use 'Send test' to confirm a notification arrives.",
      "Admins pick which events (new lead, task assigned, payment received…) send a push.",
    ],
    tips: ["On iPhone/iPad, install the app to the Home Screen first (Share → Add to Home Screen), then enable push from inside it."],
  },

  // ─────────────────────────── Operations ───────────────────────────
  {
    id: "calendar",
    title: "Calendar",
    icon: "calendar",
    category: "Operations",
    audience: "Everyone",
    summary: "Schedule meetings and track events.",
    intro: "Plan and view meetings and events by day, week or month.",
    steps: [
      "Switch between month and week views.",
      "Click a date or time slot to add an event with a title, time and notes.",
      "Click an existing event to edit or remove it.",
    ],
  },
  {
    id: "support-ticket",
    title: "Support Tickets",
    icon: "ticket",
    category: "Operations",
    audience: "Support teams",
    summary: "Track customer issues from open to resolved.",
    intro:
      "Support Tickets manage customer requests with status, priority, category, assignment and a full history per ticket.",
    features: [
      "Status flow (Open → In Progress → Resolved → Closed) with a visual tracker.",
      "Priority and category (managed in Admin Setup → Support Setup).",
      "Assignment, comments with attachments, and a timeline of every change.",
    ],
    steps: [
      "Create a ticket with subject, description, requester, category and priority.",
      "Assign it to a team member and move its status as you work it.",
      "Add comments (with attachments) to keep the history; resolve and close when done.",
    ],
    tips: ["Categories and priorities come from Admin Setup → Support Setup."],
  },
  {
    id: "assets",
    title: "Asset Management",
    icon: "asset",
    category: "Operations",
    audience: "Admins + asset owners",
    summary: "Assign, verify and track company assets.",
    intro:
      "Track company assets through a workflow: an admin assigns an asset, the owner fills in details and submits, then an admin verifies it. Warranty, depreciation and maintenance are tracked too.",
    features: [
      "Auto-generated asset tags (AST-####).",
      "Assign → submit → verify/reject workflow with a full timeline.",
      "Warranty status, straight-line depreciation and a maintenance log.",
      "Categories and vendors from Admin Setup → Asset Setup.",
    ],
    steps: [
      "As an admin, click Assign new asset — choose a Category and Vendor, assign an owner, and attach an image / purchase bill / warranty document.",
      "The assigned owner opens the asset, completes the details (serial, cost, warranty…) and clicks Submit.",
      "An admin reviews and Verifies (locks) it, or Rejects with a reason so the owner can fix and resubmit.",
      "Use the status tabs and search to find assets; the timeline shows every change.",
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    icon: "asset",
    category: "Operations",
    audience: "Operations / Store",
    summary: "Track stock items, movements and assignments.",
    intro:
      "Inventory tracks consumable/stock items: quantities on hand, stock movements (in/out adjustments) and assignments to people.",
    features: [
      "Stock items with quantities and categories.",
      "Adjustments that record every stock movement.",
      "Assign units to a person and record returns.",
    ],
    steps: [
      "Add a stock item with its starting quantity.",
      "Use Adjust to add or remove stock — each change is logged as a movement.",
      "Assign units to a team member; record a return when they bring it back.",
    ],
  },
  {
    id: "visitor-tracker",
    title: "Website Visitor Tracker",
    icon: "leads",
    category: "Operations",
    audience: "Marketing / Sales",
    summary: "See who's browsing your site and convert them to leads.",
    intro:
      "The Visitor Tracker shows anonymous and identified website sessions with source, device and pages viewed, and lets you convert a promising visitor into a lead.",
    steps: [
      "Open Visitor Tracker to see sessions with their source, device, location and pages.",
      "Open a session to review its journey.",
      "Convert an identified visitor into a lead to start working them in the pipeline.",
    ],
  },

  // ─────────────────────────── Finance ───────────────────────────
  {
    id: "quotations",
    title: "Quotations",
    icon: "quotation",
    category: "Finance",
    audience: "Sales / Accounts",
    summary: "Build price quotes and convert accepted ones to invoices.",
    intro:
      "Quotations are price proposals with line items, discount and tax. Totals compute automatically, and an accepted quote becomes an invoice in one click.",
    features: [
      "Line items with automatic subtotal, discount, tax and total.",
      "Status flow: Draft → Sent → Accepted / Rejected / Expired.",
      "Convert an accepted quotation into an invoice.",
    ],
    steps: [
      "Click New Quotation, add the customer and line items, and set discount/tax — totals compute as you type.",
      "Move it through Draft → Sent → Accepted.",
      "Convert an accepted quotation to an invoice (it appears under Invoices / Payments).",
    ],
  },
  {
    id: "invoices",
    title: "Invoices & Payments",
    icon: "payment",
    category: "Finance",
    audience: "Accounts",
    summary: "Bill customers and record what they pay.",
    intro:
      "Invoices bill customers; Payments record money received against them. An invoice's status (paid/partial/overdue) updates automatically from the payments logged against it.",
    features: [
      "Invoices with line items, tax and due dates.",
      "Payments recorded per invoice; status derived automatically.",
      "Overdue detection based on due date.",
    ],
    steps: [
      "Create an invoice (or convert it from a quotation) with line items and a due date.",
      "Send it, then record payments as money arrives.",
      "The invoice shows Paid, Partially Paid or Overdue based on payments and the due date.",
    ],
  },
  {
    id: "expenses-bills",
    title: "Expenses & Bills",
    icon: "payment",
    category: "Finance",
    audience: "Accounts",
    summary: "Track money going out — business expenses and vendor bills.",
    intro:
      "Expenses capture money your business spends; Bills (accounts payable) track what you owe vendors and how much is paid.",
    steps: [
      "Log an expense with a category, vendor, amount and payment method.",
      "Record vendor bills with issue/due dates and the amount paid so far.",
      "Track each bill's status (Unpaid, Partly Paid, Paid, Overdue).",
    ],
  },
  {
    id: "reports",
    title: "Accounts Reports & Ledger",
    icon: "dashboard",
    category: "Finance",
    audience: "Accounts / Management",
    summary: "See the money picture across invoices, payments and expenses.",
    intro:
      "The accounts dashboard and ledger pull together revenue, receivables and spend so you can see cash flow and outstanding balances at a glance.",
    steps: [
      "Open the Accounts dashboard for revenue, outstanding and expense summaries.",
      "Use the ledger/reports to drill into transactions over a period.",
      "Export figures where available for your records.",
    ],
  },

  // ─────────────────────────── People & HR ───────────────────────────
  {
    id: "users",
    title: "Users & Access",
    icon: "users",
    category: "People & HR",
    audience: "Admins",
    summary: "Create team members and control what they can do.",
    intro:
      "Users are the people who can sign in. Each has a profile, a department/designation, a role and (optionally) extra per-user permissions.",
    features: [
      "Create users with a profile photo, department, designation and role.",
      "Activate/deactivate accounts (deactivated users are signed out within seconds).",
      "Reset a user's 2FA; fine-tune extra permissions per user.",
    ],
    steps: [
      "Click Add New User, fill in the profile, and use the camera button on the avatar to add a photo.",
      "Pick a Designation, Department (from Admin Setup) and a Role, set a password, then save.",
      "Use the role for module permissions, or grant extra permissions to that one user.",
      "Search and filter by role/department/status; edit, deactivate or remove users from the list.",
    ],
    tips: ["Deactivating a user forces them out on their next check (about every 15 seconds) — useful when someone leaves."],
  },
  {
    id: "hrms",
    title: "HRMS Overview",
    icon: "briefcase",
    category: "People & HR",
    audience: "HR + Employees",
    summary: "The human-resources suite: attendance, leave, payroll and more.",
    intro:
      "The HRMS turns Nexus into a people-management system: attendance, leave, holidays, payroll, payslips, recognition, posts, engagement events, medical claims and HR letters. Employees come from your Users/Directory.",
    features: [
      "Attendance with punch in/out and regularisation requests.",
      "Leave applications and approvals; a holiday calendar by state.",
      "Payroll settings, payslip generation and approval.",
      "Awards, posts/notices, engagement events, medical claims and offer/increment letters.",
    ],
    steps: [
      "Open HRMS to reach the people modules from one place.",
      "Employees mirror your team directory — add people in Users first.",
      "Use the sections below (Attendance, Leaves, Payroll…) for day-to-day HR work.",
    ],
  },
  {
    id: "attendance",
    title: "Attendance",
    icon: "clock",
    category: "People & HR",
    audience: "Employees + HR",
    summary: "Punch in/out and correct missed entries.",
    intro:
      "Attendance records each working day via punch in/out. If someone misses or mis-punches, they raise an attendance regularisation (AR) for a manager to approve.",
    steps: [
      "Punch in when you start and punch out when you finish; worked hours are calculated.",
      "Missed a punch? Raise an AR with the correct times and a reason.",
      "A manager approves the AR and the day's attendance is corrected.",
    ],
    tips: ["Shifts and timings are configured in Admin Setup → HR Setup."],
  },
  {
    id: "leaves",
    title: "Leaves & Holidays",
    icon: "calendar",
    category: "People & HR",
    audience: "Employees + HR",
    summary: "Apply for leave and see the holiday calendar.",
    intro:
      "Employees apply for leave (casual, sick, earned, unpaid); managers approve or reject. Holidays are listed per state so the calendar is accurate for each person.",
    steps: [
      "Apply for leave with the type, dates and a reason; the day count is computed.",
      "A manager approves or rejects the request.",
      "View the holiday calendar; HR adds holidays (per state or All India) in the Holidays section.",
    ],
  },
  {
    id: "payroll",
    title: "Payroll & Payslips",
    icon: "payment",
    category: "People & HR",
    audience: "HR / Accounts",
    summary: "Configure salary structure, generate and approve payslips.",
    intro:
      "Payroll computes salaries from a configurable structure (basic %, HRA, PF, tax, professional tax) and produces payslips you can approve and mark credited.",
    steps: [
      "Set the payroll structure in Admin Setup → HR Setup → Payroll (pay day, cut-off, basic/HRA/PF/tax rates).",
      "Generate payslips for a month — each employee's breakdown is calculated automatically.",
      "Approve payslips and mark them credited; employees can view their own.",
    ],
  },
  {
    id: "hr-extras",
    title: "Recognition, Posts, Engagement, Medical & Letters",
    icon: "star",
    category: "People & HR",
    audience: "HR + Employees",
    summary: "The rest of the HR toolkit for a happy, organized team.",
    intro:
      "Beyond the core, HRMS includes recognition awards, an internal notice board, engagement events, medical/insurance claims and generated HR letters.",
    features: [
      "Awards: recognise employees (Star Performer, Long Service…).",
      "Posts: an internal notice board for HR updates.",
      "Engagement: town halls, outings, workshops with RSVPs.",
      "Medical: submit and approve insurance/medical claims.",
      "Letters: generate offer and increment letters from employee data.",
    ],
    steps: [
      "Open the relevant HR section (Awards, Posts, Engagement, Medical, Letters).",
      "Create the record (an award, a notice, an event, a claim or a letter).",
      "Approve/track where a workflow applies (e.g. medical claims).",
    ],
  },

  // ─────────────────────────── AI & Mobile ───────────────────────────
  {
    id: "assistant",
    title: "Nexus AI Assistant",
    icon: "ai",
    category: "AI & Mobile",
    audience: "Everyone (admin enables it)",
    summary: "Ask questions and get help in plain language.",
    intro:
      "The AI Assistant answers questions about your workspace and helps you work faster. Open it from 'Ask AI' in the top bar or the assistant widget.",
    features: [
      "Natural-language help and answers about your data and the app.",
      "Available from the top bar and a floating widget.",
    ],
    steps: [
      "Click 'Ask AI' in the top bar (or open the assistant widget).",
      "Type your question in plain language and send.",
      "Read the reply and continue the conversation as needed.",
    ],
    tips: ["The assistant needs to be enabled by an admin (it requires an API key configured on the server)."],
  },
  {
    id: "mobile",
    title: "Mobile App",
    icon: "phone",
    category: "AI & Mobile",
    audience: "Everyone",
    summary: "Use Nexus on Android and iPhone.",
    intro:
      "Nexus runs on phones three ways: the responsive website, an installable PWA (Add to Home Screen), and a native Android/iOS app that wraps your live workspace with native push and a bottom tab bar.",
    features: [
      "Responsive layout and a bottom tab bar (Home, Leads, HRMS, Tasks, Menu) on phones.",
      "Installable as a PWA from the browser.",
      "Native Android/iOS app with push notifications.",
    ],
    steps: [
      "In a mobile browser, use the site as normal, or 'Add to Home Screen' to install it as an app.",
      "On the native app, sign in once and your workspace loads.",
      "Enable push so you're notified of new leads, tasks and messages.",
    ],
  },

  // ─────────────────────────── Administration ───────────────────────────
  {
    id: "admin-setup",
    title: "Admin Setup",
    icon: "settings",
    category: "Administration",
    audience: "Admins",
    summary: "Define the lists and options the whole app uses.",
    intro:
      "Admin Setup is the control room. It defines the master lists everyone picks from — lead statuses, departments, ticket priorities, asset categories and more. Opening it swaps the sidebar to a dedicated setup menu; use 'Back to Menu' to return.",
    whatItDoes:
      "Most dropdowns across Nexus are driven from here. Add an option once and it appears everywhere; rename or remove it and every module updates. A new workspace starts empty, so this is the first place an admin sets things up.",
    features: [
      "Lead Setup: Status, Source, Type, Sub-Status and custom Lead Fields.",
      "User Setup: Departments, Designations, Roles & Permissions, User Fields, Accounts & Security.",
      "Support Setup: Ticket Category and Priority.",
      "Asset Setup: Asset Categories and Vendors.",
      "HR Setup: Shifts & Timing, Work Locations, Payroll Settings.",
      "System Setup: Branding, Theme & UI, Integrations (Gmail/SMTP), Notifications.",
    ],
    steps: [
      "Open Admin Setup; the sidebar switches to grouped setup sections.",
      "Pick a section (e.g. Lead Setup → Status) and add items with a name and color.",
      "Rename or delete items — changes apply everywhere immediately.",
      "Set up Roles & Permissions, then create Users and assign those roles.",
      "Use 'Back to Menu' to return to the main app.",
    ],
    tips: ["Set up your lookups (statuses, departments, ticket priorities…) before your team starts entering data, so dropdowns aren't empty."],
  },
  {
    id: "branding",
    title: "Branding & Appearance",
    icon: "image",
    category: "Administration",
    audience: "Admins",
    summary: "Make the workspace look like your company.",
    intro:
      "Branding sets your app name, logo and colors; Theme & UI tweaks the look and table density. These live in Admin Setup → System Setup.",
    steps: [
      "Open Admin Setup → System Setup → Branding and set your name, logo and brand color.",
      "Use Theme & UI to adjust appearance and table page size.",
      "Changes apply across the app for everyone in the workspace.",
    ],
  },
  {
    id: "integrations",
    title: "Integrations (Gmail & SMTP)",
    icon: "plug",
    category: "Administration",
    audience: "Admins",
    summary: "Connect email so the app can send mail.",
    intro:
      "Integrations connect outside services. Gmail (via Google sign-in) powers the Gmail module and calendar; SMTP is an alternative way to send transactional email (password resets, etc.).",
    steps: [
      "Open Admin Setup → System Setup → Integrations.",
      "Connect Gmail with Google sign-in to enable the inbox, sending and calendar.",
      "Or configure SMTP credentials as an alternative mail relay; use the test button to confirm.",
    ],
  },
  {
    id: "activity-logs",
    title: "Activity Logs",
    icon: "activity",
    category: "Administration",
    audience: "Admins",
    summary: "See who did what across the workspace.",
    intro:
      "Activity Logs record key actions — sign in/out, lead create/edit/delete, setup changes — per user, grouped by day.",
    steps: [
      "Select a user to see only their activity, or keep All Users.",
      "Filter by category (Auth, Lead, Setup, Media, Task) or search by action.",
      "Entries are grouped by day, newest first.",
    ],
  },
  {
    id: "knowledge-base",
    title: "Using this Knowledge Base",
    icon: "knowledge",
    category: "Administration",
    audience: "Everyone",
    summary: "How to get the most from this manual.",
    intro:
      "This Knowledge Base is your built-in manual. Browse by category on the left or search to jump straight to a topic.",
    steps: [
      "Use the search box at the top to find any topic by keyword.",
      "Browse the category list on the left; click an article to read it.",
      "Each article has an overview, key features, step-by-step instructions and tips/FAQs.",
    ],
    tips: ["New to Nexus? Read 'How Nexus Works' first, then 'Signing In & Navigating'."],
  },

  // ─────────────────────────── Platform (Super Admin) ───────────────────────────
  {
    id: "super-admin",
    title: "Super Admin Console",
    icon: "shield",
    category: "Platform (Super Admin)",
    audience: "Platform owner only",
    summary: "Run the platform: create clients, set plans, assist them.",
    intro:
      "The Super Admin is the platform owner (not a normal company user). The console manages every client company, their subscription plan, feature access, branding and demo bookings.",
    whatItDoes:
      "Where a company's admin manages their own workspace, the Super Admin manages all the workspaces — provisioning new clients (each with its own isolated database), choosing what each plan unlocks, and stepping in to help when needed.",
    features: [
      "Client (tenant) provisioning with an isolated database per company.",
      "Plans & feature access — decide which modules each plan unlocks.",
      "Assisted login into a client workspace, password resets and suspend/activate.",
      "Demo bookings and platform branding.",
    ],
    steps: [
      "Sign in to the Super Admin console with the platform-owner credentials.",
      "Use Clients to create and manage company workspaces.",
      "Use Platform Settings to define plans and which features they include.",
      "Manage demo requests and platform-wide branding from the console.",
    ],
  },
  {
    id: "clients",
    title: "Managing Client Workspaces",
    icon: "users",
    category: "Platform (Super Admin)",
    audience: "Super Admin",
    summary: "Provision, edit, assist and monitor client companies.",
    intro:
      "Each client company gets its own isolated workspace (a separate database) with a seeded admin login. The Clients screen is where the Super Admin creates and looks after them.",
    features: [
      "Provision a new client: company, subdomain, plan, region and an admin login.",
      "Edit plan/status, reset the client admin's password, suspend or activate.",
      "Assisted login ('Login as') to drop into a client's workspace to help.",
      "See each client's user count and last login (when they sign in themselves).",
    ],
    steps: [
      "Click to add a client: enter company details, choose a plan, and set the admin email + temporary password.",
      "The system creates the isolated database, seeds the admin login and registers the client.",
      "Open a client to edit details, reset the password, or suspend/activate the account.",
      "Use 'Login as' to assist a client directly; check 'Last active' to see when they last signed in themselves.",
    ],
    tips: [
      "Assisted login ('Login as') does NOT count as the client's own login — 'Last active' only updates when the client signs in directly.",
      "Suspending a client blocks access without deleting their data.",
    ],
  },
  {
    id: "plans",
    title: "Plans & Feature Access",
    icon: "star",
    category: "Platform (Super Admin)",
    audience: "Super Admin",
    summary: "Decide which modules each subscription plan unlocks.",
    intro:
      "Plans control which modules a client workspace can use. The Super Admin maps each plan (e.g. Free, Starter, Pro, Enterprise) to a set of features, and every client on that plan inherits it.",
    steps: [
      "Open Platform Settings → Permissions/Features.",
      "For each plan, toggle which modules/features are included.",
      "Assign a plan to a client; their sidebar reflects exactly what the plan unlocks.",
    ],
    tips: ["A module hidden for a whole company is almost always a plan setting here — not the user's role."],
  },
];
