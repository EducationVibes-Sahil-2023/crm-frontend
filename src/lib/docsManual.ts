// The module manual — one entry per screen in the product, written so a brand
// new client can follow it and so the platform owner can *demo* it.
//
// Each entry carries four layers:
//   • Guide      — what the module is, why it exists, and numbered how-to steps
//   • Functional — the fields, API routes, tables, automations and permissions
//                  behind the screen (what an implementer or support rep needs)
//   • Demo       — a timed demo-station script: prep, beats, and the "wow" line
//   • FAQ / tips — the questions clients actually ask
//
// Screenshots and walkthrough videos are NOT stored here: they are uploaded by
// the platform owner and attached per module (and per step) — see docsMedia.ts.
// The Super Admin console renders all of this at /admin/docs; client workspaces
// read the same catalogue inside their Knowledge Base.

import type { IconName } from "@/components/icons";

export type ManualStep = {
  title: string;
  detail: string;
};

export type ManualFaq = { q: string; a: string };

/** One beat of a live demo — what's on screen, what to say, what to click. */
export type DemoBeat = {
  screen: string;
  say: string;
  do: string;
  watch?: string;
};

export type ManualDemo = {
  goal: string;
  /** Rough length of this demo segment, in minutes. */
  minutes: number;
  /** Data / state to have ready before the client joins the call. */
  prep: string[];
  beats: DemoBeat[];
  /** The single line that lands the value of this module. */
  wow: string;
};

export type ManualFunctional = {
  /** The data the screen captures or shows. */
  fields?: string[];
  /** Backend routes the screen talks to. */
  api?: string[];
  /** Where the data ends up. */
  storage?: string[];
  /** Anything that happens without the user asking. */
  automations?: string[];
  /** Which permission module gates it, and what each action means here. */
  permissions?: string;
  /** Limits, edge cases and known behaviour worth stating up front. */
  notes?: string[];
};

export type ManualModule = {
  /** Stable key — media and notes are attached to this. Never rename. */
  key: string;
  title: string;
  icon: IconName;
  category: string;
  /** Where the module lives in the app. */
  route: string;
  /** Who this screen is for. */
  audience: string;
  /** Plan feature key that unlocks it (see PLATFORM_FEATURES), if gated. */
  feature?: string;
  /** Permission module key (see roles.ts / permissions.ts), if gated. */
  permission?: string;
  summary: string;
  what: string;
  why: string;
  features: string[];
  steps: ManualStep[];
  functional: ManualFunctional;
  demo: ManualDemo;
  tips?: string[];
  faqs?: ManualFaq[];
};

export const MANUAL_CATEGORIES = [
  "Getting Started",
  "Sales & Leads",
  "Communication",
  "Marketing",
  "Operations",
  "Finance & Billing",
  "Assets & Inventory",
  "People & HR",
  "Administration",
  "Platform (Super Admin)",
] as const;

export type ManualCategory = (typeof MANUAL_CATEGORIES)[number];

/** Find one module by key. */
export function manualModule(key: string): ManualModule | undefined {
  return MANUAL.find((m) => m.key === key);
}

/** Modules grouped in category order, skipping empty categories. */
export function manualByCategory(list: ManualModule[] = MANUAL): { category: string; modules: ManualModule[] }[] {
  return MANUAL_CATEGORIES.map((category) => ({
    category,
    modules: list.filter((m) => m.category === category),
  })).filter((g) => g.modules.length > 0);
}

/** Everything searchable about a module, lower-cased, for a plain text filter. */
export function manualHaystack(m: ManualModule): string {
  return [
    m.title, m.key, m.route, m.category, m.audience, m.summary, m.what, m.why,
    ...m.features,
    ...m.steps.flatMap((s) => [s.title, s.detail]),
    ...(m.functional.fields ?? []),
    ...(m.functional.api ?? []),
    ...(m.functional.storage ?? []),
    ...(m.functional.automations ?? []),
    m.functional.permissions ?? "",
    ...(m.functional.notes ?? []),
    m.demo.goal, m.demo.wow,
    ...m.demo.prep,
    ...m.demo.beats.flatMap((b) => [b.screen, b.say, b.do, b.watch ?? ""]),
    ...(m.tips ?? []),
    ...(m.faqs ?? []).flatMap((f) => [f.q, f.a]),
  ]
    .join(" ")
    .toLowerCase();
}

/** Total minutes if you ran every demo segment back to back. */
export function fullDemoMinutes(list: ManualModule[] = MANUAL): number {
  return list.reduce((sum, m) => sum + m.demo.minutes, 0);
}

/** Render one module as Markdown — used by the console's export button. */
export function moduleMarkdown(m: ManualModule): string {
  const L: string[] = [];
  L.push(`## ${m.title}`);
  L.push("");
  L.push(`*${m.category} · ${m.route} · for ${m.audience}*`);
  L.push("");
  L.push(m.what);
  L.push("");
  L.push(`**Why it exists.** ${m.why}`);
  L.push("");
  L.push("### What you get");
  for (const f of m.features) L.push(`- ${f}`);
  L.push("");
  L.push("### How to use it");
  m.steps.forEach((s, i) => L.push(`${i + 1}. **${s.title}** — ${s.detail}`));
  L.push("");
  L.push("### Functional reference");
  const fn = m.functional;
  if (fn.fields?.length) L.push(`- **Data captured:** ${fn.fields.join("; ")}`);
  if (fn.api?.length) L.push(`- **API:** ${fn.api.join(", ")}`);
  if (fn.storage?.length) L.push(`- **Stored in:** ${fn.storage.join(", ")}`);
  if (fn.automations?.length) L.push(`- **Automatic behaviour:** ${fn.automations.join("; ")}`);
  if (fn.permissions) L.push(`- **Permissions:** ${fn.permissions}`);
  for (const n of fn.notes ?? []) L.push(`- ${n}`);
  L.push("");
  L.push(`### Demo station (${m.demo.minutes} min)`);
  L.push(`**Goal.** ${m.demo.goal}`);
  if (m.demo.prep.length) {
    L.push("");
    L.push("**Before the call:**");
    for (const p of m.demo.prep) L.push(`- ${p}`);
  }
  L.push("");
  m.demo.beats.forEach((b, i) => {
    L.push(`${i + 1}. **${b.screen}**`);
    L.push(`   - Do: ${b.do}`);
    L.push(`   - Say: "${b.say}"`);
    if (b.watch) L.push(`   - Watch for: ${b.watch}`);
  });
  L.push("");
  L.push(`**Closing line.** ${m.demo.wow}`);
  if (m.tips?.length) {
    L.push("");
    L.push("### Tips");
    for (const t of m.tips) L.push(`- ${t}`);
  }
  if (m.faqs?.length) {
    L.push("");
    L.push("### FAQ");
    for (const f of m.faqs) {
      L.push(`**${f.q}**`);
      L.push("");
      L.push(f.a);
      L.push("");
    }
  }
  return L.join("\n");
}

/** The whole manual as one Markdown document. */
export function manualMarkdown(list: ManualModule[] = MANUAL): string {
  const out: string[] = ["# Product manual", ""];
  for (const g of manualByCategory(list)) {
    out.push(`# ${g.category}`, "");
    for (const m of g.modules) out.push(moduleMarkdown(m), "");
  }
  return out.join("\n");
}

export const MANUAL: ManualModule[] = [
  // ───────────────────────────── Getting Started ─────────────────────────────
  {
    key: "getting-started",
    title: "Signing in & finding your way",
    icon: "key",
    category: "Getting Started",
    route: "/login",
    audience: "Everyone — day one",
    summary: "Log in, understand the layout, and know where every module lives.",
    what:
      "Your workspace opens with a sign-in screen, then a three-part layout: a left sidebar with every module, a top bar with search, notifications and your account, and the working area in the middle. Everything in this manual lives somewhere in that sidebar.",
    why:
      "Most support questions on day one are 'where is X'. Ten minutes here removes them: once someone can read the sidebar groups (Sales, Communication, Operations, Financial, Human Resources, Administration) they can find any screen without asking.",
    features: [
      "Email + password sign-in, with optional two-step verification (2FA).",
      "Forgot-password self service — a reset link is emailed to the user.",
      "Sidebar grouped by area, with collapsible sub-menus for big modules (HRMS, Accounts, Assets, Inventory, Marketing).",
      "Collapse the sidebar to an icon rail for more screen space; the choice is remembered.",
      "Quick actions pinned above the menu: new lead, compose mail, new task, calendar.",
      "The menu only ever shows modules your role and your plan allow.",
    ],
    steps: [
      { title: "Open your workspace URL", detail: "Your administrator sends you the link plus your email and a first password. The landing page is public; the app itself starts at /login." },
      { title: "Sign in", detail: "Enter your email and password. If your administrator switched on two-step verification, you'll then be asked for the 6-digit code from your authenticator app." },
      { title: "Set a password you'll keep", detail: "Open Profile from the top-right avatar and change the first password immediately. This is also where you turn on 2FA for yourself." },
      { title: "Read the sidebar once", detail: "Scan the group headings top to bottom. Items with a chevron expand into sub-pages — for example HRMS holds attendance, leaves, payroll and payslips." },
      { title: "Use the quick actions", detail: "The four buttons above the menu create the things people create most: a lead, an email, a task, a calendar event." },
      { title: "Collapse for space", detail: "The « button at the top of the sidebar shrinks it to icons. Hover any icon to see its label; click the » to bring the labels back." },
      { title: "If a page is missing", detail: "Two things hide a module: your role doesn't grant view on it, or your subscription plan doesn't include it. Ask your administrator which of the two applies." },
    ],
    functional: {
      fields: ["Email", "Password", "6-digit TOTP code (when 2FA is enabled)"],
      api: ["POST /api/auth/login", "GET /api/auth/me", "POST /api/auth/2fa/verify", "POST /api/auth/forgot-password", "POST /api/auth/reset-password"],
      storage: ["`users` table (credentials, role, active flag, 2FA secret)", "Session token in browser storage — the only thing kept outside the database"],
      automations: [
        "A signed-in session is re-checked every 15 seconds — deactivating an account logs that person out within seconds, on every device.",
        "Reset links are short-lived and single-use.",
      ],
      permissions: "Sign-in is open to any active account. What appears after sign-in is decided by the role matrix (view/create/edit/delete per module) merged with the plan's feature list.",
      notes: [
        "Deactivated accounts can't sign in and are pushed out of any open session.",
        "The super-admin console is a separate login at /admin/login and never appears in a client's sidebar.",
      ],
    },
    demo: {
      goal: "Get the prospect oriented in under three minutes so the rest of the demo lands.",
      minutes: 3,
      prep: [
        "Sign out beforehand so the client sees the real login screen.",
        "Have the demo workspace branded with your logo (Super Admin → Settings → Branding).",
        "Know the plan you're pitching — hide modules it doesn't include.",
      ],
      beats: [
        { screen: "Login", say: "One login, one workspace. Your data is in its own database, not mixed with anyone else's.", do: "Sign in with the demo administrator account.", watch: "Clients often ask about 2FA here — mention it's per-user and free." },
        { screen: "Dashboard on first paint", say: "Everything your team needs is in this one sidebar — sales on top, then communication, operations, money and people.", do: "Run your cursor down the sidebar groups without clicking." },
        { screen: "Sidebar collapse", say: "On a laptop you can reclaim the space; the app remembers your choice.", do: "Collapse and expand the rail once." },
      ],
      wow: "You've just seen the whole product's navigation — six groups, one login, and every module in this demo is included in what we're quoting.",
    },
    tips: [
      "Bookmark /dashboard rather than the landing page — it skips a click.",
      "The search box in the top bar reaches leads, users and tasks; use it before hunting through menus.",
    ],
    faqs: [
      { q: "I forgot my password.", a: "Click 'Forgot password' on the sign-in screen. A reset link is emailed to you; it expires shortly and works once." },
      { q: "Why can't I see a module a colleague can?", a: "Your role's matrix doesn't grant 'view' on it, or it isn't part of your workspace's plan. Administrators can check both in Admin Setup → Roles & Permissions and in Subscription." },
    ],
  },
  {
    key: "dashboard",
    title: "Dashboard",
    icon: "dashboard",
    category: "Getting Started",
    route: "/dashboard",
    audience: "Everyone",
    permission: "dashboard",
    summary: "The daily home screen: pipeline numbers, today's work, and recent activity.",
    what:
      "The dashboard summarises the workspace in tiles and charts — how many leads are open, what's converting, what's due today, and what the team has been doing. It's the first screen after sign-in and the one people leave open all day.",
    why:
      "A manager should be able to answer 'how are we doing?' without running a report, and a rep should see their own day without opening four modules.",
    features: [
      "Counter tiles for leads, conversions, tasks and revenue, animated on load.",
      "Pipeline breakdown by status so stalled stages are obvious.",
      "Today's follow-ups and tasks, with one click through to the record.",
      "Recent activity feed drawn from the workspace audit trail.",
      "Everything respects permissions — you only see figures from modules you can view.",
    ],
    steps: [
      { title: "Read the tiles left to right", detail: "They move from volume (leads in) to outcome (won / revenue). A tile with a red trend is where to spend the morning." },
      { title: "Open the pipeline chart", detail: "Each bar is a lead status. Click a bar to jump into Leads pre-filtered to that status." },
      { title: "Clear today's list", detail: "The follow-ups and tasks panels only show what's due now or overdue. Work top-down; each row links to the lead or task." },
      { title: "Scan recent activity", detail: "The feed shows who changed what. Use it in stand-ups instead of asking for updates." },
      { title: "Refresh with confidence", detail: "Figures come live from the database on every load — there's no cached copy to go stale." },
    ],
    functional: {
      fields: ["Aggregates only — no data is entered on this screen"],
      api: ["GET /api/leads", "GET /api/tasks", "GET /api/activity", "GET /api/calls/analytics"],
      storage: ["Reads the `leads`, `tasks`, `calls` and `activity_log` tables; nothing is written from here"],
      automations: ["Tiles recount on every visit", "Counters animate from zero so changes are noticed"],
      permissions: "Gated by the `dashboard` module. Sections whose source module you cannot view are dropped rather than shown empty.",
      notes: ["Figures are workspace-wide for administrators and scoped to the signed-in user for roles without team-wide view."],
    },
    demo: {
      goal: "Show that the product answers 'how is the business doing' the second you log in.",
      minutes: 4,
      prep: [
        "Seed 30–60 leads across every status so the pipeline chart isn't flat.",
        "Make sure two follow-ups are due today and one is overdue — a red row sells the reminder engine.",
        "Have recent activity from two or three different demo users, not just one.",
      ],
      beats: [
        { screen: "Dashboard tiles", say: "This is the whole business in five numbers, and it's live — not a nightly report.", do: "Let the counters finish animating, then point at conversion rate." },
        { screen: "Pipeline chart", say: "Every bar is a stage you define yourself. This tall one is where deals are stuck.", do: "Click the tallest bar to open Leads filtered to that status.", watch: "This is the moment to ask what their stages are called today." },
        { screen: "Today panel", say: "Your reps don't plan their day — the system does it for them.", do: "Point at the overdue follow-up in red." },
        { screen: "Activity feed", say: "And every change is logged, by person and time.", do: "Scroll the feed a few rows." },
      ],
      wow: "No spreadsheets, no morning status call — the first screen after login already answers what's in, what's stuck and what's due.",
    },
    tips: ["Managers: compare the conversion tile week to week rather than daily — daily swings are noise."],
    faqs: [
      { q: "Why is my dashboard emptier than my manager's?", a: "Roles without team-wide view see only their own records, so tiles count their own pipeline." },
      { q: "Can the tiles be changed?", a: "The tile set is fixed today. For a different cut of the same data, use Reports, which supports date ranges and exports." },
    ],
  },
  {
    key: "profile",
    title: "Your profile & 2FA",
    icon: "users",
    category: "Getting Started",
    route: "/profile",
    audience: "Everyone",
    summary: "Your photo, contact details, password and two-step verification.",
    what:
      "Your own account page: name, photo, contact details, the password you sign in with, and the switch for two-step verification. It also shows the role you've been given and what that role allows.",
    why:
      "Personal details and credentials should never need an administrator. Self-service here keeps IT out of password resets and makes 2FA adoption realistic.",
    features: [
      "Upload a profile photo used across chat, comments and assignment pickers.",
      "Change your password without an administrator.",
      "Enable 2FA with any authenticator app by scanning a QR code.",
      "See your role and its permissions read-only, so you know what to ask for.",
    ],
    steps: [
      { title: "Open Profile", detail: "Click your avatar in the top-right corner, then Profile." },
      { title: "Complete your details", detail: "Name, phone and photo. Your photo is what colleagues see in chat and on assigned records." },
      { title: "Change your password", detail: "Enter the current password, then the new one twice. You stay signed in on this device." },
      { title: "Turn on two-step verification", detail: "Click Enable, scan the QR code with Google Authenticator (or any TOTP app), and type the 6-digit code to confirm. From then on sign-in asks for a code." },
      { title: "Check your role", detail: "The permissions panel shows what your role can view, create, edit and delete. If something is missing, this is the exact wording to send your administrator." },
    ],
    functional: {
      fields: ["Full name", "Email (sign-in identity)", "Phone", "Photo", "Password", "2FA secret + enabled flag"],
      api: ["GET /api/auth/me", "PUT /api/users/{id}", "POST /api/auth/2fa/setup", "POST /api/auth/2fa/enable", "POST /api/auth/2fa/disable"],
      storage: ["`users` table; the profile blob lives in the workspace store under `nexus_profile`"],
      automations: ["Changing your photo updates it everywhere immediately — chat, pickers, activity rows."],
      permissions: "Always available to every signed-in user; no module permission is needed for your own record.",
      notes: [
        "An administrator can reset another person's 2FA from Users if they lose their phone.",
        "Email is your sign-in identity — only an administrator can change it.",
      ],
    },
    demo: {
      goal: "Show that security is real and self-service, in under two minutes.",
      minutes: 2,
      prep: ["Have an authenticator app on your phone ready to scan on screen."],
      beats: [
        { screen: "Profile", say: "Every user manages their own details — nobody files a ticket to change a phone number.", do: "Update the photo or phone field and save." },
        { screen: "2FA panel", say: "Two-step verification is standard, per user, and free.", do: "Click Enable and show the QR code (don't complete it unless asked).", watch: "Security-conscious buyers relax visibly here — pause for the question." },
      ],
      wow: "Bank-grade sign-in on every account, and your team switches it on themselves.",
    },
    faqs: [
      { q: "I lost my phone and can't get a code.", a: "Ask an administrator to reset 2FA on your account from Users → the row menu → Reset 2FA. You'll set it up again on the new phone." },
    ],
  },
  {
    key: "assistant",
    title: "AI Assistant",
    icon: "ai",
    category: "Getting Started",
    route: "/assistant",
    audience: "Everyone (plan-gated)",
    feature: "ai",
    permission: "dashboard",
    summary: "Ask questions about your workspace in plain language, and draft replies.",
    what:
      "A chat assistant that can read your workspace — leads, tasks, HR records — and answer questions or draft text about them. It runs as a tool loop: you ask, it looks up the relevant records, then answers with what it found. A floating Ask AI button puts the same assistant on every page.",
    why:
      "New users don't know which report to run. Asking 'which leads went quiet this week?' is faster than learning a filter UI, and drafting a follow-up email from the assistant beats writing it from scratch.",
    features: [
      "Plain-language questions answered from live workspace data.",
      "Drafting: follow-up emails, WhatsApp replies, lead summaries, meeting notes.",
      "Role-aware — the assistant only reaches data your permissions already allow.",
      "Floating Ask AI widget on every screen, so you never lose your place.",
      "Works with Anthropic Claude, or with a free Groq key, configured by the platform owner.",
    ],
    steps: [
      { title: "Open AI Assistant", detail: "From the sidebar, or the floating Ask AI button in the corner of any page." },
      { title: "Ask about your data", detail: "Try 'show me leads with no activity in 10 days' or 'summarise this month's conversions'. The assistant fetches the records before answering." },
      { title: "Ask it to write", detail: "'Draft a polite follow-up to Priya about the pending quotation' produces text you can copy straight into Gmail or WhatsApp." },
      { title: "Keep the thread going", detail: "Follow-up questions keep the context — 'now make it shorter' or 'do the same for the other three' works." },
      { title: "Check before you send", detail: "Treat drafts as first drafts. Read them, adjust the specifics, then send." },
    ],
    functional: {
      fields: ["Your prompt", "Conversation history for the session"],
      api: ["POST /api/ai/chat — a server-side relay that keeps the provider key secret"],
      storage: ["Conversations are per-session in the browser; the relay stores no transcript"],
      automations: ["The client-side tool loop decides which records to fetch, calls the existing APIs, then sends the results back for the final answer."],
      permissions: "Gated by the `ai` plan feature. Data reached through the tool loop is fetched with your own token, so nothing outside your permissions is visible.",
      notes: [
        "If no provider key is configured, the module explains that instead of failing silently — the platform owner sets it in Super Admin → Settings.",
        "Answers depend on the data being in the workspace: an empty CRM produces empty answers.",
      ],
    },
    demo: {
      goal: "Land that the AI is grounded in the client's own data, not generic chat.",
      minutes: 4,
      prep: [
        "Confirm the AI provider key is set and the assistant answers before the call.",
        "Have one lead with a messy, long note history — the summary lands better.",
        "Rehearse two prompts; improvising here is how demos go quiet.",
      ],
      beats: [
        { screen: "AI Assistant", say: "This isn't a chatbot bolted on — it reads your actual pipeline.", do: "Ask: 'Which leads have had no activity for 10 days?'", watch: "Let the tool loop's fetch finish before speaking again." },
        { screen: "Answer", say: "It went and looked. Same permissions as the person asking — a rep can't ask their way into someone else's accounts.", do: "Point at a named lead in the answer." },
        { screen: "Drafting", say: "Now make it useful.", do: "Ask it to draft a follow-up email to one of those leads." },
        { screen: "Floating widget", say: "And it's on every screen, so nobody switches context.", do: "Open the Ask AI bubble from a different page." },
      ],
      wow: "Your team stops learning reports and just asks — and every answer comes from their own live data, inside their own permissions.",
    },
    tips: [
      "Be specific about the time window — 'this month' beats 'recently'.",
      "Ask for a format: 'as a bulleted list', 'in three sentences', 'as a WhatsApp message'.",
    ],
    faqs: [
      { q: "Does my data leave the workspace?", a: "The prompt and the records the assistant fetched are sent to the configured AI provider to generate the answer. Nothing is stored by the relay. If that's not acceptable, the platform owner can leave the module switched off for your plan." },
      { q: "It says AI isn't configured.", a: "The platform owner hasn't set an API key yet. Super Admin → Settings → AI provider." },
    ],
  },
  // ────────────────────────────── Sales & Leads ──────────────────────────────
  {
    key: "leads",
    title: "Leads",
    icon: "leads",
    category: "Sales & Leads",
    route: "/leads",
    audience: "Sales team, sales managers",
    feature: "leads",
    permission: "leads",
    summary: "The pipeline: every enquiry, its status, its owner and its history.",
    what:
      "The core CRM screen. Every enquiry — typed in, imported, captured by a form or raised by a visitor — becomes a lead row with an owner, a status, a source and a full history of calls, notes and follow-ups. Open any lead to get its detail panel with everything that ever happened to it.",
    why:
      "Enquiries die in inboxes and notebooks. A shared pipeline with an owner and a next action per lead is the difference between 'we called them at some point' and a forecast you can trust.",
    features: [
      "List with search, and filters on status, source, type, owner and date.",
      "Lead detail panel: contact details, custom fields, notes, call log, follow-ups and files in one place.",
      "Statuses, sources, types and sub-statuses are yours to define (Admin Setup) — no fixed vocabulary.",
      "Custom lead fields for whatever your business actually captures.",
      "Assign or reassign an owner; reps see their own, managers see everyone's.",
      "One-click call, WhatsApp or email from the row, all logged back to the lead.",
      "Export the filtered list to Excel/CSV.",
    ],
    steps: [
      { title: "Add a lead", detail: "Click New Lead, fill in name and phone (the only truly required fields), then set status, source and owner. Everything else can follow later." },
      { title: "Work the list with filters", detail: "Filter by status to run a stage review, by owner for a one-to-one, by source to see which channel is actually paying." },
      { title: "Open a lead", detail: "Click the row. The detail panel shows contact info, custom fields and the full timeline — every note, call and follow-up in order." },
      { title: "Log what happened", detail: "After a conversation, add a note and move the status. This is the habit the whole system depends on; two lines is enough." },
      { title: "Set the next action", detail: "From the lead, create a follow-up with a date. It then appears on the dashboard and in Follow-ups until it's done." },
      { title: "Reassign when needed", detail: "Change the owner directly on the lead, or use Lead Transfers when the rep has to request the move rather than make it." },
      { title: "Export for a meeting", detail: "Filter to what you want, then Export — the download contains exactly the filtered rows and columns." },
    ],
    functional: {
      fields: [
        "Name, phone, alternate phone, email, company",
        "Status, sub-status, source, type (all admin-defined lists)",
        "Owner (assigned user), value/amount, expected close",
        "Address / city, notes, custom fields defined in Admin Setup → Lead Fields",
        "Created and updated timestamps, taken from the database clock",
      ],
      api: ["GET/POST /api/leads", "PUT/DELETE /api/leads/{id}", "GET /api/config/status | source | type | sub-status", "POST /api/activity"],
      storage: ["`leads` table (normalised, one row per lead) in the workspace database", "Lookup lists in the `config` tables; custom field definitions in the workspace store"],
      automations: [
        "Every create, edit, status change and delete is written to the activity log with the user and timestamp.",
        "Creating a lead from a form, an import or a visitor request lands in the same table — one pipeline, whatever the channel.",
        "Follow-up reminders raise notifications for the owner.",
      ],
      permissions: "Module `leads`. view = see the list; create = add leads; edit = change fields, status and owner; delete = remove leads. Roles without team-wide view see only leads they own.",
      notes: [
        "Duplicate detection is on phone number — importing the same sheet twice will warn you before it doubles your pipeline.",
        "Deleting a lead removes its notes and follow-ups too; consider a 'Lost' status instead.",
      ],
    },
    demo: {
      goal: "Prove the pipeline is theirs — their stages, their fields, their sources — not a template they must adopt.",
      minutes: 8,
      prep: [
        "Seed 40+ leads with realistic names spread across every status and source.",
        "Rename the statuses to the prospect's own vocabulary before the call — this single change wins meetings.",
        "Add one custom lead field that only their industry would have.",
        "Have one lead with a rich timeline: three notes, two calls, one completed follow-up.",
      ],
      beats: [
        { screen: "Leads list", say: "This is every enquiry you have, in one place, with an owner and a next step.", do: "Sort by newest, then filter to one status." },
        { screen: "Filters", say: "Any question a manager asks is a filter, not a report request.", do: "Filter by source, then by owner." },
        { screen: "Lead detail", say: "Everything that ever happened to this person is on one screen — nothing lives in someone's inbox.", do: "Open the seeded lead with the rich timeline.", watch: "Pause here. This is where prospects picture their own messy handovers." },
        { screen: "Custom field", say: "And these fields are yours — we set them up to match how you qualify.", do: "Point at the industry-specific field you added." },
        { screen: "Status change + follow-up", say: "One move, and the next action is scheduled and will chase the rep, not the other way round.", do: "Change the status and create a follow-up dated today." },
        { screen: "Export", say: "And it's your data — one click to Excel, always.", do: "Export the filtered list." },
      ],
      wow: "Your stages, your fields, your sources — and every enquiry with a name against it and a date for the next call.",
    },
    tips: [
      "Agree as a team what each status means before you go live; ambiguous stages make the pipeline chart useless.",
      "Fewer statuses work better than many. Five to seven is the sweet spot.",
      "Make notes short and factual — 'asked for pricing, sending Tuesday' beats a paragraph.",
    ],
    faqs: [
      { q: "Can two people own one lead?", a: "One owner at a time, so accountability is unambiguous. Anyone with team-wide view can still see and comment on it." },
      { q: "How do I bulk-change status?", a: "Filter to the set you want and use the bulk action in the list header. It's logged per lead in the activity trail." },
      { q: "Where do form and website leads land?", a: "Straight into this list, tagged with the source that produced them." },
    ],
  },
  {
    key: "lead-import",
    title: "Excel / CSV import",
    icon: "upload",
    category: "Sales & Leads",
    route: "/leads/import",
    audience: "Administrators, sales managers",
    feature: "leads",
    permission: "leads",
    summary: "Bring an existing spreadsheet of leads in, with column mapping and a preview.",
    what:
      "A guided importer: upload an .xlsx or .csv, map your columns onto lead fields, preview what will be created, then import. It is how a new client moves years of spreadsheet history into the CRM on day one.",
    why:
      "Nobody starts empty. If the first hour of a new system is retyping 800 rows, the rollout fails. Import removes the single biggest reason teams stall.",
    features: [
      "Accepts .xlsx and .csv, any column order.",
      "Column mapping onto standard and custom lead fields.",
      "Preview of the first rows exactly as they will be created.",
      "Duplicate warning on phone numbers already in the pipeline.",
      "Bulk-assign an owner, source and status to the whole batch.",
      "A summary at the end: created, skipped, and why.",
    ],
    steps: [
      { title: "Tidy the sheet first", detail: "One header row, one lead per row, phone numbers in a single column. Ten minutes in Excel saves an hour of cleanup afterwards." },
      { title: "Upload the file", detail: "Leads → Excel Import → choose file. Large files take a moment to parse in the browser." },
      { title: "Map the columns", detail: "For each column in your sheet, pick the lead field it fills. Anything left unmapped is ignored — that's fine for columns you don't need." },
      { title: "Set batch defaults", detail: "Choose the owner, source and starting status to apply to every row. 'Imported — Jan sheet' as a source makes the batch traceable forever." },
      { title: "Check the preview", detail: "Read the first few rows carefully. If a phone number landed in the email column, fix the mapping now, not after 800 rows." },
      { title: "Import and read the summary", detail: "The result says how many were created and how many were skipped as duplicates. Fix and re-run only the skipped ones if needed." },
    ],
    functional: {
      fields: ["Any lead field, including custom fields", "Batch defaults: owner, source, status"],
      api: ["POST /api/leads (one call per row, batched by the importer)"],
      storage: ["`leads` table — imported rows are ordinary leads, indistinguishable afterwards except by their source tag"],
      automations: ["Duplicate check on phone number before insert", "Each imported lead is written to the activity log so the batch is auditable"],
      permissions: "Module `leads`, requires `create`. Administrators typically run imports.",
      notes: [
        "Parsing happens in your browser, so the sheet isn't uploaded anywhere until you press Import.",
        "Very large files (10k+ rows) are best split into a few smaller sheets.",
        "There is no undo — import a 20-row test slice first, check it, then run the rest.",
      ],
    },
    demo: {
      goal: "Remove the 'but our data is all in Excel' objection on the spot.",
      minutes: 4,
      prep: [
        "Ask for a sample of the prospect's own sheet before the call — importing THEIR file is worth ten of yours.",
        "Have a 20-row file ready with deliberately messy column names.",
        "Know how you'll delete the demo import afterwards.",
      ],
      beats: [
        { screen: "Import", say: "Whatever your spreadsheet looks like today, it comes in as-is.", do: "Upload the messy sample file." },
        { screen: "Mapping", say: "You tell it once which column is which — including your own custom fields.", do: "Map two obviously-mismatched columns.", watch: "If it's their file, read a real customer name aloud; the room changes." },
        { screen: "Preview + import", say: "Preview, import, done. Duplicates are caught on phone number so you don't double your pipeline.", do: "Run the import and show the summary." },
      ],
      wow: "Your existing spreadsheet is in the CRM in under two minutes — nobody retypes anything.",
    },
    faqs: [
      { q: "Can I import notes and history?", a: "Notes can be mapped into the lead's note field. Per-note history with individual timestamps needs a data migration — the platform owner can run one." },
      { q: "What happens to duplicates?", a: "Rows whose phone number already exists are skipped and reported in the summary; nothing is overwritten." },
    ],
  },
  {
    key: "forms",
    title: "Lead capture forms",
    icon: "edit",
    category: "Sales & Leads",
    route: "/forms",
    audience: "Marketing, administrators",
    feature: "forms",
    permission: "leads",
    summary: "Build a public form, share or embed it, and have submissions arrive as leads.",
    what:
      "A form builder that produces a public page (and an embeddable snippet) with the fields you choose. Every submission creates a lead in the pipeline, tagged with the form it came from.",
    why:
      "The gap between a website enquiry and a CRM record is where leads leak. A form that writes directly into the pipeline closes it — no inbox, no copy-paste, no delay.",
    features: [
      "Field list you assemble yourself: text, email, phone, dropdown, textarea, checkbox.",
      "Required-field control and simple validation.",
      "A public link you can share on WhatsApp or in a campaign, plus an embed snippet for your site.",
      "Each form maps to a source and a default owner, so routing is automatic.",
      "Submissions appear in Leads immediately; the form's own view shows its intake.",
    ],
    steps: [
      { title: "Create a form", detail: "Lead Forms → New form. Name it after where it will live ('Website contact', 'Trade show iPad') so the source tag is meaningful later." },
      { title: "Add your fields", detail: "Start with name and phone, then only what you'll genuinely use. Every extra field costs you completions." },
      { title: "Set routing", detail: "Choose the source to tag submissions with, the starting status, and the owner who should get them." },
      { title: "Publish and share", detail: "Copy the public link for messages and campaigns, or paste the embed snippet into your website." },
      { title: "Test it once", detail: "Submit the form yourself and confirm the lead appears in the pipeline with the right owner and source." },
      { title: "Watch the intake", detail: "The form's detail view lists its submissions, so you can see which form is actually producing." },
    ],
    functional: {
      fields: ["Form name, description", "Field definitions (label, type, required)", "Routing: source, default status, default owner"],
      api: ["Public form render at /forms/{id} + submit", "POST /api/leads on submission"],
      storage: ["Form definitions in the workspace store (`nexus_lead_forms`); submissions become rows in `leads` (raw intake under `nexus_intake_leads`)"],
      automations: ["A submission creates the lead, tags the source, assigns the owner and raises a notification for them."],
      permissions: "Module `leads` (create/edit) to build forms. The public form page itself needs no login — that's the point.",
      notes: [
        "The public page is intentionally unauthenticated; don't ask for sensitive data on it.",
        "Deleting a form does not delete the leads it produced.",
      ],
    },
    demo: {
      goal: "Show a website enquiry becoming an assigned CRM lead, live, in one minute.",
      minutes: 4,
      prep: [
        "Build a two-field form before the call and have the public link open in a second browser tab.",
        "Have the Leads list open in the first tab, sorted newest first.",
      ],
      beats: [
        { screen: "Form builder", say: "You decide what to ask. Fewer fields, more submissions.", do: "Add one field live so they see how fast it is." },
        { screen: "Public form (second tab)", say: "This is what your visitor sees — on your site or as a link in a WhatsApp message.", do: "Fill it in as a customer would and submit." },
        { screen: "Leads list (first tab)", say: "And there it is. Owned, tagged to the source, with the clock already running.", do: "Refresh the list and open the brand-new lead.", watch: "This live hand-off is the most convincing moment in the whole demo — don't rush it." },
      ],
      wow: "From your website to a named rep's queue in about four seconds, with nobody copying anything.",
    },
    tips: ["Use a different form per channel — that's how you learn which channel actually converts."],
    faqs: [
      { q: "Can I style the form to match my site?", a: "The public page picks up your workspace branding (logo and primary colour). For deeper styling, use the embed snippet inside your own page." },
      { q: "Is there spam protection?", a: "Keep the field set short and route submissions to a review status if you're seeing junk; the source tag makes it easy to filter out." },
    ],
  },
  {
    key: "follow-ups",
    title: "Follow-ups",
    icon: "bell",
    category: "Sales & Leads",
    route: "/follow-ups",
    audience: "Sales team",
    feature: "leads",
    permission: "leads",
    summary: "Dated reminders attached to leads, so nothing is forgotten.",
    what:
      "A list of every scheduled next action against a lead — due today, overdue, or upcoming — with the lead one click away. Follow-ups are created from a lead and closed when the conversation happens.",
    why:
      "Deals aren't usually lost to competitors; they're lost to silence. A shared, dated list of next actions is the cheapest revenue improvement a sales team can make.",
    features: [
      "Filter by due today, overdue, upcoming, or by owner.",
      "Every row links to its lead, with the reason for the follow-up.",
      "Complete a follow-up and schedule the next in the same action.",
      "Overdue rows are flagged, so a manager sees slippage without asking.",
      "Feeds the dashboard's Today panel and the notification bell.",
    ],
    steps: [
      { title: "Create from the lead", detail: "Open a lead → Add follow-up → pick a date and write one line about what you owe them ('send revised quote')." },
      { title: "Start your day here", detail: "Open Follow-ups, filter to Today and Overdue, and work down the list." },
      { title: "Open the lead in context", detail: "Click through to the lead so you have the full history before you dial." },
      { title: "Close the loop", detail: "After the conversation, mark it done, add a note, and immediately create the next follow-up if there is one." },
      { title: "Review as a manager", detail: "Filter by owner to see who is carrying overdue items — it's a coaching conversation, not a punishment." },
    ],
    functional: {
      fields: ["Linked lead", "Due date (and optional time)", "Note / reason", "Owner", "Completed flag and completion time"],
      api: ["Read and written through the leads API and the workspace store", "GET /api/leads for the linked records"],
      storage: ["Workspace database, attached to the lead — the list is database-only, with no browser-side merge"],
      automations: ["Due and overdue follow-ups surface on the dashboard and raise notifications for their owner."],
      permissions: "Module `leads`. Roles without team-wide view see only their own follow-ups.",
      notes: ["A lead can have several open follow-ups; keep it to one 'next action' to avoid noise."],
    },
    demo: {
      goal: "Show the system chasing the rep, rather than the manager chasing everyone.",
      minutes: 3,
      prep: ["Seed two follow-ups due today and one overdue by three days, across two different demo users."],
      beats: [
        { screen: "Follow-ups", say: "Every rep starts the morning on this screen — it's their day, already planned.", do: "Filter to Today." },
        { screen: "Overdue", say: "And nothing hides. Three days late is visible to the rep and to you.", do: "Point at the overdue row in red.", watch: "Sales managers lean in here — ask how they track this today." },
        { screen: "Complete + reschedule", say: "One action closes the loop and books the next one.", do: "Complete a follow-up and create the next." },
      ],
      wow: "The pipeline chases itself — no rep decides what to do next from memory.",
    },
    faqs: [
      { q: "Do follow-ups email me?", a: "They raise in-app notifications and appear on your dashboard. Email and web-push reminders depend on the notification settings your administrator configures." },
    ],
  },
  {
    key: "lead-transfers",
    title: "Lead transfers",
    icon: "refresh",
    category: "Sales & Leads",
    route: "/lead-transfers",
    audience: "Sales team, sales managers",
    feature: "leads",
    permission: "leads",
    summary: "Request, approve and track the reassignment of a lead to another rep.",
    what:
      "A request queue for moving a lead from one owner to another. A rep raises a transfer with a reason; a manager approves or rejects it; the ownership change and the reason are recorded on the lead.",
    why:
      "Silent reassignment is how commission disputes and dropped customers start. Making the move a request with a reason keeps the pipeline honest and gives managers a view of churn inside the team.",
    features: [
      "Raise a transfer from a lead, with a reason and a target owner.",
      "Manager queue with approve / reject and a comment.",
      "Approved transfers change the lead's owner and log the handover.",
      "History of every transfer, so repeated hand-offs on one account are visible.",
    ],
    steps: [
      { title: "Raise the request", detail: "From the lead, or from Lead Transfers → New request. Choose who should take it and say why in one line." },
      { title: "Manager reviews", detail: "Approvers see pending requests with the lead's context. Approve or reject with a comment." },
      { title: "Ownership moves", detail: "On approval, the lead's owner changes and the handover is written to the lead's history." },
      { title: "Brief the new owner", detail: "Add a note to the lead with where the conversation stands — the transfer moves the record, not the context in your head." },
      { title: "Review the history", detail: "Filter transfers by rep or by date to spot accounts that keep changing hands." },
    ],
    functional: {
      fields: ["Lead", "From owner", "To owner", "Reason", "Status (pending / approved / rejected)", "Reviewer + comment", "Timestamps"],
      api: ["Workspace store-backed queue (`nexus_transfer_requests`)", "PUT /api/leads/{id} to apply the owner change"],
      storage: ["Transfer queue in the workspace store; the resulting owner change is written to the `leads` table and the activity log"],
      automations: ["Approval applies the owner change automatically and notifies both reps."],
      permissions: "Module `leads`. Creating a request needs `edit`; approving is for administrators and roles granted `edit` on the team's leads.",
      notes: ["Administrators can also change an owner directly on the lead — the queue is for when you want the approval step."],
    },
    demo: {
      goal: "Show governance without bureaucracy — hand-offs happen, but they're recorded.",
      minutes: 3,
      prep: ["Have one pending transfer request seeded, from a junior rep to a senior one."],
      beats: [
        { screen: "Lead transfers", say: "Leads move between people all the time. Here it's a request, not a quiet edit.", do: "Open the pending request." },
        { screen: "Approve", say: "Approve, and the owner changes and the reason is written to the lead's history for good.", do: "Approve it, then open the lead and show the logged handover.", watch: "Ask how they handle disputes over who owned an account today." },
      ],
      wow: "Every hand-off has a reason and a signature — no more 'that was never my lead'.",
    },
  },
  {
    key: "visitor-tracker",
    title: "Website visitor tracker",
    icon: "eye",
    category: "Sales & Leads",
    route: "/visitor-tracker",
    audience: "Marketing, sales managers",
    feature: "leadVisitor",
    permission: "leads",
    summary: "See sessions on your site — pages, source and duration — and turn them into leads.",
    what:
      "A record of visitor sessions on your website: which pages were seen, where the visitor came from, how long they stayed, and whether they became an enquiry. Interesting sessions can be pushed into the pipeline as leads.",
    why:
      "Most site visitors never fill a form. Knowing that a returning visitor read the pricing page three times gives sales a reason to reach out, and marketing a measure of which channel produces attention rather than clicks.",
    features: [
      "Session list with source/referrer, device, pages viewed and time on site.",
      "Page-level detail per session.",
      "Filter by date, source and engagement.",
      "Promote a session to a lead when it's worth a call.",
    ],
    steps: [
      { title: "Get the tracking in place", detail: "Your administrator installs the tracking snippet on the website (Admin Setup → Integrations). Until then this screen stays empty." },
      { title: "Watch the session list", detail: "Sessions appear with source, device and duration. Sort by time on site to find the engaged visitors." },
      { title: "Open a session", detail: "See the page path in order. Repeated visits to pricing or contact pages are buying signals." },
      { title: "Promote to a lead", detail: "If the session identified itself (via a form or a known contact), create a lead from it so the follow-up is tracked properly." },
      { title: "Report by source", detail: "Filter by source over a month to see which channel brings visitors who actually read something." },
    ],
    functional: {
      fields: ["Session id, first seen / last seen", "Referrer / source, device, browser", "Page path list with timestamps", "Identified contact, when known"],
      api: ["Tracking beacon writes sessions; the screen reads them from the workspace store"],
      storage: ["Workspace store (`nexus_visitor_sessions`)"],
      automations: ["Sessions that submit a form are linked to the lead the form created."],
      permissions: "Module `leads`; plan feature `leadVisitor`.",
      notes: [
        "Anonymous sessions cannot be attributed to a person — that's a limit of web analytics, not of this screen.",
        "Respect local privacy rules: publish a cookie/analytics notice on your site.",
      ],
    },
    demo: {
      goal: "Give marketing a reason to care, and sales a reason to call.",
      minutes: 3,
      prep: ["Seed a handful of sessions including one long, multi-page session that converted to a lead."],
      beats: [
        { screen: "Visitor tracker", say: "Most visitors never fill anything in — but you can still see what they read.", do: "Sort by time on site." },
        { screen: "Session detail", say: "Pricing page, three times, in one week. That's a phone call worth making.", do: "Open the long session and walk the page path.", watch: "Marketing leaders ask about attribution here — mention the source filter." },
      ],
      wow: "Your website stops being a black box and starts producing call lists.",
    },
  },
  {
    key: "lead-visitor",
    title: "Lead visitor (walk-ins)",
    icon: "visitor",
    category: "Sales & Leads",
    route: "/lead-visitor",
    audience: "Front desk, showroom staff",
    feature: "leadVisitor",
    permission: "leads",
    summary: "Log people who walk in, what they wanted, and who attended them.",
    what:
      "A visitor register for physical footfall: who came in, what they were interested in, who dealt with them, and whether it became a lead. It replaces the paper book at reception.",
    why:
      "Showrooms, clinics and offices lose walk-in enquiries entirely — the conversation happens and nothing is recorded. A two-field entry at the desk puts that footfall into the same pipeline as online enquiries.",
    features: [
      "Fast entry form designed for a busy desk: name, phone, purpose, staff attending.",
      "Convert a visit into a lead with one click.",
      "Daily and date-range views of footfall.",
      "Shows which staff member attended, for accountability and for load.",
    ],
    steps: [
      { title: "Log the visit as it happens", detail: "Name, phone and what they came for. Thirty seconds at the desk is the whole ask." },
      { title: "Record who attended", detail: "Pick the staff member. This is what makes footfall reporting per person possible." },
      { title: "Convert if there's intent", detail: "Click Convert to lead. The visitor becomes a normal lead with 'walk-in' as its source." },
      { title: "Close off the visit", detail: "Mark the outcome so the register reflects reality: converted, browsing, or needs follow-up." },
      { title: "Review footfall weekly", detail: "Compare walk-ins to conversions by date and by staff member." },
    ],
    functional: {
      fields: ["Visitor name, phone, purpose", "Attended by (user)", "Visit date/time", "Outcome", "Converted lead reference"],
      api: ["Workspace store for the register", "POST /api/leads on conversion"],
      storage: ["Workspace store; converted visits create rows in `leads` with a walk-in source"],
      automations: ["Conversion carries the visitor's details into the lead so nothing is retyped."],
      permissions: "Module `leads`; plan feature `leadVisitor`. Front-desk roles usually get create + view only.",
    },
    demo: {
      goal: "Show that offline footfall lands in the same pipeline as online enquiries.",
      minutes: 3,
      prep: ["Have today's register showing five visits and two conversions."],
      beats: [
        { screen: "Lead visitor", say: "The paper book at your front desk, with a phone number you can actually call back.", do: "Add a visit live — it takes seconds." },
        { screen: "Convert", say: "And when there's real interest, it becomes a lead with one click, tagged as a walk-in.", do: "Convert the visit and open the new lead.", watch: "Retail and clinic buyers ask about per-branch reporting — note the attended-by field." },
      ],
      wow: "Walk-ins stop evaporating — every person who came through the door is in the pipeline with a source of 'walk-in'.",
    },
  },
  {
    key: "call-tracker",
    title: "Call tracker",
    icon: "call",
    category: "Sales & Leads",
    route: "/call-tracker",
    audience: "Sales team, sales managers",
    feature: "callTracker",
    permission: "operations",
    summary: "Real call records from the mobile app, plus a dashboard of call activity.",
    what:
      "Every call your team makes or receives on the mobile app is logged as a real record — number, direction, duration, outcome and the linked lead. The dashboard turns those records into activity and connect-rate analytics.",
    why:
      "Sales activity is either measured or imagined. Real call rows end the argument about how many calls were made, and connect rates show whether the problem is effort or targeting.",
    features: [
      "Call log with direction (in/out), duration, time and the linked lead.",
      "Dashboard: calls per day, per user, total talk time, connected vs missed.",
      "Calls made from the mobile app are attached to the lead automatically.",
      "Add an outcome and a note straight after the call.",
      "Filter by user and date range for one-to-ones.",
    ],
    steps: [
      { title: "Install the mobile app", detail: "Calls are captured by the app (Mobile App → App Downloads). Web-only users can still log calls manually." },
      { title: "Call from the lead", detail: "Tap the phone icon on a lead in the app; the call is placed and logged against that lead." },
      { title: "Add the outcome", detail: "Right after the call, set the outcome (connected, no answer, callback) and add one line of note." },
      { title: "Read the dashboard", detail: "Call Tracker → Call Dashboard shows volume and talk time by day and by person." },
      { title: "Use it in one-to-ones", detail: "Filter to one rep for last week: volume, connect rate and average duration together tell you what to coach." },
    ],
    functional: {
      fields: ["Phone number, direction, start time, duration", "Linked lead and user", "Outcome, note"],
      api: ["GET/POST /api/calls", "GET /api/calls/analytics"],
      storage: ["`calls` table in the workspace database — real rows, tenant-scoped"],
      automations: ["Calls placed from the mobile app link themselves to the lead and appear in that lead's timeline."],
      permissions: "Module `operations`; plan feature `callTracker`. Roles without team-wide view see only their own calls.",
      notes: [
        "Call capture needs the Android app and the permissions it asks for at install.",
        "Recording audio is not part of this module — it logs metadata, not content.",
      ],
    },
    demo: {
      goal: "Show measurable sales activity without a call-centre system.",
      minutes: 4,
      prep: [
        "Seed a week of calls across three users with a realistic mix of connected and missed.",
        "Have the mobile app installed on your own phone if you intend to place a live call.",
      ],
      beats: [
        { screen: "Call dashboard", say: "This is real activity — pulled from the phones, not typed into a form.", do: "Show calls per day, then switch to per user." },
        { screen: "Call log", say: "Every row links back to the lead, so the call and the deal are the same story.", do: "Open a call row and click through to its lead." },
        { screen: "Live call (optional)", say: "And placing one from the app logs it automatically.", do: "Place a short call from the app to your own second phone.", watch: "Only do this if the network is reliable — a failed live call costs more than it wins." },
      ],
      wow: "Sales effort becomes a number you can coach against, with no call-centre hardware.",
    },
    faqs: [
      { q: "Does it record the conversation?", a: "No. It logs the number, direction, time and duration, plus whatever note the rep adds." },
      { q: "Do calls from a desk phone appear?", a: "Only calls made through the mobile app are captured automatically; others can be logged manually." },
    ],
  },
  {
    key: "tasks",
    title: "Task management",
    icon: "task",
    category: "Sales & Leads",
    route: "/tasks",
    audience: "Everyone",
    feature: "tasks",
    permission: "tasks",
    summary: "Assign work with a due date and a priority, and track it to done.",
    what:
      "A shared task list for anything that isn't a lead follow-up: send a proposal, chase a document, prepare a report. Tasks have an owner, a due date, a priority and a status, and can be linked to a lead or a customer.",
    why:
      "Work assigned in chat disappears. A task with a name and a date on it is the smallest unit of accountability a team can have.",
    features: [
      "Create, assign, prioritise and schedule tasks.",
      "Status flow from open to in-progress to done.",
      "Priorities you define yourself in Admin Setup.",
      "Filter by assignee, status, priority and due date.",
      "Due and overdue tasks appear on the dashboard and in notifications.",
    ],
    steps: [
      { title: "Create a task", detail: "Title, assignee, due date, priority. Write the title as an action — 'Send revised quote to Kumar', not 'Kumar'." },
      { title: "Link it to context", detail: "Attach the related lead or customer so the person doing the work has the history." },
      { title: "Work your list", detail: "Filter to yourself and sort by due date. Move a task to in-progress when you start, done when you finish." },
      { title: "Track the team", detail: "Filter by assignee to see load and slippage before a deadline, not after." },
      { title: "Close properly", detail: "Mark done with a short comment on what happened. That comment is what the next person reads." },
    ],
    functional: {
      fields: ["Title, description", "Assignee, created by", "Due date, priority, status", "Linked lead / record", "Completion time"],
      api: ["GET/POST /api/tasks", "PUT/DELETE /api/tasks/{id}"],
      storage: ["`tasks` table in the workspace database; priorities in the workspace store (`nexus_task_priorities`)"],
      automations: ["Assignment notifies the assignee; due and overdue tasks appear on their dashboard."],
      permissions: "Module `tasks`. view = see tasks; create = assign work; edit = change status/details; delete = remove tasks. Roles without team-wide view see tasks assigned to or created by them.",
    },
    demo: {
      goal: "Show accountability that survives the meeting it was agreed in.",
      minutes: 3,
      prep: ["Seed tasks across three people with two overdue, so the filter has something to show."],
      beats: [
        { screen: "Tasks", say: "Anything agreed in a meeting becomes a row here, with a name and a date.", do: "Create a task live and assign it to someone on the call if they're in the demo workspace." },
        { screen: "By assignee", say: "And a manager can see load and slippage without asking anyone for a status update.", do: "Filter by assignee, then by overdue.", watch: "Ops-heavy buyers care most about this screen — give it time." },
      ],
      wow: "Nothing agreed in a meeting relies on someone remembering it.",
    },
    tips: ["Keep due dates honest. A list where everything is overdue stops being read."],
  },
  {
    key: "reports",
    title: "Reports & analytics",
    icon: "trendUp",
    category: "Sales & Leads",
    route: "/reports",
    audience: "Managers, administrators",
    permission: "leads",
    summary: "Sales, leads and inventory reporting with date ranges and export.",
    what:
      "The reporting area: an overview plus dedicated sales, leads and inventory reports, each with a date range, filters and an export. Financial reporting lives in its own screen under Accounts.",
    why:
      "Dashboards answer 'now'; reports answer 'over what period, compared to what'. Month-end, board packs and channel decisions all need the second kind.",
    features: [
      "Overview with the headline trend lines.",
      "Sales report: conversion, value and win rate over a period.",
      "Leads report: volume by source, status and owner.",
      "Inventory report: stock value and movement.",
      "Date-range picker on every report, with export to Excel/CSV.",
    ],
    steps: [
      { title: "Pick the report", detail: "Reports → Overview, Sales, Leads or Inventory. Financial Report links across to the accounts side." },
      { title: "Set the period", detail: "Choose the date range first — every figure on the page follows it." },
      { title: "Narrow with filters", detail: "By owner, source or status, depending on the report. Compare one rep to the team, or one channel to the rest." },
      { title: "Read the trend, not the number", detail: "A single month's conversion rate means little; the direction over three months means a lot." },
      { title: "Export for the meeting", detail: "Export gives you the same rows in Excel to paste into a deck or share with a board." },
    ],
    functional: {
      fields: ["Aggregations only — no data entry"],
      api: ["GET /api/leads", "GET /api/calls/analytics", "GET /api/inventory", "GET /api/payments"],
      storage: ["Reads `leads`, `calls`, `inventory` and finance records; writes nothing"],
      automations: ["Every figure is computed live at request time — there is no overnight batch to wait for."],
      permissions: "Each report needs view on its source module: `leads` for the leads and sales reports, `financial` for inventory and finance.",
      notes: ["The Follow-ups dashboard tab still shows illustrative analytics; the follow-up list itself is live data."],
    },
    demo: {
      goal: "Answer the 'can I see it by month / by rep / by source' question before it's asked.",
      minutes: 4,
      prep: ["Seed at least two months of leads so a trend line has a shape.", "Know one number in the demo data you can defend if challenged."],
      beats: [
        { screen: "Reports overview", say: "Same data as the dashboard, but over a period you choose.", do: "Set the range to the last two months." },
        { screen: "Leads by source", say: "This is the channel conversation — where the enquiries come from versus where the money comes from.", do: "Open the leads report and sort by source." },
        { screen: "Export", say: "And every report exports, because your board pack lives in Excel.", do: "Export the report." },
      ],
      wow: "Month-end reporting stops being three days of spreadsheet work.",
    },
  },
  // ────────────────────────────── Communication ──────────────────────────────
  {
    key: "gmail",
    title: "Gmail",
    icon: "gmail",
    category: "Communication",
    route: "/gmail",
    audience: "Everyone (plan-gated)",
    feature: "gmail",
    permission: "communication",
    summary: "Read, search and send email from your connected Google account, inside the CRM.",
    what:
      "A mailbox built into the workspace. Once the platform owner connects Google, you can read your inbox, search it, and compose and reply without leaving the CRM — with the lead's history on the same screen.",
    why:
      "Switching to a mail client is where context is lost. Reading a customer's email next to their lead record means the reply is informed, and the conversation stays attached to the deal.",
    features: [
      "Inbox with search, threads and attachments.",
      "Compose, reply and forward with a rich-text editor.",
      "Send from a lead so the mail is written with the record open.",
      "Uses OAuth — your password is never stored anywhere in the product.",
      "Self-heals an expired session by refreshing the token rather than failing the send.",
    ],
    steps: [
      { title: "Check the connection", detail: "Gmail must be connected by your administrator or the platform owner (Admin Setup → Integrations). Until then the screen explains what's missing." },
      { title: "Read and search", detail: "The inbox lists threads newest first. Search reaches the whole mailbox, not just what's loaded." },
      { title: "Compose", detail: "New mail → recipients, subject, body. Formatting, links and attachments are supported." },
      { title: "Reply in context", detail: "Open a thread and reply inline; the quoted history goes with it." },
      { title: "Mail a lead directly", detail: "From a lead, use the email action — the address is filled in and the record stays visible while you write." },
    ],
    functional: {
      fields: ["To / cc / bcc, subject, body, attachments"],
      api: ["/api/gmail/* — OAuth-backed relay", "GET /api/gmail/diagnose for connection troubleshooting"],
      storage: ["Messages stay in Google; OAuth tokens are stored server-side in the `settings` table, never in the browser"],
      automations: ["An expired access token is refreshed automatically — a 401 mid-send is retried rather than surfaced."],
      permissions: "Module `communication`; plan feature `gmail`.",
      notes: [
        "The connected account is the mailbox you see; this is not a shared team inbox.",
        "If Google was connected before calendar scopes were added, reconnect once to grant them.",
      ],
    },
    demo: {
      goal: "Show email living next to the deal, not in another tab.",
      minutes: 3,
      prep: ["Connect a demo Google account beforehand and confirm the inbox loads.", "Have a lead whose email address matches a real thread in that mailbox."],
      beats: [
        { screen: "Gmail", say: "Your actual inbox — no forwarding rules, no separate login.", do: "Open a thread with an attachment." },
        { screen: "From the lead", say: "And when you write to a customer, their whole history is on the same screen.", do: "Open the lead and use its email action.", watch: "If the buyer uses Outlook, pivot to SMTP — mention it's configurable." },
      ],
      wow: "Nobody alt-tabs to email in the middle of a deal.",
    },
    faqs: [
      { q: "Can I use Outlook or another provider?", a: "Sending can run over plain SMTP, which any provider supports; the built-in mailbox view is Gmail-specific." },
    ],
  },
  {
    key: "chat",
    title: "Team chat",
    icon: "chat",
    category: "Communication",
    route: "/chat",
    audience: "Everyone",
    feature: "chat",
    permission: "communication",
    summary: "Real one-to-one messaging between people in your workspace.",
    what:
      "Direct messaging between workspace users, stored in your own database. The roster is your team directory; messages are delivered by polling, so a conversation stays in sync across devices.",
    why:
      "Work chat about customers shouldn't live on personal WhatsApp. Keeping it inside the workspace means it belongs to the company, is scoped to the tenant, and disappears when someone leaves.",
    features: [
      "One-to-one conversations with anyone in the workspace.",
      "Unread counts and a conversation list ordered by recency.",
      "Messages persist in your workspace database, not in the browser.",
      "A chat widget available from anywhere in the app.",
      "The roster comes from the real team list, so new joiners appear automatically.",
    ],
    steps: [
      { title: "Open Chat", detail: "From the sidebar, or the chat bubble in the corner of any screen." },
      { title: "Pick a colleague", detail: "The roster lists everyone in the workspace except the platform owner." },
      { title: "Send a message", detail: "Type and press Enter. Messages appear on the other person's screen within seconds." },
      { title: "Keep customer talk linked", detail: "Paste the lead's name or reference so the conversation can be traced back to a record." },
      { title: "Check unreads", detail: "The conversation list badges anything unread; the widget shows a count from any page." },
    ],
    functional: {
      fields: ["Sender, recipient, body, sent timestamp, read state"],
      api: ["GET /api/chat/overview", "GET /api/chat/messages", "POST /api/chat/messages", "GET /api/team for the roster"],
      storage: ["`chat_messages` table, tenant-scoped"],
      automations: ["The open conversation polls for new messages; unread counts update without a reload."],
      permissions: "Module `communication`; plan feature `chat`. Everyone in the workspace can message everyone else.",
      notes: ["Group chats, file sharing in chat and websocket push are not built yet — this is 1:1 text messaging."],
    },
    demo: {
      goal: "Show internal comms staying inside the system of record.",
      minutes: 2,
      prep: ["Sign a second demo user in on a phone or second browser so a live message can land on screen."],
      beats: [
        { screen: "Chat", say: "Internal conversation stays with the company, not on someone's personal WhatsApp.", do: "Send a message and let it appear in the second window.", watch: "Buyers with staff turnover react to the 'it stays with the company' line." },
      ],
      wow: "When someone leaves, the customer conversation stays with you.",
    },
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    icon: "whatsapp",
    category: "Communication",
    route: "/whatsapp",
    audience: "Sales team (plan-gated)",
    feature: "whatsapp",
    permission: "communication",
    summary: "Message leads on WhatsApp and keep the conversation attached to the record.",
    what:
      "A WhatsApp workspace for talking to leads and customers: conversation list, message thread and quick replies, wired to a WhatsApp bridge service so the chat is visible to the team rather than trapped on one phone.",
    why:
      "In most markets customers reply on WhatsApp and nowhere else. If that conversation only exists on a rep's phone, the company doesn't own its own customer relationship.",
    features: [
      "Conversation list of leads you're talking to.",
      "Send and receive messages against the lead record.",
      "Message from a lead in one click, with the number pre-filled.",
      "Templates for the messages you send constantly.",
      "Feeds WhatsApp marketing campaigns for bulk sends.",
    ],
    steps: [
      { title: "Connect the bridge", detail: "Your administrator connects the WhatsApp service (see the whatsapp-service component). Until it's connected, the screen tells you so." },
      { title: "Open a conversation", detail: "Pick a lead from the conversation list, or start one from the lead's WhatsApp action." },
      { title: "Reply from the workspace", detail: "Type in the thread. Everything sent from here is visible to anyone who can see the lead." },
      { title: "Use templates", detail: "Save your repeated messages as templates so replies are consistent and fast." },
      { title: "Log the outcome", detail: "After the exchange, update the lead's status — the chat is context, the status is the decision." },
    ],
    functional: {
      fields: ["Contact number, message body, direction, timestamps", "Linked lead", "Template name and content"],
      api: ["Bridge service endpoints (whatsapp-service) + workspace store for threads"],
      storage: ["Workspace store, linked to the lead record"],
      automations: ["Incoming messages attach themselves to a matching lead by phone number."],
      permissions: "Module `communication`; plan feature `whatsapp`.",
      notes: [
        "Bulk sending is subject to WhatsApp's own policies — sending unsolicited marketing can get a number blocked.",
        "The bridge needs to stay running for messages to flow.",
      ],
    },
    demo: {
      goal: "Show the channel customers actually use, inside the CRM.",
      minutes: 3,
      prep: ["Confirm the bridge is connected and a test conversation exists.", "Have your own phone ready to send a message in as the 'customer'."],
      beats: [
        { screen: "WhatsApp", say: "This is where your customers actually reply.", do: "Open a thread against a lead." },
        { screen: "Live inbound", say: "And it lands against the lead, visible to the whole team — not on one rep's phone.", do: "Send a message from your phone and let it appear.", watch: "The room usually goes quiet here; wait for the question about numbers and approvals." },
      ],
      wow: "The customer's WhatsApp conversation belongs to your business, not to whoever's phone it started on.",
    },
  },
  {
    key: "media",
    title: "Media library",
    icon: "media",
    category: "Communication",
    route: "/media",
    audience: "Everyone",
    feature: "media",
    permission: "communication",
    summary: "Shared files and images, organised in folders.",
    what:
      "A shared file store for the workspace: brochures, price lists, images and documents, organised in nested folders and available to everyone who needs them.",
    why:
      "Reps attach whatever version of the brochure is on their laptop. One folder that everyone reads from means the customer gets the current price list.",
    features: [
      "Nested folders with rename and move.",
      "Multi-file upload with previews for images.",
      "Files are served from the workspace, with a link you can share internally.",
      "Delete removes the record and the underlying file.",
    ],
    steps: [
      { title: "Create a folder structure", detail: "Keep it shallow: Brochures, Price lists, Logos, Contracts. Deep trees don't get used." },
      { title: "Upload", detail: "Drag files in, or use Upload and pick several at once." },
      { title: "Find and reuse", detail: "Open a folder and copy the file's link to send it, or attach it from Gmail." },
      { title: "Keep it current", detail: "Replace outdated documents rather than adding v2, v3, v4 alongside them." },
    ],
    functional: {
      fields: ["File name, folder, mime type, size, stored path"],
      api: ["GET/POST/PUT/DELETE /api/media/files", "GET/POST/PUT/DELETE /api/media/folders"],
      storage: ["`media_files` and `media_folders` tables; the file itself under public/uploads/media"],
      automations: ["Deleting a file removes the record and unlinks the file from disk."],
      permissions: "Module `communication`; plan feature `media`.",
      notes: ["Upload size is limited by the server's PHP configuration — very large videos may need the limit raised."],
    },
    demo: {
      goal: "Cover the 'where do we keep our brochures' question in under two minutes.",
      minutes: 2,
      prep: ["Seed folders with a brochure PDF and a couple of product images."],
      beats: [
        { screen: "Media", say: "One shared shelf, so nobody sends last year's price list.", do: "Open a folder and preview an image, then upload a file live." },
      ],
      wow: "Every rep sends the same, current document.",
    },
  },
  {
    key: "announcement",
    title: "Announcements",
    icon: "announcement",
    category: "Communication",
    route: "/announcement",
    audience: "Administrators, HR",
    feature: "announcement",
    permission: "communication",
    summary: "Broadcast a notice to the whole workspace, by category.",
    what:
      "Company-wide notices — a policy change, an office closure, a new product — categorised and published to everyone in the workspace, where they're seen in the app rather than lost in email.",
    why:
      "Important internal news sent by email is read by half the team. A notice inside the tool people work in all day actually reaches them.",
    features: [
      "Rich-text announcements with a title and body.",
      "Categories you define, so notices can be filtered.",
      "Visible to everyone in the workspace, with the newest first.",
      "Pairs with HR Posts for the people-side equivalent.",
    ],
    steps: [
      { title: "Write it", detail: "New announcement → title, category, body. Put the decision in the first line; detail underneath." },
      { title: "Categorise", detail: "Pick or create a category (Policy, Product, Office). Categories are what make old notices findable." },
      { title: "Publish", detail: "Save and it appears for the whole workspace immediately." },
      { title: "Retire old notices", detail: "Delete or archive announcements that no longer apply so the list stays trustworthy." },
    ],
    functional: {
      fields: ["Title, body (rich text), category, author, published date"],
      api: ["Workspace store-backed"],
      storage: ["Workspace store (`nexus_announcement_categories` for the category list)"],
      permissions: "Module `communication`; plan feature `announcement`. Creating usually sits with administrators and HR; everyone can view.",
    },
    demo: {
      goal: "Show internal comms that don't rely on email being read.",
      minutes: 2,
      prep: ["Have two announcements published in different categories."],
      beats: [
        { screen: "Announcements", say: "Company news lands where people already are, all day.", do: "Publish one live and show it appear." },
      ],
      wow: "Policy changes reach everyone the same day, without an email chain.",
    },
  },
  // ──────────────────────────────── Marketing ────────────────────────────────
  {
    key: "marketing",
    title: "Marketing campaigns",
    icon: "announcement",
    category: "Marketing",
    route: "/marketing",
    audience: "Marketing team (plan-gated)",
    feature: "marketing",
    permission: "marketing",
    summary: "WhatsApp, email and SMS campaigns to audiences you build from your own data.",
    what:
      "The campaign area: build an audience from your CRM data, write (or reuse) a template, and send it over WhatsApp, email or SMS. The overview reports what was sent and how it landed.",
    why:
      "Marketing that can't reach the CRM's own segments ends up as an exported spreadsheet pasted into a third-party tool — and the results never come back. Campaigns built on live segments keep the loop closed.",
    features: [
      "Overview with campaign performance at a glance.",
      "Three channels: WhatsApp, Email and SMS, each with its own screen.",
      "Reusable templates with placeholders for names and fields.",
      "Audiences built from CRM filters — status, source, owner, tag.",
      "Send now, and review results afterwards.",
    ],
    steps: [
      { title: "Build the audience", detail: "Marketing → Audiences → new audience, then filter your leads down to who should receive this. Name it for what it is ('Quoted, no reply, 30 days')." },
      { title: "Write the template", detail: "Marketing → Templates. Use placeholders for the name so a bulk message still reads personally." },
      { title: "Pick a channel", detail: "WhatsApp for reach, Email for detail, SMS for urgency. Each has its own screen with the same shape." },
      { title: "Send", detail: "Choose the audience and template, review the count, and send. Check the first few messages landed before assuming the rest did." },
      { title: "Read the results", detail: "The overview reports what went out. Match it against new leads and replies in the pipeline to judge whether it worked." },
    ],
    functional: {
      fields: ["Campaign name, channel, template, audience, schedule", "Template body with placeholders", "Audience filter definition"],
      api: ["Workspace store for campaigns, templates and audiences", "WhatsApp bridge / SMTP / SMS provider for delivery"],
      storage: ["Workspace store; recipients are resolved live from `leads` at send time"],
      automations: ["Audiences are dynamic — a lead that newly matches the filter is included the next time you send."],
      permissions: "Module `marketing`; plan feature `marketing`.",
      notes: [
        "Delivery depends on the channel being configured: the WhatsApp bridge, SMTP/Gmail for email, an SMS provider for SMS.",
        "Respect consent rules in your market — bulk messaging without opt-in risks your sending number or domain.",
      ],
    },
    demo: {
      goal: "Show marketing running on live CRM segments, not on an exported spreadsheet.",
      minutes: 5,
      prep: [
        "Build one audience with an obviously commercial definition ('Quoted, no reply in 30 days') before the call.",
        "Have a template written with a name placeholder.",
        "Decide whether you will actually send — a send to your own two test numbers is far more convincing than a preview.",
      ],
      beats: [
        { screen: "Audiences", say: "Your segments come from the CRM itself, so they're never stale.", do: "Open the seeded audience and show its filter and count." },
        { screen: "Templates", say: "Write it once, personalised by field.", do: "Open the template and point at the placeholder." },
        { screen: "WhatsApp campaign", say: "And it goes out on the channel your customers actually read.", do: "Select the audience and template, then send to the test recipients.", watch: "Have the receiving phone visible on the call if you can." },
        { screen: "Overview", say: "Then the results come back to the same place the audience came from.", do: "Show the campaign overview." },
      ],
      wow: "Your segments, your templates, three channels — and the results land back in the same pipeline the audience came from.",
    },
  },
  // ──────────────────────────────── Operations ───────────────────────────────
  {
    key: "calendar",
    title: "Calendar",
    icon: "calendar",
    category: "Operations",
    route: "/calendar",
    audience: "Everyone",
    feature: "calendar",
    permission: "operations",
    summary: "Meetings, site visits and reminders in month, week and day views.",
    what:
      "A shared calendar for the workspace: meetings, demos, site visits and internal events, with month, week and day views and events linked to leads where relevant.",
    why:
      "Sales runs on appointments. Keeping them beside the pipeline means a manager can see the week's commitments without asking, and an event can carry the customer's history with it.",
    features: [
      "Month, week and day views.",
      "Create an event with title, time, attendees and notes.",
      "Link an event to a lead so the record shows the meeting.",
      "Colour by type so the week reads at a glance.",
      "Feeds the dashboard's today panel.",
    ],
    steps: [
      { title: "Pick your view", detail: "Month for planning, week for working, day when you're busy." },
      { title: "Create an event", detail: "Click a slot, then set title, time and attendees. Add the address for site visits — it's what the person actually needs on the day." },
      { title: "Link the customer", detail: "Attach the lead so anyone opening the record sees the meeting, and anyone opening the meeting can read the history." },
      { title: "Keep it honest", detail: "Move or cancel events when plans change; a calendar nobody trusts is worse than none." },
    ],
    functional: {
      fields: ["Title, description, start / end, all-day flag", "Attendees, location", "Linked lead", "Event type / colour"],
      api: ["Workspace store-backed (`nexus_calendar_events`)"],
      storage: ["Workspace store, tenant-scoped"],
      automations: ["Today's events appear on the dashboard."],
      permissions: "Module `operations`; plan feature `calendar`.",
      notes: ["Google Calendar two-way sync exists for the platform owner's demo calendar (Super Admin → Demos), not for each client workspace."],
    },
    demo: {
      goal: "Show appointments living next to the pipeline.",
      minutes: 2,
      prep: ["Seed a week that looks like a real sales week — a few meetings, one site visit, one internal review."],
      beats: [
        { screen: "Calendar week view", say: "Your team's week, next to the deals it belongs to.", do: "Create an event and link it to a lead, then open the lead to show it there." },
      ],
      wow: "The meeting and the deal are the same record — nobody cross-checks two calendars.",
    },
  },
  {
    key: "downloads",
    title: "Mobile app & downloads",
    icon: "download",
    category: "Operations",
    route: "/downloads",
    audience: "Everyone (plan-gated)",
    feature: "mobileApp",
    permission: "operations",
    summary: "Get the Android app, which adds call capture, location and push.",
    what:
      "The download page for the companion mobile app, plus install instructions. The app adds what a browser can't do: automatic call logging, background location for field staff, and native push notifications.",
    why:
      "Field sales don't work at a desk. The app is what turns the CRM from an office system into something a rep uses in a customer's car park.",
    features: [
      "Direct APK download with install steps.",
      "Adds automatic call capture that feeds Call Tracker.",
      "Adds live location for field staff (with consent and admin control).",
      "Native push notifications for follow-ups and assignments.",
      "The web app is also installable as a PWA on desktop.",
    ],
    steps: [
      { title: "Open Mobile App → App Downloads", detail: "Get the current build and the QR code for phones." },
      { title: "Install on Android", detail: "Allow installation from your browser when prompted, then open the app and sign in with the same credentials." },
      { title: "Grant permissions", detail: "Call log and location permissions are what enable the extra features. Decline them and the app still works as a mobile CRM." },
      { title: "Confirm capture works", detail: "Place one call from the app and check it appears in Call Tracker." },
      { title: "Install the PWA on desktop (optional)", detail: "In Chrome or Edge, use Install app from the address bar for a windowed version." },
    ],
    functional: {
      fields: ["No data entry — this is a distribution page"],
      api: ["Native bridge for calls, location and push; POST /api/calls and the push endpoints"],
      storage: ["Nothing stored here; the app writes into the same workspace database as the web app"],
      automations: ["The app registers for push on sign-in so notifications reach the device."],
      permissions: "Plan feature `mobileApp`; module `operations`.",
      notes: [
        "Android only for the native build today; iOS users run the web app / PWA.",
        "The APK is side-loaded, so Android shows the usual unknown-source warning.",
      ],
    },
    demo: {
      goal: "Make the field-sales story concrete.",
      minutes: 3,
      prep: ["Have the app already installed on your own phone and signed in.", "Mirror your phone screen if the call allows it."],
      beats: [
        { screen: "Downloads", say: "Your reps install it in a minute from here.", do: "Show the QR code." },
        { screen: "Phone", say: "Same data, same permissions — plus call logging and location that a browser simply can't do.", do: "Open a lead on the phone and place a call from it.", watch: "If screen-mirroring is unreliable, describe it instead of gambling on the connection." },
      ],
      wow: "Your field team works from the car park, and their calls log themselves.",
    },
  },
  {
    key: "live-tracking",
    title: "Live tracking",
    icon: "pin",
    category: "Operations",
    route: "/live-tracking",
    audience: "Managers of field teams",
    feature: "mobileApp",
    permission: "operations",
    summary: "See where field staff are, on a map, while they're on duty.",
    what:
      "A map of field staff who have the mobile app installed and location sharing enabled, with recent positions and route history for the working day.",
    why:
      "Dispatching the nearest person, confirming a site visit happened, and answering 'where is my engineer' are daily questions for any field operation.",
    features: [
      "Live map of on-duty staff.",
      "Recent position history per person for the day.",
      "Works with the mobile app's background location.",
      "Admin control over who is tracked and when.",
    ],
    steps: [
      { title: "Set expectations first", detail: "Tell staff what is tracked and when. Tracking people who don't know is both a trust problem and, in many places, a legal one." },
      { title: "Enable on the device", detail: "The user grants location permission in the mobile app and turns sharing on for their shift." },
      { title: "Open the map", detail: "Live Tracking shows the on-duty team. Click a person for their recent positions." },
      { title: "Use it to dispatch", detail: "When a job comes in, assign it to the nearest available person rather than the next name on a list." },
    ],
    functional: {
      fields: ["User, latitude / longitude, accuracy, timestamp, battery state"],
      api: ["Mobile bridge posts positions; the map reads them back"],
      storage: ["Workspace database, tenant-scoped"],
      automations: ["Positions are posted while sharing is on and the app is running."],
      permissions: "Module `operations`; plan feature `mobileApp`. Managers see the team; staff see themselves.",
      notes: [
        "Tracking stops when the user disables sharing or the app is force-closed — treat gaps as normal.",
        "Follow local privacy law: consent, working-hours-only tracking, and a written policy.",
      ],
    },
    demo: {
      goal: "Answer 'where is my team' for field-service buyers, honestly.",
      minutes: 3,
      prep: ["Have at least one device reporting, or seed a day of positions.", "Prepare your consent answer before it's asked — it always is."],
      beats: [
        { screen: "Live tracking", say: "For field teams, dispatch stops being guesswork.", do: "Open the map and click a person to show the day's route." },
        { screen: "Consent", say: "Staff turn it on for their shift, and they know it's on. That's deliberate.", do: "Say this out loud even if they don't ask.", watch: "Handled proactively, this becomes a trust point rather than an objection." },
      ],
      wow: "Dispatch the nearest engineer instead of the next name on a list.",
    },
  },
  {
    key: "app-security",
    title: "App security",
    icon: "shield",
    category: "Operations",
    route: "/app-security",
    audience: "Administrators",
    feature: "mobileApp",
    permission: "operations",
    summary: "Device and session controls for the mobile app.",
    what:
      "Security settings for the mobile side of the workspace: which devices are allowed, session behaviour, and the controls an administrator uses when a phone is lost or a person leaves.",
    why:
      "A CRM in someone's pocket is a data risk the moment that pocket changes owner. Being able to cut a device off in seconds is the difference between an incident and a non-event.",
    features: [
      "Device and session visibility for app users.",
      "Deactivate an account and every session with it drops within seconds.",
      "Works with the 15-second auth check that guards the web app too.",
      "Pairs with per-user 2FA for sign-in security.",
    ],
    steps: [
      { title: "Review the settings", detail: "Open App Security and read the current policy before changing anything." },
      { title: "Handle a lost phone", detail: "Deactivate the user in Users. Their sessions end within seconds on every device, including the app." },
      { title: "Reset access", detail: "Once the person has a new device, reactivate the account and reset 2FA so they can enrol the new phone." },
      { title: "Review periodically", detail: "Check the active user list monthly against who actually still works there." },
    ],
    functional: {
      fields: ["Device / session state, active flag per user"],
      api: ["POST /api/users/{id}/deactivate", "POST /api/users/{id}/activate", "POST /api/users/{id}/reset-2fa", "GET /api/auth/me (the 15s liveness check)"],
      storage: ["`users` table — the active flag is the master switch"],
      automations: ["Every signed-in client re-checks its account every 15 seconds, so a deactivation logs the person out almost immediately."],
      permissions: "Module `operations`, administrators in practice.",
    },
    demo: {
      goal: "Answer the offboarding question with a live demonstration.",
      minutes: 2,
      prep: ["Have a second demo user signed in on another device or browser window, visible on screen."],
      beats: [
        { screen: "Users → deactivate", say: "Someone leaves, or loses a phone. Watch the other screen.", do: "Deactivate the second user and wait a few seconds.", watch: "The second window bounces to the login screen — that's the whole demo." },
      ],
      wow: "Offboarding is one click, and it takes effect on every device in seconds.",
    },
  },
  {
    key: "support-ticket",
    title: "Support tickets",
    icon: "ticket",
    category: "Operations",
    route: "/support-ticket",
    audience: "Support team, administrators",
    feature: "support",
    permission: "operations",
    summary: "Log customer issues with a category, priority and owner, and track them to closed.",
    what:
      "A helpdesk queue: issues raised by or on behalf of customers, categorised and prioritised, assigned to an owner, and worked through a status flow with a comment history.",
    why:
      "Support requests arriving by phone and WhatsApp get forgotten. A queue with priorities means the urgent ones are worked first and nothing sits unanswered for a week.",
    features: [
      "Ticket list with filters by status, priority, category and owner.",
      "Categories and priorities you define in Admin Setup.",
      "Comment thread per ticket, so the history is on the ticket.",
      "Link tickets to the customer's lead record.",
      "Aging view so old tickets can't hide.",
    ],
    steps: [
      { title: "Raise the ticket", detail: "New ticket → customer, subject, category, priority. Write the subject as the customer's problem, not your guess at the cause." },
      { title: "Assign an owner", detail: "Unassigned tickets are nobody's job. Assign at creation, reassign later if needed." },
      { title: "Work it in comments", detail: "Every update goes on the ticket, not in a private chat. That's what makes handover possible." },
      { title: "Move the status", detail: "Open → in progress → resolved → closed. Resolve when it's fixed; close when the customer agrees." },
      { title: "Review the queue daily", detail: "Sort by priority and age. Anything old and high priority is the day's first conversation." },
    ],
    functional: {
      fields: ["Customer / lead, subject, description", "Category, priority, status, owner", "Comment thread, created / resolved timestamps"],
      api: ["Workspace store-backed (`nexus_tickets`)", "Categories and priorities via /api/config/ticket-category and ticket-priority"],
      storage: ["Workspace store, tenant-scoped"],
      automations: ["Assignment notifies the owner; the aging view highlights tickets past their expected turnaround."],
      permissions: "Module `operations`; plan feature `support`.",
    },
    demo: {
      goal: "Show after-sales handled in the same place as before-sales.",
      minutes: 3,
      prep: ["Seed an aged, high-priority ticket and two ordinary ones.", "Have ticket categories renamed to the prospect's language."],
      beats: [
        { screen: "Tickets", say: "Support requests stop living in someone's WhatsApp.", do: "Filter to high priority and open the aged ticket." },
        { screen: "Ticket detail", say: "The whole history is on the ticket, so anyone can pick it up.", do: "Add a comment and move the status.", watch: "Ask what happens today when the person who took the call is on leave." },
      ],
      wow: "The customer's problem is a tracked record, not a promise someone made on the phone.",
    },
  },
  // ───────────────────────────── Finance & Billing ────────────────────────────
  {
    key: "account-dashboard",
    title: "Accounts dashboard",
    icon: "revenue",
    category: "Finance & Billing",
    route: "/account-dashboard",
    audience: "Finance, business owners",
    feature: "accounts",
    permission: "financial",
    summary: "Money in, money out and what's outstanding, on one screen.",
    what:
      "The finance home screen: invoiced value, payments received, outstanding receivables, expenses and bills, summarised with trends and links into each underlying module.",
    why:
      "Owners ask three questions — what did we bill, what got paid, what's still owed. Having them on one screen removes the weekly call to the accountant.",
    features: [
      "Tiles for invoiced, received, outstanding and overdue.",
      "Expense and bill totals for the period.",
      "Trend view across months.",
      "Click any tile through to the underlying list.",
    ],
    steps: [
      { title: "Start with outstanding", detail: "It's the number that pays your salaries. Click it to see exactly which invoices make it up." },
      { title: "Compare invoiced to received", detail: "A widening gap means collections, not sales, is the problem to fix this month." },
      { title: "Check expenses and bills", detail: "Both feed the same picture — money committed versus money out." },
      { title: "Drill in, don't retype", detail: "Every tile links to its list; nothing here needs to be copied into a spreadsheet." },
    ],
    functional: {
      fields: ["Aggregations only"],
      api: ["Reads the invoice, payment, quotation, expense and bill records"],
      storage: ["Workspace store keys `nexus_invoices`, `nexus_payments`, `nexus_quotations`, plus expense and bill records"],
      permissions: "Module `financial`; plan feature `accounts`.",
      notes: ["Figures follow the currency configured for the workspace."],
    },
    demo: {
      goal: "Show the owner their own three questions answered without an accountant.",
      minutes: 3,
      prep: ["Seed invoices with a realistic mix: some paid, some part-paid, two overdue."],
      beats: [
        { screen: "Accounts dashboard", say: "Billed, collected, outstanding — live, not last month's report.", do: "Point at outstanding, then click through to the invoices behind it.", watch: "Owner-operators engage hardest here; slow down." },
      ],
      wow: "You know what you're owed at any moment, without asking anyone.",
    },
  },
  {
    key: "invoices",
    title: "Invoices",
    icon: "fileText",
    category: "Finance & Billing",
    route: "/invoices",
    audience: "Finance, sales",
    feature: "accounts",
    permission: "financial",
    summary: "Raise invoices with line items and tax, send them, and track what's paid.",
    what:
      "Invoice creation and tracking: pick the customer, add line items with quantity, rate and tax, and issue the invoice. Payments recorded against it move it from unpaid to part-paid to paid.",
    why:
      "Invoicing outside the CRM means the sale and the money live in different systems, and chasing payment becomes a manual reconciliation exercise every month.",
    features: [
      "Line-item editor with quantity, rate, discount and tax.",
      "Automatic totals, tax and balance due.",
      "Statuses: draft, sent, part-paid, paid, overdue.",
      "Convert an accepted quotation into an invoice without retyping.",
      "Printable / PDF layout carrying your branding.",
      "Payments recorded against the invoice update the balance.",
    ],
    steps: [
      { title: "Create the invoice", detail: "New invoice → customer, date, due date. Due date is what drives the overdue flag, so set it deliberately." },
      { title: "Add line items", detail: "Description, quantity, rate, tax per line. Totals and tax calculate as you type." },
      { title: "Issue it", detail: "Save and send. The layout carries your logo and details from Branding." },
      { title: "Record payments", detail: "As money arrives, add a payment against the invoice — partial payments are supported and the balance updates." },
      { title: "Chase what's overdue", detail: "Filter to overdue and work the list. Each row links to the customer so you have context before you call." },
    ],
    functional: {
      fields: ["Customer, invoice number, issue date, due date", "Line items (description, qty, rate, discount, tax)", "Subtotal, tax total, grand total, amount paid, balance", "Status, notes / terms"],
      api: ["Workspace store-backed finance records", "GET /api/payments for recorded receipts"],
      storage: ["Workspace store (`nexus_invoices`), with payments in `nexus_payments`"],
      automations: ["Balance and status recalculate whenever a payment is recorded; invoices past their due date are flagged overdue."],
      permissions: "Module `financial`; plan feature `accounts`. create = raise invoices; edit = amend and record payments; delete = void.",
      notes: ["Numbering is sequential per workspace — don't edit numbers by hand once issued.", "Subscription billing for the platform itself is separate (see Subscription)."],
    },
    demo: {
      goal: "Close the loop from deal to cash inside one system.",
      minutes: 5,
      prep: ["Have an accepted quotation ready to convert.", "Set the demo workspace's logo and address so the printed invoice looks like theirs."],
      beats: [
        { screen: "Quotation → invoice", say: "The deal you just won becomes the invoice — nobody retypes the line items.", do: "Convert the accepted quotation." },
        { screen: "Line items", say: "Quantities, tax, discount — totals as you type.", do: "Edit a quantity and let the totals move." },
        { screen: "Print view", say: "And it goes out with your logo, not ours.", do: "Open the print/PDF view.", watch: "Branded output is what makes finance buyers believe the rest." },
        { screen: "Record payment", say: "Money in, balance down, status changes itself.", do: "Record a partial payment." },
      ],
      wow: "Quote, invoice, payment, outstanding — one system, one customer record, no re-keying.",
    },
  },
  {
    key: "payments",
    title: "Payments received",
    icon: "payment",
    category: "Finance & Billing",
    route: "/payments",
    audience: "Finance",
    feature: "accounts",
    permission: "financial",
    summary: "Record receipts against invoices and see the collection history.",
    what:
      "The record of money received: amount, date, method and the invoice it settles. It is what makes the outstanding figure trustworthy.",
    why:
      "An invoice list without payments is a wish list. Recording receipts here is what turns the accounts dashboard into something you can act on.",
    features: [
      "Record full or partial payments against an invoice.",
      "Payment method and reference for reconciliation.",
      "Automatic update of the invoice balance and status.",
      "Filter by date, customer and method.",
    ],
    steps: [
      { title: "Record from the invoice", detail: "Open the invoice → Record payment. That way the receipt is linked, not floating." },
      { title: "Enter the detail", detail: "Amount, date received, method, and the bank reference or UTR. The reference is what makes reconciliation possible later." },
      { title: "Handle part payments", detail: "Enter what actually arrived. The invoice moves to part-paid and keeps the balance." },
      { title: "Reconcile monthly", detail: "Filter payments by date and compare the total against the bank statement." },
    ],
    functional: {
      fields: ["Invoice reference, customer", "Amount, date, method, reference", "Recorded by"],
      api: ["Workspace store finance records", "GET /api/payments"],
      storage: ["Workspace store (`nexus_payments`)"],
      automations: ["Recording a payment recalculates the invoice's balance and status immediately."],
      permissions: "Module `financial`, `create` to record receipts.",
      notes: ["This is customer receipts. Your own subscription payments to the platform are tracked separately under Subscription."],
    },
    demo: {
      goal: "Show collections closing the loop.",
      minutes: 2,
      prep: ["Have one part-paid invoice already, so both states are visible."],
      beats: [
        { screen: "Payments", say: "Every receipt is against an invoice, with a reference your accountant can match.", do: "Record a payment and show the invoice status change." },
      ],
      wow: "Outstanding is a real number, because every receipt is attached to an invoice.",
    },
  },
  {
    key: "quotations",
    title: "Quotations",
    icon: "quotation",
    category: "Finance & Billing",
    route: "/quotations",
    audience: "Sales, finance",
    feature: "accounts",
    permission: "financial",
    summary: "Send priced proposals, track acceptance, and convert them into invoices.",
    what:
      "Quotations with the same line-item editor as invoices, a validity date, and a status flow from draft to sent to accepted or lost. Accepted quotes convert into invoices in one step.",
    why:
      "Quotes are where deals are actually won and lost. Tracking them as records — rather than as attachments in someone's sent folder — tells you your win rate and your average discount.",
    features: [
      "Line items with quantity, rate, discount and tax.",
      "Validity date and terms.",
      "Status flow: draft → sent → accepted / rejected / expired.",
      "One-click conversion to an invoice.",
      "Branded print / PDF output.",
      "Linked to the lead, so the pipeline shows what was quoted.",
    ],
    steps: [
      { title: "Create from the lead", detail: "Quoting from the lead keeps the deal and the number together." },
      { title: "Build the pricing", detail: "Add line items; set discount per line where you negotiate per line." },
      { title: "Set validity", detail: "A quote without an expiry is negotiated forever. Two weeks is a reasonable default." },
      { title: "Send and mark sent", detail: "Send the PDF, then set the status so the pipeline reflects reality." },
      { title: "Record the outcome", detail: "Accepted or lost — both matter. Lost quotes with a reason are the most useful data in the system." },
      { title: "Convert on acceptance", detail: "Accepted → Convert to invoice. Line items, customer and totals carry across." },
    ],
    functional: {
      fields: ["Customer / lead, quote number, date, valid until", "Line items, discounts, tax, totals", "Status, terms, notes"],
      api: ["Workspace store finance records"],
      storage: ["Workspace store (`nexus_quotations`)"],
      automations: ["Conversion copies line items and customer into a new invoice; the quote is marked accepted."],
      permissions: "Module `financial`; plan feature `accounts`.",
    },
    demo: {
      goal: "Show the quote-to-cash path starting inside the pipeline.",
      minutes: 4,
      prep: ["Have a lead ready to quote from, and the branding set up so the PDF looks like the client's."],
      beats: [
        { screen: "Lead → new quotation", say: "The quote starts from the deal, so it's never orphaned.", do: "Create a quote from the lead with two line items." },
        { screen: "Print view", say: "Out it goes, branded.", do: "Open the PDF view." },
        { screen: "Accept → convert", say: "And when they say yes, the invoice writes itself.", do: "Mark accepted and convert.", watch: "This is the moment to ask how long that takes them today." },
      ],
      wow: "Quote to invoice in one click, with your win rate calculated as a side effect.",
    },
  },
  {
    key: "expenses",
    title: "Expenses",
    icon: "payment",
    category: "Finance & Billing",
    route: "/expenses",
    audience: "Finance, managers",
    feature: "accounts",
    permission: "financial",
    summary: "Record company spending by category, with receipts attached.",
    what:
      "The outgoing side: expenses recorded with a date, category, amount and an optional receipt image, so spending is visible next to revenue rather than discovered at year end.",
    why:
      "Revenue without cost is a vanity metric. Categorised expenses turn the accounts dashboard into an actual picture of the business.",
    features: [
      "Categorised expense entries with notes.",
      "Attach a receipt image or PDF.",
      "Filter by date range, category and person.",
      "Totals feed the accounts dashboard and financial report.",
    ],
    steps: [
      { title: "Agree your categories", detail: "A short, stable category list is worth more than a detailed one nobody follows." },
      { title: "Record as it happens", detail: "Date, category, amount, note. Monthly catch-up entry is where accuracy dies." },
      { title: "Attach the receipt", detail: "Photograph it at the time; the image lives with the record." },
      { title: "Review monthly", detail: "Filter by category over the month and compare with the previous one." },
    ],
    functional: {
      fields: ["Date, category, amount, payee, note", "Receipt attachment", "Recorded by"],
      api: ["Workspace store finance records; attachments via the media store"],
      storage: ["Workspace store, with files under the media library"],
      permissions: "Module `financial`; plan feature `accounts`.",
    },
    demo: {
      goal: "Complete the money picture in one minute.",
      minutes: 2,
      prep: ["Seed a month of expenses across four categories."],
      beats: [
        { screen: "Expenses", say: "Costs sit next to revenue, so the dashboard tells the truth.", do: "Filter by category and show the month's total." },
      ],
      wow: "Profit stops being a year-end surprise.",
    },
  },
  {
    key: "bills",
    title: "Bills & payables",
    icon: "fileText",
    category: "Finance & Billing",
    route: "/bills",
    audience: "Finance",
    feature: "accounts",
    permission: "financial",
    summary: "Supplier bills you owe, with due dates and payment status.",
    what:
      "The mirror image of invoices: bills received from vendors, with amounts, due dates and payment status, so you know what you owe and when.",
    why:
      "Missing a supplier due date costs relationships and sometimes penalties. A payables list with due dates makes the week's payment run obvious.",
    features: [
      "Bill records linked to a vendor.",
      "Due dates with an overdue flag.",
      "Partial payment tracking.",
      "Payables total feeding the accounts dashboard.",
    ],
    steps: [
      { title: "Record the bill on arrival", detail: "Vendor, amount, bill date, due date. Attach the document." },
      { title: "Watch the due list", detail: "Sort by due date and plan the payment run for the week." },
      { title: "Mark payments", detail: "Record what you've paid so the outstanding payables figure stays honest." },
      { title: "Reconcile with vendors", detail: "Filter by vendor when a supplier queries a statement." },
    ],
    functional: {
      fields: ["Vendor, bill number, bill date, due date", "Amount, tax, amount paid, balance", "Status, attachment"],
      api: ["Workspace store finance records", "GET /api/vendors for the vendor list"],
      storage: ["Workspace store; vendors in the `vendors` table"],
      permissions: "Module `financial`; plan feature `accounts`.",
    },
    demo: {
      goal: "Show both sides of the ledger.",
      minutes: 2,
      prep: ["Seed bills including one overdue."],
      beats: [
        { screen: "Bills", say: "What you owe, by date — so the payment run is a list, not a memory test.", do: "Sort by due date and point at the overdue row." },
      ],
      wow: "Receivables and payables in the same system, so cash position is a screen, not a spreadsheet.",
    },
  },
  {
    key: "ledger",
    title: "Ledger",
    icon: "list",
    category: "Finance & Billing",
    route: "/ledger",
    audience: "Finance",
    feature: "accounts",
    permission: "financial",
    summary: "A running transaction view across invoices, payments, expenses and bills.",
    what:
      "A chronological view of financial transactions across the workspace — what was billed, received, spent and owed — with filters for period and type.",
    why:
      "When a number on the dashboard looks wrong, the ledger is where you find out why. It's the audit view finance people ask for first.",
    features: [
      "Chronological entries across every finance module.",
      "Filter by type, date range and party.",
      "Running totals for the selected period.",
      "Export for the accountant.",
    ],
    steps: [
      { title: "Choose the period", detail: "Set the date range before reading anything — the ledger is only meaningful within a period." },
      { title: "Filter by type", detail: "Invoices, payments, expenses, bills — isolate one to check a total." },
      { title: "Trace a discrepancy", detail: "Find the transaction, open the source record, and check it against the document." },
      { title: "Export for the accountant", detail: "The export is what your accountant actually wants at quarter end." },
    ],
    functional: {
      fields: ["Date, type, party, reference, debit / credit, running balance"],
      api: ["Aggregated from the finance records"],
      storage: ["Derived — nothing is stored uniquely here"],
      permissions: "Module `financial`; plan feature `accounts`.",
      notes: ["This is a management ledger, not a double-entry accounting system — it complements your accounting software rather than replacing it."],
    },
    demo: {
      goal: "Satisfy the finance person in the room that they can audit the numbers.",
      minutes: 2,
      prep: ["Have a month with entries of all four types."],
      beats: [
        { screen: "Ledger", say: "Every number on the dashboard traces back to a transaction here.", do: "Filter to one type, then open a source record.", watch: "Accountants relax once they see the source link." },
      ],
      wow: "Every headline figure is one click from the transaction that produced it.",
    },
  },
  {
    key: "account-reports",
    title: "Financial reports",
    icon: "trendUp",
    category: "Finance & Billing",
    route: "/account-reports",
    audience: "Finance, owners",
    feature: "accounts",
    permission: "financial",
    summary: "Revenue, receivables and expense reporting over a period, with export.",
    what:
      "Period reporting on the finance data: revenue and collections, outstanding receivables by age, and expenses by category, all exportable.",
    why:
      "Monthly and quarterly numbers are what boards, banks and accountants ask for. Producing them from live data removes a recurring day of spreadsheet work.",
    features: [
      "Revenue and collection totals by period.",
      "Receivables ageing.",
      "Expenses by category.",
      "Date range on everything, with export.",
    ],
    steps: [
      { title: "Set the period", detail: "Month, quarter or a custom range." },
      { title: "Read revenue against collections", detail: "The gap between the two is your collection problem, quantified." },
      { title: "Check the ageing buckets", detail: "Anything past 60 days needs a decision, not another reminder." },
      { title: "Export", detail: "Send the same figures to your accountant rather than re-deriving them." },
    ],
    functional: {
      fields: ["Aggregations only"],
      api: ["Reads invoice, payment, expense and bill records"],
      storage: ["Derived from the finance records"],
      permissions: "Module `financial`; plan feature `accounts`.",
    },
    demo: {
      goal: "Show month-end taking minutes.",
      minutes: 3,
      prep: ["Seed at least two months so a comparison is possible."],
      beats: [
        { screen: "Financial report", say: "Month-end, on demand.", do: "Switch the period and let the figures change, then export." },
      ],
      wow: "The month-end pack is a date range and a download.",
    },
  },
  // ──────────────────────────── Assets & Inventory ───────────────────────────
  {
    key: "assets",
    title: "Asset register & dashboard",
    icon: "asset",
    category: "Assets & Inventory",
    route: "/asset-management",
    audience: "Admin, IT, operations",
    feature: "assets",
    permission: "financial",
    summary: "Every company asset with its cost, category, condition and current holder.",
    what:
      "The register of what the company owns — laptops, vehicles, machines, furniture — each with a purchase cost, category, serial number, condition and the person or location it's with. The asset dashboard summarises value, category split and status.",
    why:
      "Companies discover what they own during an audit, badly. A register maintained as things are bought and handed over makes audits routine and insurance claims possible.",
    features: [
      "Asset records with category, serial number, purchase date and cost.",
      "Current holder or location, updated through assignments.",
      "Condition and status (in use, in store, under repair, retired).",
      "Verification workflow: a user confirms or disputes what they've been given.",
      "Dashboard with total value, category split and status counts.",
      "Feeds maintenance, warranty, depreciation and the audit log.",
    ],
    steps: [
      { title: "Set up categories first", detail: "Admin Setup → Asset Category. Categories drive both the dashboard split and the depreciation rules." },
      { title: "Add assets as you buy them", detail: "Name, category, serial number, vendor, purchase date and cost. The serial number is what makes a physical audit possible." },
      { title: "Assign to a person or place", detail: "Use Assignments so the register always says where the item actually is." },
      { title: "Keep the condition current", detail: "Update status when an item goes for repair or is retired — a register full of 'in use' laptops that are in a cupboard is useless." },
      { title: "Use the dashboard for insurance and budgets", detail: "Total value by category is what your insurer and your finance team both ask for." },
    ],
    functional: {
      fields: ["Name, asset code, category, serial number", "Vendor, purchase date, purchase cost, warranty end", "Status, condition, current holder / location", "Comments and verification state"],
      api: ["GET/POST/PUT/DELETE /api/assets", "POST /api/assets/{id}/submit | verify | reject | reopen | comments"],
      storage: ["`assets` table (plus related assignment, maintenance and audit records) in the workspace database"],
      automations: ["Assignment changes and verification steps write to the asset audit log automatically.", "Assets nearing warranty expiry surface in the warranty screen."],
      permissions: "Module `financial`; plan feature `assets`.",
    },
    demo: {
      goal: "Turn 'we track that in a spreadsheet' into a visible liability.",
      minutes: 4,
      prep: ["Seed 25+ assets across four categories with realistic values.", "Have one asset under repair and one awaiting user verification."],
      beats: [
        { screen: "Asset dashboard", say: "This is what you own, what it cost, and where it is.", do: "Show the value by category." },
        { screen: "Register", say: "Every item has a serial number and a holder — so an audit is a walk round, not an archaeology dig.", do: "Open an asset and show its history." },
        { screen: "Verification", say: "And the person holding it has confirmed it. That signature is what makes recovery possible when they leave.", do: "Open the asset awaiting verification.", watch: "IT managers ask about offboarding here — link it to Users." },
      ],
      wow: "You can prove what you own, what it's worth, and who has it — today, not after a two-week audit.",
    },
  },
  {
    key: "asset-assignments",
    title: "Asset assignments",
    icon: "briefcase",
    category: "Assets & Inventory",
    route: "/asset-assignments",
    audience: "IT, admin",
    feature: "assets",
    permission: "financial",
    summary: "Hand assets to people, get them acknowledged, and take them back.",
    what:
      "The issue-and-return record for assets: who was given what, when, in what condition, and whether they acknowledged it. Returns close the loop and put the item back in stock.",
    why:
      "Recovering equipment from leavers is only possible if the handover was recorded and acknowledged. This screen is the paperwork, without the paper.",
    features: [
      "Assign an asset to a user with date and condition notes.",
      "The user verifies or disputes the assignment.",
      "Return processing that updates the register.",
      "Per-person view of everything currently held.",
    ],
    steps: [
      { title: "Assign on handover", detail: "Pick the asset and the person, note the condition, and save. Do it at the moment of handover, not later." },
      { title: "Ask for verification", detail: "The holder confirms in their own login. That acknowledgement is your evidence." },
      { title: "Handle disputes", detail: "If they reject it ('the screen was already cracked'), the comment thread records why — before it becomes an argument." },
      { title: "Process returns", detail: "On return, record the condition. The asset goes back to available and the person's list empties." },
      { title: "Check before offboarding", detail: "Filter by person before their last day and recover everything on the list." },
    ],
    functional: {
      fields: ["Asset, assigned user, assigned date, condition on issue", "Verification state and comments", "Return date and condition on return"],
      api: ["/api/assets/{id}/submit | verify | reject | reopen | comments"],
      storage: ["Assignment records alongside the `assets` table"],
      automations: ["Assignment and verification events are written to the asset audit trail with user and timestamp."],
      permissions: "Module `financial`. Users can always see and verify their own assignments.",
    },
    demo: {
      goal: "Show equipment recovery becoming routine.",
      minutes: 3,
      prep: ["Have one assignment pending verification, ideally on a second signed-in demo user."],
      beats: [
        { screen: "Assignments", say: "Handover is recorded and acknowledged by the person holding it.", do: "Assign an asset, then verify it as the other user.", watch: "Ask what they do today when someone leaves with a laptop." },
      ],
      wow: "Nobody leaves with equipment you can't prove they were given.",
    },
  },
  {
    key: "asset-maintenance",
    title: "Asset maintenance",
    icon: "settings",
    category: "Assets & Inventory",
    route: "/asset-maintenance",
    audience: "IT, facilities",
    feature: "assets",
    permission: "financial",
    summary: "Service schedules, repair history and maintenance cost per asset.",
    what:
      "Planned and unplanned maintenance for assets: what was serviced, when, by whom, at what cost, and when the next service is due.",
    why:
      "Maintenance cost per asset is the number that tells you when to replace rather than repair. It also stops preventive servicing being forgotten.",
    features: [
      "Log service and repair events with cost and vendor.",
      "Next-service-due dates with reminders.",
      "Full maintenance history per asset.",
      "Cost roll-up that supports repair-or-replace decisions.",
    ],
    steps: [
      { title: "Log every service", detail: "Date, what was done, vendor, cost. Even a free warranty repair belongs here." },
      { title: "Set the next due date", detail: "For anything on a schedule — vehicles, machines, AMC-covered kit." },
      { title: "Watch the due list", detail: "Work the upcoming list weekly so preventive maintenance actually happens." },
      { title: "Use the cost history", detail: "When repairs pass a share of replacement value, replace it. The history gives you the number." },
    ],
    functional: {
      fields: ["Asset, service date, type (preventive / repair), description", "Vendor, cost, next due date"],
      api: ["Asset maintenance records via the assets API"],
      storage: ["Maintenance records alongside the `assets` table"],
      automations: ["Assets with a service due soon are highlighted; notifications can be raised for the owner."],
      permissions: "Module `financial`; plan feature `assets`.",
    },
    demo: {
      goal: "Show total cost of ownership becoming visible.",
      minutes: 2,
      prep: ["Seed one asset with three repairs, so the cost story is obvious."],
      beats: [
        { screen: "Maintenance", say: "This machine has cost you more in repairs than a new one.", do: "Open the asset with repeated repairs and show the cost total." },
      ],
      wow: "Repair-or-replace becomes a number instead of an argument.",
    },
  },
  {
    key: "asset-warranty",
    title: "Warranty & AMC",
    icon: "shield",
    category: "Assets & Inventory",
    route: "/asset-warranty",
    audience: "IT, procurement",
    feature: "assets",
    permission: "financial",
    summary: "Warranty and contract expiry dates, so cover is renewed before it lapses.",
    what:
      "Warranty and annual maintenance contract tracking per asset, with expiry dates and an upcoming-expiry view.",
    why:
      "Paying for a repair that was still under warranty is a pure, avoidable loss — and it happens constantly when expiry dates live on paper.",
    features: [
      "Warranty and AMC end dates per asset.",
      "Upcoming expiry list with a lead time.",
      "Vendor and contract reference stored with the asset.",
      "Feeds the maintenance decision — repair under cover, or pay.",
    ],
    steps: [
      { title: "Record cover at purchase", detail: "Warranty end date and AMC reference go in when the asset is added." },
      { title: "Review the expiry list monthly", detail: "Anything expiring in the next 60 days is a renewal decision now." },
      { title: "Check before you pay for a repair", detail: "Look up the asset first — it may still be covered." },
      { title: "Record renewals", detail: "Update the end date when a contract is renewed so the list stays true." },
    ],
    functional: {
      fields: ["Asset, warranty end date, AMC vendor, contract reference, AMC end date"],
      api: ["Asset records via /api/assets"],
      storage: ["Fields on the `assets` table"],
      automations: ["The screen surfaces assets whose cover expires within the configured window."],
      permissions: "Module `financial`; plan feature `assets`.",
    },
    demo: {
      goal: "A one-minute, obvious money saver.",
      minutes: 2,
      prep: ["Seed two assets with warranties expiring within 30 days."],
      beats: [
        { screen: "Warranty", say: "Two of these expire next month. Renew, or budget for the repair — but decide on purpose.", do: "Show the expiring list." },
      ],
      wow: "You stop paying for repairs that were still under warranty.",
    },
  },
  {
    key: "asset-depreciation",
    title: "Depreciation",
    icon: "trendUp",
    category: "Assets & Inventory",
    route: "/asset-depreciation",
    audience: "Finance",
    feature: "assets",
    permission: "financial",
    summary: "Book value of assets over time, by category rule.",
    what:
      "Depreciation calculated per asset from its purchase cost and category rule, giving current book value and the annual charge.",
    why:
      "Finance needs book value for the balance sheet, and operations needs it to argue for replacement budget. Calculating it from the same register everyone else uses keeps both honest.",
    features: [
      "Per-category depreciation rules.",
      "Current book value per asset and in total.",
      "Annual and cumulative depreciation figures.",
      "Export for the accountant.",
    ],
    steps: [
      { title: "Set the rules by category", detail: "Rate and method are configured per asset category, so all laptops behave the same way." },
      { title: "Check purchase data is right", detail: "Depreciation is only as good as the purchase cost and date on the asset." },
      { title: "Read book value", detail: "Per asset for replacement decisions; in total for the balance sheet." },
      { title: "Export at year end", detail: "Hand the schedule to your accountant rather than rebuilding it." },
    ],
    functional: {
      fields: ["Purchase cost, purchase date, category rate/method", "Accumulated depreciation, current book value"],
      api: ["Computed from the `assets` records"],
      storage: ["Derived; rules stored with the asset categories"],
      permissions: "Module `financial`; plan feature `assets`.",
      notes: ["Treat these figures as management information — your accountant's statutory treatment may differ."],
    },
    demo: {
      goal: "Give the finance stakeholder something they specifically own.",
      minutes: 2,
      prep: ["Ensure the seeded assets have sensible purchase dates spread over three years."],
      beats: [
        { screen: "Depreciation", say: "Book value, by asset and in total, from the same register your IT team maintains.", do: "Show the total and one asset's schedule." },
      ],
      wow: "One register serves IT, finance and the auditor.",
    },
  },
  {
    key: "asset-audit",
    title: "Asset audit log",
    icon: "activity",
    category: "Assets & Inventory",
    route: "/asset-audit",
    audience: "Auditors, administrators",
    feature: "assets",
    permission: "financial",
    summary: "Every change to every asset, with who did it and when.",
    what:
      "An immutable trail of asset events: created, assigned, verified, disputed, serviced, returned, retired — each with the user and timestamp.",
    why:
      "When something goes missing, the question is always 'who had it last and who changed the record'. This screen answers both without anyone's word against anyone else's.",
    features: [
      "Chronological event trail across all assets.",
      "Filter by asset, user, event type and date.",
      "Every assignment and verification step captured automatically.",
      "Export for audit evidence.",
    ],
    steps: [
      { title: "Search by asset", detail: "Start from the item in question and read its life story in order." },
      { title: "Or search by person", detail: "Everything a user did to the register, useful during an investigation or a handover." },
      { title: "Filter by date", detail: "Narrow to the period under audit." },
      { title: "Export as evidence", detail: "The export is what an auditor will actually accept." },
    ],
    functional: {
      fields: ["Asset, event type, actor, timestamp, before / after detail"],
      api: ["Asset audit records via the assets API"],
      storage: ["Audit records in the workspace database — written automatically, not editable by users"],
      automations: ["Every state change on an asset writes an audit row; there is no way to turn it off."],
      permissions: "Module `financial`. Read-only for everyone, including administrators.",
    },
    demo: {
      goal: "Close the governance conversation.",
      minutes: 2,
      prep: ["Make sure the demo asset has a full history including a dispute."],
      beats: [
        { screen: "Asset audit", say: "Nobody can quietly edit the register. Every change has a name and a time.", do: "Filter to one asset and walk its trail.", watch: "Compliance-driven buyers relax here — mention it's not switchable." },
      ],
      wow: "The register can't be quietly rewritten — every change is signed and timestamped.",
    },
  },
  {
    key: "inventory",
    title: "Inventory",
    icon: "inventory",
    category: "Assets & Inventory",
    route: "/inventory",
    audience: "Stores, operations",
    feature: "inventory",
    permission: "financial",
    summary: "Stock items, quantities, movements, low-stock alerts and suppliers.",
    what:
      "Stock control: items with quantities and reorder levels, movements in and out, category and supplier organisation, a low-stock view and a dashboard of stock value.",
    why:
      "Running out of a fast-moving item costs a sale; overstocking ties up cash. A live quantity with a reorder level solves both without a stock take.",
    features: [
      "Item master with SKU, category, unit and reorder level.",
      "Stock movements — in, out and adjustments — with a reason.",
      "Assign units to a user and process returns.",
      "Low-stock screen driven by reorder levels.",
      "Supplier list and category organisation.",
      "Dashboard with stock value and movement trends.",
    ],
    steps: [
      { title: "Set up categories and suppliers", detail: "Do this before adding items so nothing needs re-filing later." },
      { title: "Add items with reorder levels", detail: "The reorder level is what makes the low-stock screen useful; setting it to zero disables the whole point." },
      { title: "Record movements, not stock takes", detail: "Every issue and receipt goes in as it happens. Quantities then stay right on their own." },
      { title: "Adjust honestly", detail: "When a count disagrees with the system, record an adjustment with a reason rather than silently editing the number." },
      { title: "Work the low-stock list", detail: "Review it before each purchase run." },
      { title: "Watch stock value", detail: "The dashboard shows what's tied up in stock — a number owners rarely have to hand." },
    ],
    functional: {
      fields: ["Item name, SKU, category, unit, reorder level", "Quantity on hand, unit cost, stock value", "Movement: type, quantity, reason, user, date", "Supplier"],
      api: ["GET/POST/PUT/DELETE /api/inventory", "POST /api/inventory/{id}/adjust", "POST /api/inventory/{id}/assign", "POST /api/inventory/assignments/{id}/return"],
      storage: ["Inventory tables in the workspace database"],
      automations: ["Every movement recalculates quantity on hand; items at or below the reorder level appear in Low Stock automatically."],
      permissions: "Module `financial`; plan feature `inventory`.",
    },
    demo: {
      goal: "Show stock that maintains itself.",
      minutes: 4,
      prep: ["Seed 20 items with two already below their reorder level.", "Have a movement history on one item so the trail is visible."],
      beats: [
        { screen: "Inventory dashboard", say: "This is what's on your shelves and what it's worth.", do: "Show stock value, then open All Items." },
        { screen: "Movement", say: "Issue stock and the quantity follows — no stock take needed to know where you are.", do: "Record an issue and show the quantity change." },
        { screen: "Low stock", say: "And the reorder list writes itself.", do: "Open Low Stock.", watch: "Ask how they decide what to reorder today." },
      ],
      wow: "Your reorder list is generated from actual movements, not from someone walking the shelves.",
    },
  },
  {
    key: "vendors",
    title: "Vendors",
    icon: "briefcase",
    category: "Assets & Inventory",
    route: "/vendors",
    audience: "Procurement, finance",
    feature: "vendors",
    permission: "financial",
    summary: "The supplier directory used by bills, assets and inventory.",
    what:
      "A directory of suppliers with contact details, tax identifiers and payment terms, referenced from bills, asset purchases and inventory supply.",
    why:
      "Vendor details scattered across bills and emails make reconciliation and reordering slow. One directory means one version of the supplier's bank details.",
    features: [
      "Vendor records with contacts, address and tax IDs.",
      "Payment terms and notes.",
      "Referenced by bills, assets and inventory suppliers.",
      "Searchable list with quick edit.",
    ],
    steps: [
      { title: "Add vendors as you engage them", detail: "Name, contact person, phone, email, address, tax ID, payment terms." },
      { title: "Use the directory everywhere", detail: "Select the vendor on bills, assets and inventory rather than typing a name — that's what links the records." },
      { title: "Keep bank details current", detail: "Change them here once, deliberately, and verify by phone. Vendor bank-detail fraud is common." },
      { title: "Review annually", detail: "Retire vendors you no longer use so the picker stays short." },
    ],
    functional: {
      fields: ["Company name, contact person, phone, email", "Address, tax ID / GSTIN, payment terms, notes"],
      api: ["GET/POST/PUT/DELETE /api/vendors"],
      storage: ["`vendors` table in the workspace database"],
      permissions: "Module `financial`; plan feature `vendors`.",
    },
    demo: {
      goal: "Show the supply side joined up.",
      minutes: 2,
      prep: ["Seed six vendors, with one used by both a bill and an asset."],
      beats: [
        { screen: "Vendors", say: "One supplier record, used by your bills, your assets and your stock.", do: "Open a vendor and point at the linked records." },
      ],
      wow: "Supplier details are entered once and used everywhere.",
    },
  },
  {
    key: "knowledge-base",
    title: "Knowledge base",
    icon: "knowledge",
    category: "Assets & Inventory",
    route: "/knowledge-base",
    audience: "Everyone",
    feature: "knowledge",
    summary: "The in-app manual — every module explained, with screenshots and videos.",
    what:
      "The user manual inside the product: an article per module explaining what it does and how to use it, plus the screenshots and walkthrough videos published by the platform owner.",
    why:
      "Documentation that lives outside the product is documentation nobody opens. Keeping it one click from the screen it describes is what makes self-service support work.",
    features: [
      "Searchable articles covering every module.",
      "Step-by-step instructions written for non-technical users.",
      "Screenshots and videos attached per module, and per step, by the platform owner.",
      "Always current — it updates when the owner publishes, with no client-side update needed.",
    ],
    steps: [
      { title: "Search before you ask", detail: "Type what you're trying to do ('import leads', 'record a payment'), not the module name." },
      { title: "Follow the numbered steps", detail: "Each article's steps are in the order you'd actually do them." },
      { title: "Watch the walkthrough", detail: "Where the platform owner has attached a video, it plays inline — often faster than reading." },
      { title: "Send the link", detail: "Point a colleague at the article instead of explaining it twice." },
    ],
    functional: {
      fields: ["Reading only — no data entry"],
      api: ["GET /api/platform/docs — the published screenshots, videos and notes"],
      storage: ["Article text ships with the app; media lives in the platform `settings` table under `platform.docs`"],
      automations: ["Media published by the platform owner appears in every workspace immediately, with no client action."],
      permissions: "Plan feature `knowledge`. No module permission — everyone can read the manual.",
    },
    demo: {
      goal: "Show that training and support are built in.",
      minutes: 2,
      prep: ["Make sure at least two modules have screenshots and one has a video attached before the call."],
      beats: [
        { screen: "Knowledge base", say: "Your team trains itself. Every module, with screenshots and short videos.", do: "Search for something, open the article and play the attached video.", watch: "Buyers worried about adoption relax here — mention that you can add their own SOPs." },
      ],
      wow: "Onboarding a new joiner costs you a login, not a training day.",
    },
  },
  // ─────────────────────────────── People & HR ───────────────────────────────
  {
    key: "hrms",
    title: "HRMS dashboard",
    icon: "users",
    category: "People & HR",
    route: "/hrms",
    audience: "HR, managers, every employee",
    feature: "hrms",
    summary: "The people side: headcount, who's in today, leave, and everything HR.",
    what:
      "The entry point to the HR system: headcount, attendance today, pending leave requests and upcoming events, with links to attendance, leave, payroll, payslips, policies and the rest of the employee-facing modules.",
    why:
      "Running HR on spreadsheets and WhatsApp means leave balances are guesses and payroll is a monthly panic. One system with self-service for employees removes most of HR's inbox.",
    features: [
      "Headcount and department split.",
      "Today's attendance and who's on leave.",
      "Pending approvals for managers.",
      "Links to every HR module, including employee self-service.",
    ],
    steps: [
      { title: "Set up the org first", detail: "Departments, designations, shifts and work locations in Admin Setup — attendance and payroll both depend on them." },
      { title: "Check the day", detail: "Present, absent, on leave. It's the first question every morning." },
      { title: "Clear approvals", detail: "Pending leave requests are listed here for approvers; leaving them is the fastest way to lose trust in the system." },
      { title: "Send employees to self-service", detail: "Attendance, leave requests, payslips and policies are all things employees do for themselves. HR shouldn't be a middleman." },
    ],
    functional: {
      fields: ["Aggregations across the HR modules"],
      api: ["Reads attendance, leave, directory and payroll records"],
      storage: ["Workspace database and store, tenant-scoped"],
      permissions: "Plan feature `hrms`. HR-wide views are for HR and administrators; employees see their own records.",
    },
    demo: {
      goal: "Show that the product is two systems in one, at no extra login.",
      minutes: 3,
      prep: ["Seed 15 employees across three departments with today's attendance marked and two pending leave requests."],
      beats: [
        { screen: "HR dashboard", say: "Same login, same workspace — this is your whole HR system.", do: "Show headcount, then today's attendance.", watch: "Buyers often didn't know HR was included; pause for that reaction." },
        { screen: "Pending approvals", say: "Managers approve in seconds, from here or their phone.", do: "Open a leave request." },
      ],
      wow: "CRM and HRMS in one product, one login, one bill.",
    },
  },
  {
    key: "attendance",
    title: "Attendance (self)",
    icon: "clock",
    category: "People & HR",
    route: "/attendance",
    audience: "Every employee",
    feature: "hrms",
    summary: "Clock in and out, and see your own attendance history.",
    what:
      "The employee's own attendance screen: punch in and out against the shift they're assigned to, and review their history for the month, including late marks and total hours.",
    why:
      "Attendance registers on paper can't feed payroll. Self-service punching gives HR a clean dataset and gives employees a record they can check themselves.",
    features: [
      "Punch in / out against the assigned shift.",
      "Personal monthly history with hours and late marks.",
      "Works on the mobile app, with location where enabled.",
      "Feeds payroll and the HR dashboard.",
    ],
    steps: [
      { title: "Punch in when you start", detail: "One tap. Your shift determines whether it counts as late." },
      { title: "Punch out when you leave", detail: "The pair gives total hours for the day." },
      { title: "Check your month", detail: "Review your own history before payroll runs, not after." },
      { title: "Raise anything wrong with HR", detail: "Missed punches are corrected by HR in All Attendance." },
    ],
    functional: {
      fields: ["User, date, punch-in, punch-out, total hours", "Shift, late / early flags, location where enabled"],
      api: ["HR attendance records in the workspace database"],
      storage: ["Workspace database, tenant-scoped"],
      automations: ["Late and short-hours flags are derived from the assigned shift; totals feed payroll."],
      permissions: "Plan feature `hrms`. Everyone sees their own record.",
    },
    demo: {
      goal: "Show payroll-grade attendance with no hardware.",
      minutes: 2,
      prep: ["Have a shift configured so a late mark is demonstrable."],
      beats: [
        { screen: "Attendance", say: "No biometric machine, no register. The phone they already carry.", do: "Punch in and show the history.", watch: "If they have a biometric device, ask whether it feeds payroll today — usually it doesn't." },
      ],
      wow: "Attendance that reaches payroll without anyone retyping a register.",
    },
  },
  {
    key: "attendance-monitor",
    title: "All attendance (HR view)",
    icon: "activity",
    category: "People & HR",
    route: "/attendance-monitor",
    audience: "HR, managers",
    feature: "hrms",
    summary: "The whole team's attendance, with corrections and monthly export.",
    what:
      "HR's view of attendance across every employee: daily grid, filters by department and date range, correction of missed punches, and export for payroll.",
    why:
      "HR needs the aggregate and the ability to fix mistakes. Without correction rights, one missed punch becomes a payroll dispute.",
    features: [
      "Team-wide daily and monthly grid.",
      "Filter by department, location and person.",
      "Correct or add punches with an audit trail.",
      "Export for payroll processing.",
    ],
    steps: [
      { title: "Review daily", detail: "Absences and missed punches are easiest to fix the same day." },
      { title: "Correct with a reason", detail: "Edit the record and say why. The change is logged." },
      { title: "Close the month", detail: "Check the grid before payroll and fix gaps; payroll reads this data." },
      { title: "Export", detail: "Hand the month's grid to whoever runs payroll, or use the built-in payroll module." },
    ],
    functional: {
      fields: ["Per employee, per day: punches, hours, status, late flags"],
      api: ["HR attendance records"],
      storage: ["Workspace database"],
      automations: ["Corrections are logged with the HR user and time."],
      permissions: "Plan feature `hrms`; HR and administrators. Managers may be limited to their department.",
    },
    demo: {
      goal: "Show HR keeping control without chasing anyone.",
      minutes: 2,
      prep: ["Seed a month with two missed punches so a correction can be demonstrated."],
      beats: [
        { screen: "All attendance", say: "The month at a glance, and HR can fix the gaps before payroll — with the change logged.", do: "Correct a missed punch." },
      ],
      wow: "Payroll starts from clean attendance data, every month.",
    },
  },
  {
    key: "leaves",
    title: "Leave management",
    icon: "calendar",
    category: "People & HR",
    route: "/leaves",
    audience: "Every employee, managers, HR",
    feature: "hrms",
    summary: "Apply for leave, approve it, and keep balances accurate automatically.",
    what:
      "The leave workflow end to end: employees apply, managers approve or reject, balances update, and the calendar shows who's out.",
    why:
      "Leave on WhatsApp means balances are argued about at year end and two people from the same team are off on the same day. A request queue with balances fixes both.",
    features: [
      "Leave types with entitlements and balances.",
      "Apply with dates and a reason; half-days supported.",
      "Approval flow with a comment.",
      "Automatic balance deduction on approval.",
      "Team calendar view of who's out when.",
    ],
    steps: [
      { title: "Configure leave types", detail: "HR sets the types and annual entitlement per type before go-live." },
      { title: "Apply", detail: "Employee: pick the type and dates, add a reason, submit. The balance check happens as you apply." },
      { title: "Approve", detail: "Manager: review, check the team calendar for clashes, approve or reject with a comment." },
      { title: "Balances update themselves", detail: "Approved leave deducts from the balance immediately — no manual register." },
      { title: "Plan around it", detail: "Use the team view before committing to customer dates." },
    ],
    functional: {
      fields: ["Employee, leave type, from / to, half-day flag, reason", "Status, approver, comment, applied and decided timestamps", "Entitlement and balance per type"],
      api: ["HR leave records in the workspace database"],
      storage: ["Workspace database, tenant-scoped"],
      automations: ["Approval deducts the balance and marks the days in attendance and the team calendar; the applicant is notified of the decision."],
      permissions: "Plan feature `hrms`. Employees apply for themselves; managers and HR approve.",
    },
    demo: {
      goal: "Show the workflow every employee will touch.",
      minutes: 3,
      prep: ["Sign in a second demo user as an employee so the request and approval can be shown live on two screens."],
      beats: [
        { screen: "Apply (employee)", say: "Thirty seconds, from the phone.", do: "Apply for two days as the employee user." },
        { screen: "Approve (manager)", say: "The manager sees the clash risk and the balance before deciding.", do: "Approve it and show the balance change.", watch: "This two-screen moment sells HR better than any tile." },
      ],
      wow: "Leave balances are never argued about again — the system deducts them the moment approval happens.",
    },
  },
  {
    key: "holidays",
    title: "Holidays",
    icon: "star",
    category: "People & HR",
    route: "/holidays",
    audience: "HR, everyone",
    feature: "hrms",
    summary: "The company holiday calendar, published to everyone.",
    what:
      "The list of public and company holidays for the year, published to every employee and used by attendance and leave so a holiday isn't counted as absence.",
    why:
      "Regional holidays differ, and 'is Monday off?' is a question HR answers a hundred times a year. Publish once.",
    features: [
      "Holiday list by date with names.",
      "Location-specific holidays where offices differ.",
      "Visible to every employee.",
      "Excluded from leave deduction and absence.",
    ],
    steps: [
      { title: "Load the year in one sitting", detail: "Do it in January; a half-filled holiday list causes more questions than none." },
      { title: "Mark location-specific days", detail: "Where offices observe different holidays, tag them to the work location." },
      { title: "Publish", detail: "Employees see it immediately in their own view." },
      { title: "Check leave interaction", detail: "Leave spanning a holiday shouldn't consume balance for that day — verify once after setup." },
    ],
    functional: {
      fields: ["Date, holiday name, work location / applicability, optional flag"],
      api: ["HR holiday records"],
      storage: ["Workspace database"],
      automations: ["Holidays are excluded from leave deduction and from absence marking."],
      permissions: "Plan feature `hrms`; HR maintains, everyone views.",
    },
    demo: {
      goal: "Quick credibility for multi-location businesses.",
      minutes: 1,
      prep: ["Load the current year's holidays for two locations."],
      beats: [
        { screen: "Holidays", say: "Published once, per location, and leave respects it automatically.", do: "Show the list filtered by location." },
      ],
      wow: "HR answers 'is Monday off' exactly once a year.",
    },
  },
  {
    key: "payroll",
    title: "Payroll & salary",
    icon: "payment",
    category: "People & HR",
    route: "/payroll",
    audience: "HR, finance",
    feature: "hrms",
    summary: "Salary structures, monthly runs, and the figures behind each payslip.",
    what:
      "Payroll processing: salary structure per employee (earnings and deductions), a monthly run that pulls attendance and leave, and the resulting figures that become payslips.",
    why:
      "Payroll built from the same attendance and leave data that employees can see themselves produces far fewer disputes than a spreadsheet nobody can check.",
    features: [
      "Salary structure per employee: basic, allowances, deductions.",
      "Payroll settings for the workspace (Admin Setup → Payroll Settings).",
      "Monthly run that reads attendance and approved leave.",
      "Review before finalising, then generate payslips.",
      "Export for the bank transfer file or your accountant.",
    ],
    steps: [
      { title: "Configure payroll settings", detail: "Pay cycle, components and rules in Admin Setup → Payroll Settings, before the first run." },
      { title: "Set each salary structure", detail: "Earnings and deductions per employee. Get this right once and monthly runs are routine." },
      { title: "Close attendance first", detail: "Payroll reads attendance and leave — fix the month's gaps before running it." },
      { title: "Run and review", detail: "Generate the month, then review the sheet line by line before finalising. Check new joiners and leavers carefully." },
      { title: "Publish payslips", detail: "Finalise, and payslips become available to employees in their own login." },
    ],
    functional: {
      fields: ["Employee, pay period", "Earnings (basic, allowances), deductions (statutory, other)", "Days present, leave without pay, net pay"],
      api: ["HR payroll records; reads attendance and leave"],
      storage: ["Workspace database; settings in the workspace store"],
      automations: ["A run pulls attendance and approved leave for the period; finalising generates payslips for every employee in the run."],
      permissions: "Plan feature `hrms`; HR and finance only — payroll is the most sensitive data in the workspace.",
      notes: ["Statutory calculations vary by country; verify the components against local rules with your accountant before the first live run."],
    },
    demo: {
      goal: "Show payroll as a consequence of data already in the system.",
      minutes: 4,
      prep: ["Have salary structures set for the seeded employees and a clean attendance month.", "Know which statutory components apply in the prospect's country before the call."],
      beats: [
        { screen: "Salary structure", say: "Set once per employee.", do: "Open one structure." },
        { screen: "Run payroll", say: "The month's attendance and approved leave are already here — payroll is a review, not a data-entry exercise.", do: "Generate the month and open the review sheet.", watch: "Expect statutory questions; answer honestly and note what needs configuring." },
        { screen: "Payslips", say: "Finalise, and every employee has their payslip in their own login.", do: "Finalise and show an employee's payslip view." },
      ],
      wow: "Payroll takes an afternoon instead of a week, because the attendance and leave data is already correct.",
    },
  },
  {
    key: "payslips",
    title: "Payslips",
    icon: "fileText",
    category: "People & HR",
    route: "/payslips",
    audience: "Every employee, HR",
    feature: "hrms",
    summary: "Employees download their own payslips; HR sees the archive.",
    what:
      "The payslip archive: each employee sees their own months, HR sees everyone's. Payslips are generated when a payroll run is finalised and carry the workspace branding.",
    why:
      "HR emailing PDFs one by one is a waste of a person's week, and employees lose them anyway. Self-service download solves both permanently.",
    features: [
      "Per-employee archive by month.",
      "Branded, printable payslip layout.",
      "Generated automatically from a finalised payroll run.",
      "HR view across all employees.",
    ],
    steps: [
      { title: "Employees: open Payslips", detail: "Pick the month and download. Nothing to request from HR." },
      { title: "Check the components", detail: "Earnings, deductions and net pay are itemised — query anything unexpected with HR the same month." },
      { title: "HR: use the archive", detail: "Loan and visa letters need past payslips; they're all here." },
      { title: "Keep your own copy", detail: "Download and keep payslips you may need years later for taxes or loans." },
    ],
    functional: {
      fields: ["Employee, period, earnings and deduction lines, net pay"],
      api: ["HR payroll records"],
      storage: ["Workspace database; rendered on demand"],
      automations: ["Finalising a payroll run publishes payslips for that period to every employee in it."],
      permissions: "Plan feature `hrms`. Employees see only their own; HR sees all.",
    },
    demo: {
      goal: "One-minute, universally understood value.",
      minutes: 1,
      prep: ["Finalise one payroll month in the demo workspace beforehand."],
      beats: [
        { screen: "Payslips (employee view)", say: "No emails, no requests to HR — every employee has their own archive.", do: "Open and print one payslip." },
      ],
      wow: "HR stops emailing payslips forever.",
    },
  },
  {
    key: "policies",
    title: "Policies",
    icon: "knowledge",
    category: "People & HR",
    route: "/policies",
    audience: "HR, every employee",
    feature: "hrms",
    summary: "Company policy documents, published and readable by everyone.",
    what:
      "The policy library: leave policy, code of conduct, expense rules, IT policy — written or uploaded once and readable by every employee inside the workspace.",
    why:
      "A policy nobody can find isn't a policy. Publishing them where people already work makes 'I didn't know' a much weaker answer.",
    features: [
      "Rich-text policies or uploaded documents.",
      "Categorised and searchable.",
      "Visible to every employee.",
      "Updated centrally — everyone sees the current version.",
    ],
    steps: [
      { title: "Publish the essentials first", detail: "Leave, conduct, expenses, IT. Perfection later; availability now." },
      { title: "Write for the reader", detail: "Short sections and plain language get read; twelve-page PDFs don't." },
      { title: "Update in place", detail: "Edit the existing policy rather than publishing v2 alongside it." },
      { title: "Point people at it", detail: "Answer policy questions with the link, so the habit forms." },
    ],
    functional: {
      fields: ["Title, category, body (rich text) or attachment, last updated"],
      api: ["Workspace store-backed"],
      storage: ["Workspace store; attachments in the media library"],
      permissions: "Plan feature `hrms`. HR publishes; everyone reads.",
    },
    demo: {
      goal: "Round out the HR story quickly.",
      minutes: 1,
      prep: ["Publish two policies in the demo workspace."],
      beats: [
        { screen: "Policies", say: "One current version, readable by everyone, inside the tool they use daily.", do: "Open a policy." },
      ],
      wow: "Policies stop living in an email attachment from 2019.",
    },
  },
  {
    key: "awards",
    title: "Awards & recognition",
    icon: "win",
    category: "People & HR",
    route: "/awards",
    audience: "HR, managers",
    feature: "hrms",
    summary: "Record and publish recognition — employee of the month and the like.",
    what:
      "A record of awards given to employees, published to the workspace, with a history per person that feeds appraisals.",
    why:
      "Recognition that only happens in a meeting is forgotten by the next one. A visible record makes it count and gives appraisals evidence.",
    features: [
      "Award records with category, recipient, date and citation.",
      "Published to the workspace feed.",
      "Per-employee history for appraisals.",
    ],
    steps: [
      { title: "Define your award types", detail: "Employee of the month, customer hero, best team — a short list used consistently." },
      { title: "Record the award with a citation", detail: "Two specific sentences beat a generic 'great work'." },
      { title: "Publish it", detail: "It appears for the workspace, which is the point of recognition." },
      { title: "Use it at appraisal time", detail: "Open the person's award history rather than relying on memory." },
    ],
    functional: {
      fields: ["Recipient, award type, date, citation, awarded by"],
      api: ["Workspace store-backed"],
      storage: ["Workspace store"],
      permissions: "Plan feature `hrms`; HR and managers create, everyone views.",
    },
    demo: {
      goal: "A warm, human beat in a long demo.",
      minutes: 1,
      prep: ["Seed two awards with real-sounding citations."],
      beats: [
        { screen: "Awards", say: "Recognition that's visible and remembered at appraisal time.", do: "Show the award feed." },
      ],
      wow: "Culture gets a system, not just an intention.",
    },
  },
  {
    key: "engagement",
    title: "Engagement",
    icon: "chat",
    category: "People & HR",
    route: "/engagement",
    audience: "HR, managers",
    feature: "hrms",
    summary: "Pulse checks and engagement activity across the team.",
    what:
      "Employee engagement tracking: pulse questions, participation and the activity that shows how connected the team is.",
    why:
      "Attrition is visible months in advance if anyone is looking. A light, regular pulse is cheaper than an exit interview.",
    features: [
      "Pulse questions to the team.",
      "Participation and response tracking.",
      "Trends over time rather than one-off surveys.",
    ],
    steps: [
      { title: "Ask something small and often", detail: "One question monthly beats a 30-question survey annually." },
      { title: "Share what you heard", detail: "Publish a summary as an announcement — silence after a survey kills the next one." },
      { title: "Act on one thing", detail: "Pick a single change per cycle and name it. That's what earns the next round of honesty." },
    ],
    functional: {
      fields: ["Question, audience, responses, period"],
      api: ["Workspace store-backed"],
      storage: ["Workspace store"],
      permissions: "Plan feature `hrms`; HR runs it, employees respond.",
    },
    demo: {
      goal: "Show HR depth beyond attendance and payroll.",
      minutes: 1,
      prep: ["Have one pulse with responses seeded."],
      beats: [
        { screen: "Engagement", say: "The people signal you normally only get at exit interviews.", do: "Open a pulse and show the responses." },
      ],
      wow: "You hear about a problem while you can still fix it.",
    },
  },
  {
    key: "posts",
    title: "Posts & notices",
    icon: "announcement",
    category: "People & HR",
    route: "/posts",
    audience: "HR, everyone",
    feature: "hrms",
    summary: "An internal feed for people news — joiners, events, celebrations.",
    what:
      "A workspace feed for HR and people news: new joiners, birthdays, events, celebrations — the softer counterpart to formal announcements.",
    why:
      "Distributed teams lose the informal glue that an office provides. A feed everyone sees is a cheap substitute for a noticeboard.",
    features: [
      "Post with text and images.",
      "Chronological workspace feed.",
      "Complements formal announcements and policies.",
    ],
    steps: [
      { title: "Post the human news", detail: "Joiners, milestones, events. Formal decisions belong in Announcements." },
      { title: "Add a picture", detail: "Posts with photos get read; text-only ones don't." },
      { title: "Keep it regular", detail: "A feed with one post a quarter isn't a feed." },
    ],
    functional: {
      fields: ["Author, body, images, posted date"],
      api: ["Workspace store-backed"],
      storage: ["Workspace store; images in the media library"],
      permissions: "Plan feature `hrms`. HR posts by default; administrators can widen it.",
    },
    demo: {
      goal: "Quick, warm, thirty seconds.",
      minutes: 1,
      prep: ["Seed three posts with images."],
      beats: [
        { screen: "Posts", say: "The noticeboard, for teams that don't share a building.", do: "Scroll the feed." },
      ],
      wow: "Remote teams keep a bit of office culture.",
    },
  },
  {
    key: "medical",
    title: "Medical records",
    icon: "ticket",
    category: "People & HR",
    route: "/medical",
    audience: "HR",
    feature: "hrms",
    summary: "Employee medical and insurance details, held carefully.",
    what:
      "A place for the medical and insurance information HR legitimately needs: insurance policy details, emergency contact, and any medical notes relevant to workplace safety.",
    why:
      "In an emergency, someone needs the insurance number and a contact immediately. Keeping that in a personnel folder in a locked cabinet fails exactly when it matters.",
    features: [
      "Insurance policy details per employee.",
      "Emergency contact information.",
      "Restricted to HR by permission.",
    ],
    steps: [
      { title: "Collect only what you need", detail: "Insurance, emergency contact, and anything genuinely required for workplace safety. Nothing else." },
      { title: "Restrict access", detail: "This module should be visible to HR alone — check the role matrix before entering any data." },
      { title: "Keep it current", detail: "Review annually with insurance renewal." },
      { title: "Know your obligations", detail: "Health data is regulated in most jurisdictions. Have a retention and consent position before you populate this." },
    ],
    functional: {
      fields: ["Employee, insurance provider and policy number, validity", "Emergency contact name and phone", "Notes"],
      api: ["Workspace store-backed"],
      storage: ["Workspace database / store, tenant-scoped"],
      permissions: "Plan feature `hrms`. Restrict to HR roles — this is the most sensitive personal data in the system.",
      notes: ["Health information is special-category data under most privacy laws; store the minimum and document why you hold it."],
    },
    demo: {
      goal: "Mention, don't dwell — and be seen to be careful.",
      minutes: 1,
      prep: ["Use obviously fake data in the demo workspace."],
      beats: [
        { screen: "Medical", say: "Insurance and emergency contacts, restricted to HR only — and we'd configure that before you enter a single record.", do: "Show the screen briefly and move on.", watch: "Careful handling here builds more trust than a feature list." },
      ],
      wow: "The information you need in an emergency is reachable in seconds, by exactly the people who should have it.",
    },
  },
  {
    key: "letters",
    title: "Letters",
    icon: "fileText",
    category: "People & HR",
    route: "/letters",
    audience: "HR",
    feature: "hrms",
    summary: "Generate offer, experience and salary letters from templates.",
    what:
      "Letter generation from templates: offer letters, appointment letters, experience and salary certificates, filled with employee data and issued on your letterhead.",
    why:
      "HR rewrites the same letter hundreds of times a year and mistypes a name or a date in a few of them. Templates fix both the time and the errors.",
    features: [
      "Templates for the standard letter types.",
      "Placeholders filled from the employee record.",
      "Branded, printable output.",
      "A record of what was issued to whom, and when.",
    ],
    steps: [
      { title: "Set up templates once", detail: "Have your standard letters reviewed, then load them with placeholders for name, designation, dates and salary." },
      { title: "Generate for an employee", detail: "Pick the employee and the template; the fields fill themselves." },
      { title: "Review before issuing", detail: "Read the generated letter once — templates fill fields, they don't apply judgement." },
      { title: "Keep the issue record", detail: "The record of what was issued protects you when a letter is later disputed." },
    ],
    functional: {
      fields: ["Template body with placeholders", "Employee, issue date, issued by, generated content"],
      api: ["Workspace store-backed; reads the employee directory"],
      storage: ["Workspace store"],
      permissions: "Plan feature `hrms`; HR only.",
      notes: ["Employment letters have legal weight — have your templates checked by a lawyer before first use."],
    },
    demo: {
      goal: "A visible HR time-saver.",
      minutes: 2,
      prep: ["Load one offer-letter template with placeholders and set the workspace letterhead branding."],
      beats: [
        { screen: "Letters", say: "The letter your HR person retypes forty times a year.", do: "Generate an experience letter for a seeded employee and open the print view.", watch: "HR managers ask about templates for their own formats — say yes, they're editable." },
      ],
      wow: "An experience letter takes ten seconds and never has the wrong date on it.",
    },
  },
  // ────────────────────────────── Administration ─────────────────────────────
  {
    key: "users",
    title: "Users & team",
    icon: "users",
    category: "Administration",
    route: "/users",
    audience: "Administrators",
    permission: "users",
    summary: "Create logins, set roles, activate and deactivate people.",
    what:
      "The team directory and the account control panel in one: add a person, give them a login and a role, and activate or deactivate them. Deactivating ends their sessions everywhere within seconds.",
    why:
      "Access control is the one administrative task that has to be right. Onboarding in a minute and offboarding in one click is what keeps a growing team's data safe.",
    features: [
      "Create a user with an email login and a first password.",
      "Assign a role, department, designation and reporting manager.",
      "Custom user fields defined in Admin Setup.",
      "Activate / deactivate — deactivation logs the person out within seconds, on every device.",
      "Reset a user's 2FA when they lose their phone.",
      "Per-user permission grants layered on top of the role.",
    ],
    steps: [
      { title: "Add the person", detail: "Name, email, phone, department, designation. The email is their login." },
      { title: "Pick the role", detail: "The role decides what they can see and do. Choose the narrowest role that lets them work." },
      { title: "Share credentials safely", detail: "Send the first password over a channel they control and ask them to change it immediately." },
      { title: "Grant extras only if needed", detail: "If one person needs one extra module, grant it on their user record rather than widening the role for everyone." },
      { title: "Offboard properly", detail: "Deactivate rather than delete — deletion loses the history attached to their name. Recover their assets first (Asset Assignments)." },
      { title: "Reset 2FA on request", detail: "Row menu → Reset 2FA lets them enrol a new phone." },
    ],
    functional: {
      fields: ["Name, email, phone, photo", "Role, department, designation, reporting manager", "Active flag, 2FA enabled", "Custom user fields"],
      api: ["GET/POST/PUT/DELETE /api/users", "POST /api/users/{id}/activate | deactivate | reset-2fa", "GET /api/team", "GET/POST /api/directory"],
      storage: ["`users` table (accounts) and the directory records for profile detail"],
      automations: [
        "Every signed-in client re-checks its account every 15 seconds, so deactivation takes effect almost immediately.",
        "Role changes apply on the user's next page load — no sign-out needed.",
      ],
      permissions: "Module `users`. create = add logins; edit = change roles and details; delete = remove accounts. Administrators bypass every check by design.",
      notes: ["Don't share one login between people — the audit trail becomes meaningless and you lose per-user reporting."],
    },
    demo: {
      goal: "Show that access control is real, and offboarding is instant.",
      minutes: 4,
      prep: [
        "Have a second browser signed in as a limited-role demo user, visible on screen.",
        "Prepare one role that visibly lacks a module, so the sidebar difference is obvious.",
      ],
      beats: [
        { screen: "Users", say: "Everyone gets their own login — never a shared one.", do: "Create a user live and assign a limited role." },
        { screen: "Limited user's sidebar", say: "And this is what that role actually sees. Finance isn't hidden behind a warning — it isn't there.", do: "Switch to the second browser.", watch: "Security buyers want exactly this demonstration; give it room." },
        { screen: "Deactivate", say: "And when someone leaves…", do: "Deactivate that user and let the second window bounce to login." },
      ],
      wow: "Onboarding takes a minute, offboarding takes one click and lands on every device in seconds.",
    },
    faqs: [
      { q: "Should I delete or deactivate a leaver?", a: "Deactivate. Their name stays attached to the leads, tickets and records they worked on; deletion breaks that history." },
    ],
  },
  {
    key: "activity-logs",
    title: "Activity logs",
    icon: "activity",
    category: "Administration",
    route: "/activity-logs",
    audience: "Administrators, auditors",
    permission: "users",
    summary: "The workspace audit trail: who did what, and when.",
    what:
      "A chronological log of meaningful actions across the workspace — records created, edited and deleted, with the user, the timestamp and what changed.",
    why:
      "Disputes about who changed a lead's owner or deleted a record end instantly when there's a log. It's also the first thing an auditor asks for.",
    features: [
      "Chronological entries across modules.",
      "Filter by user, module, action and date.",
      "Written automatically — users can't opt out of being logged.",
      "Clearing the log is an administrator-only action, itself deliberate.",
    ],
    steps: [
      { title: "Filter to the question", detail: "Start with the module and the date range, then narrow by user." },
      { title: "Read the change detail", detail: "Entries record what changed, not just that something did." },
      { title: "Use it in investigations", detail: "Before accusing anyone of anything, read the trail. It's usually a misunderstanding of a permission." },
      { title: "Retain deliberately", detail: "Clearing the log is possible for administrators — decide as a policy how long you keep it, and don't clear it casually." },
    ],
    functional: {
      fields: ["Actor, action, module, record reference, detail, timestamp"],
      api: ["GET /api/activity", "POST /api/activity", "DELETE /api/activity (clear)"],
      storage: ["`activity_log` table in the workspace database"],
      automations: ["Lead, user and record changes write log entries as a side effect of the action itself."],
      permissions: "Module `users`, in practice administrators only.",
    },
    demo: {
      goal: "Answer the governance question in a minute.",
      minutes: 2,
      prep: ["Make some changes in the demo workspace beforehand so the log isn't empty."],
      beats: [
        { screen: "Activity logs", say: "Every change has a name and a time against it.", do: "Filter to one user, then to one module." },
      ],
      wow: "Nothing changes in your workspace without a signature on it.",
    },
  },
  {
    key: "subscription",
    title: "Subscription & billing",
    icon: "star",
    category: "Administration",
    route: "/subscription",
    audience: "Administrators, owners",
    permission: "adminSetup",
    summary: "Your plan, what it unlocks, and your payment history.",
    what:
      "The workspace's own subscription: the current plan, the modules it unlocks, the renewal cycle, checkout for upgrades through Razorpay, and the history of payments made.",
    why:
      "Clients should be able to see what they're paying for and upgrade themselves, without emailing anyone.",
    features: [
      "Current plan with its feature list.",
      "Plan comparison and upgrade.",
      "Razorpay checkout per billing cycle.",
      "Payment history for the workspace.",
      "Locked modules explain which plan unlocks them.",
    ],
    steps: [
      { title: "Check your plan", detail: "The current plan and what it includes are at the top of the screen." },
      { title: "Understand a locked module", detail: "A locked item names the plan that unlocks it, so the decision is informed." },
      { title: "Upgrade", detail: "Pick the plan and cycle and pay through Razorpay checkout. Access changes as soon as payment is verified." },
      { title: "Keep the receipts", detail: "Billing history lists every payment with its reference." },
    ],
    functional: {
      fields: ["Plan id, billing cycle, amount, currency", "Payment reference, status, date"],
      api: ["GET /api/payments/config", "POST /api/payments/order", "POST /api/payments/verify", "GET /api/payments", "GET /api/platform for plan definitions"],
      storage: ["`subscription_payments` table per workspace; plans and their feature maps in the platform config"],
      automations: ["A verified payment updates the workspace's plan, which immediately changes which modules are visible."],
      permissions: "Module `adminSetup`; administrators and owners.",
      notes: ["Razorpay keys are configured by the platform owner; if checkout is unavailable the keys aren't set."],
    },
    demo: {
      goal: "Make the commercial conversation self-service and transparent.",
      minutes: 3,
      prep: ["Ensure the demo workspace sits on a mid plan so an upgrade path is visible.", "Confirm Razorpay test keys work if you intend to open checkout."],
      beats: [
        { screen: "Subscription", say: "You always see exactly what you're paying for.", do: "Show the current plan and its module list." },
        { screen: "Locked module", say: "And anything you don't have says which plan unlocks it — no mystery pricing.", do: "Open a locked module to show the message." },
        { screen: "Billing history", say: "Every payment, with its reference.", do: "Show the history." },
      ],
      wow: "Upgrades take a minute, and you can always see what you're paying for.",
    },
  },
  {
    key: "admin-setup",
    title: "Admin setup (overview)",
    icon: "settings",
    category: "Administration",
    route: "/admin-setup",
    audience: "Administrators",
    permission: "adminSetup",
    summary: "The configuration hub — every list, rule and look-and-feel setting.",
    what:
      "The configuration hub, grouped into Lead setup, Organisation, Support, Assets, HR and Appearance. Everything that makes the product fit your business is here, and it's the first place to go before rollout.",
    why:
      "Generic software feels generic until it uses your words. An hour in Admin Setup — your statuses, your departments, your roles, your branding — is what turns a demo into your system.",
    features: [
      "Lead setup: status, source, type, sub-status, custom lead fields.",
      "Organisation: departments, designations, roles & permissions, user fields, accounts & security.",
      "Support: ticket categories and priorities.",
      "Assets: asset categories and vendors.",
      "HR: shifts & timing, work locations, payroll settings.",
      "Appearance: branding, theme, menu, integrations, notifications.",
    ],
    steps: [
      { title: "Work top to bottom before go-live", detail: "The groups are ordered roughly the way you should configure them." },
      { title: "Start with the lists", detail: "Statuses, sources, departments and designations — everything else references these." },
      { title: "Then roles", detail: "Define roles before creating users, so nobody is created with the wrong access." },
      { title: "Then branding", detail: "Logo, colours and menu naming. This is what makes staff feel it's their system." },
      { title: "Finally integrations", detail: "Email, push and any third-party connections." },
      { title: "Revisit after a month", detail: "You'll know by then which statuses are unused and which fields nobody fills." },
    ],
    functional: {
      fields: ["Configuration only — this hub links to each sub-screen"],
      api: ["/api/config/{kind} for the lookup lists", "workspace store for field definitions and appearance"],
      storage: ["`config` tables and the workspace store"],
      permissions: "Module `adminSetup`; administrators.",
    },
    demo: {
      goal: "Convert 'nice product' into 'this could be ours'.",
      minutes: 3,
      prep: ["Have the prospect's own vocabulary ready — their stage names, their departments."],
      beats: [
        { screen: "Admin setup", say: "This is the hour that makes it yours.", do: "Walk the six groups without opening them all." },
        { screen: "Lead status list", say: "Your stages, in your words.", do: "Rename a status live to one of theirs.", watch: "Renaming in front of them is the single highest-leverage demo move there is." },
      ],
      wow: "Within an hour the system speaks your language, not ours.",
    },
  },
  {
    key: "setup-lead-lists",
    title: "Lead setup: status, source, type & fields",
    icon: "list",
    category: "Administration",
    route: "/admin-setup/status",
    audience: "Administrators",
    permission: "adminSetup",
    summary: "Define the pipeline vocabulary and the custom fields on a lead.",
    what:
      "The four lookup lists behind every lead — status, sub-status, source and type — plus the custom-field designer that adds your own fields to the lead form.",
    why:
      "These lists are the backbone of every report you'll ever run. Defining them deliberately at the start is worth more than any other configuration decision.",
    features: [
      "Status list with order, used by the pipeline chart.",
      "Sub-status for finer stages inside a status.",
      "Source list, which drives channel reporting.",
      "Type list (hot / warm / cold or your equivalent).",
      "Custom lead fields: text, number, date, dropdown, checkbox, required or optional.",
      "Reordering, so lists appear in a sensible order in every picker.",
    ],
    steps: [
      { title: "Write the statuses down first", detail: "On paper, with the team. Agree what each one means before typing them in." },
      { title: "Add them in pipeline order", detail: "Order matters — the pipeline chart and every dropdown follow it." },
      { title: "Keep sources specific", detail: "'Facebook — lead ad' tells you something; 'Online' doesn't." },
      { title: "Add only the custom fields you'll use", detail: "Every field is a question a rep has to answer. Add the three that change decisions, not the twelve that might be interesting." },
      { title: "Mark required fields carefully", detail: "A required field that reps can't always answer produces junk data." },
      { title: "Review after a month", detail: "Delete the statuses nobody used and the fields nobody filled." },
    ],
    functional: {
      fields: ["List item: name, order, colour, active flag", "Custom field: label, type, options, required flag, order"],
      api: ["GET/POST /api/config/{status|source|type|sub-status}", "PUT/DELETE /api/config/{kind}/{id}", "POST /api/config/{kind}/reorder"],
      storage: ["`config` tables in the workspace database; custom-field definitions in the workspace store"],
      automations: ["Changing a list updates every picker and filter immediately, across the workspace."],
      permissions: "Module `adminSetup`.",
      notes: ["Renaming a status is safe — leads follow it. Deleting one that leads still use is not; move those leads first."],
    },
    demo: {
      goal: "Prove the pipeline is configurable, not fixed.",
      minutes: 3,
      prep: ["Know two or three of the prospect's actual stage names before the call."],
      beats: [
        { screen: "Status setup", say: "You said you call it 'Site visit done' — so that's what it says.", do: "Rename a status, then open Leads to show the change everywhere.", watch: "Watch for the nod; that's the buying signal." },
        { screen: "Custom fields", say: "And the fields you qualify on are yours too.", do: "Add a field and show it on the lead form." },
      ],
      wow: "It's not our pipeline with your data in it — it's your pipeline.",
    },
  },
  {
    key: "setup-org",
    title: "Organisation: departments, designations & user fields",
    icon: "briefcase",
    category: "Administration",
    route: "/admin-setup/department",
    audience: "Administrators, HR",
    permission: "adminSetup",
    summary: "The org structure that users, HR and reporting all reference.",
    what:
      "Departments, job titles (designations) and the custom fields on a user record — the structure that users are filed under and that HR reporting depends on.",
    why:
      "Attendance by department, leave by team and headcount by function are only possible if the structure exists first. Retrofitting it after 60 users is painful.",
    features: [
      "Department list, referenced by users and HR reporting.",
      "Designation list for job titles.",
      "Custom user fields for whatever else you track (employee code, blood group, joining date).",
      "Reordering so pickers read sensibly.",
    ],
    steps: [
      { title: "Mirror your real org", detail: "Use the department names people actually say, not the ones on the org chart nobody reads." },
      { title: "Keep designations tidy", detail: "A short, consistent list — not one title per person." },
      { title: "Add the user fields you report on", detail: "Employee code and joining date usually earn their place; most others don't." },
      { title: "Then create users", detail: "Doing it in this order means nobody has to be edited twice." },
    ],
    functional: {
      fields: ["Department: name, order", "Designation: name, order", "User field: label, type, options, required"],
      api: ["/api/config/department", "/api/config/designation", "workspace store for user-field definitions"],
      storage: ["`config` tables; field definitions in the workspace store"],
      permissions: "Module `adminSetup`.",
    },
    demo: {
      goal: "Show the HR foundation being real, briefly.",
      minutes: 2,
      prep: ["Pre-load departments matching the prospect's own structure."],
      beats: [
        { screen: "Departments", say: "Your structure, so attendance and headcount report the way you think.", do: "Show the list and add one live." },
      ],
      wow: "Reporting lines up with how your business is actually organised.",
    },
  },
  {
    key: "setup-roles",
    title: "Roles & permissions",
    icon: "shield",
    category: "Administration",
    route: "/admin-setup/roles",
    audience: "Administrators",
    permission: "adminSetup",
    summary: "Build roles as a matrix of view / create / edit / delete per module.",
    what:
      "The permission matrix. Each role is a grid of modules against four actions — view, create, edit, delete — and every user carries one role. The sidebar, the route guard and the buttons on each page all read from it.",
    why:
      "Access should be designed once and applied consistently, not decided per person. A matrix makes the decision explicit and reviewable.",
    features: [
      "Roles you define, with any combination of module permissions.",
      "Four actions per module: view, create, edit, delete.",
      "Enforced in three places: the menu hides it, the route blocks it, the buttons disappear.",
      "Administrator roles bypass every check by design.",
      "Per-user extra grants layered on top, for the one person who needs one more module.",
      "Roles are stored in the backend, so they apply on every device instantly.",
    ],
    steps: [
      { title: "Start from the job, not the person", detail: "Sales rep, sales manager, HR, finance, support. Name roles after jobs and they'll still make sense in two years." },
      { title: "Grant view first, then actions", detail: "Without view, the other three do nothing — the module isn't reachable at all." },
      { title: "Be careful with delete", detail: "Delete is the permission that loses data. Most roles don't need it; managers usually do." },
      { title: "Test with a real login", detail: "Sign in as a user with the role in a second browser and try to reach a blocked page. Trust what you see, not the matrix." },
      { title: "Use per-user grants sparingly", detail: "One person needing one extra module is a user-level grant. Three people needing it is a new role." },
      { title: "Review quarterly", detail: "Permissions accumulate. Check what each role can do against what it should." },
    ],
    functional: {
      fields: ["Role name", "Matrix: module × {view, create, edit, delete}"],
      api: ["Roles are persisted through the workspace store / backend and merged per user at sign-in"],
      storage: ["Role definitions in the workspace store; the effective matrix is computed per user (role + extra grants)"],
      automations: [
        "The sidebar hides modules without view; the route guard blocks direct URLs; action buttons hide without the matching permission.",
        "Administrator, admin and owner roles are treated as full-access regardless of the matrix.",
      ],
      permissions: "Module `adminSetup`. Only administrators should hold this.",
      notes: [
        "Module keys group several screens: `financial` covers accounts, assets, inventory and vendors; `communication` covers Gmail, chat, WhatsApp, media and announcements.",
        "Action-level gating is fully applied on Users and Leads; other modules gate at view level plus their own action checks.",
      ],
    },
    demo: {
      goal: "Prove permissions are enforced, not decorative.",
      minutes: 4,
      prep: [
        "Create a 'Sales rep' role with no financial access before the call.",
        "Sign that user into a second browser window and have the URL of a finance page ready to paste.",
      ],
      beats: [
        { screen: "Role matrix", say: "Access is designed once, as a grid — not decided person by person.", do: "Open the sales-rep role and show the empty financial row." },
        { screen: "Rep's sidebar", say: "So finance simply isn't there for them.", do: "Switch to the second browser." },
        { screen: "Direct URL", say: "And typing the address doesn't help either.", do: "Paste the finance URL into the rep's browser and let it be blocked.", watch: "This is the beat that closes security-conscious buyers. Rehearse it." },
      ],
      wow: "Permissions hold at the menu, at the URL and at the button — not just at the menu.",
    },
  },
  {
    key: "setup-accounts",
    title: "Accounts & security",
    icon: "key",
    category: "Administration",
    route: "/admin-setup/accounts",
    audience: "Administrators",
    permission: "adminSetup",
    summary: "Login accounts, 2FA policy and session behaviour.",
    what:
      "The account-level security settings: which people have logins, whether two-step verification is expected, and the controls for activating, deactivating and resetting accounts.",
    why:
      "A CRM holds your customer list and your payroll. Account hygiene is the cheapest security you will ever buy.",
    features: [
      "See who has a login and its state.",
      "Activate / deactivate accounts, effective within seconds everywhere.",
      "Reset a user's 2FA enrolment.",
      "Works alongside the per-user 2FA switch in Profile.",
    ],
    steps: [
      { title: "Audit the account list", detail: "Everyone with a login should be someone who still works here and still needs it." },
      { title: "Push 2FA for privileged roles", detail: "At minimum administrators, finance and HR." },
      { title: "Deactivate leavers the same day", detail: "It is the single most important security habit in the whole product." },
      { title: "Reset 2FA on device changes", detail: "Reset, then have them enrol the new phone at their next sign-in." },
    ],
    functional: {
      fields: ["Account state (active / inactive), 2FA enabled, last activity"],
      api: ["POST /api/users/{id}/activate | deactivate | reset-2fa", "GET /api/auth/me"],
      storage: ["`users` table"],
      automations: ["The 15-second liveness check pushes deactivated users out of every open session."],
      permissions: "Module `adminSetup`; administrators.",
    },
    demo: {
      goal: "Reinforce the offboarding story with the policy view.",
      minutes: 2,
      prep: ["Have one account with 2FA enabled and one without, so the contrast is visible."],
      beats: [
        { screen: "Accounts & security", say: "Who can get in, and how strongly. Reviewed in one screen.", do: "Show the account list and the 2FA column." },
      ],
      wow: "Your access review is a screen, not a spreadsheet request to IT.",
    },
  },
  {
    key: "setup-catalogs",
    title: "Support, asset & vendor lists",
    icon: "grid",
    category: "Administration",
    route: "/admin-setup/ticket-category",
    audience: "Administrators",
    permission: "adminSetup",
    summary: "Ticket categories and priorities, asset categories, and the vendor list.",
    what:
      "The lookup lists behind the support and asset modules: ticket categories and priorities, asset categories (which also drive depreciation rules) and the vendor directory entry point.",
    why:
      "Categories decide what your reporting can tell you later. Ten minutes here decides whether 'what do customers complain about?' is answerable in a year.",
    features: [
      "Ticket categories, used for helpdesk routing and reporting.",
      "Ticket priorities with order, driving the queue.",
      "Asset categories, which group the register and set depreciation rules.",
      "Vendor list shared by bills, assets and inventory.",
    ],
    steps: [
      { title: "Design ticket categories around reporting", detail: "Ask what you'd want to count in a year, then create those categories." },
      { title: "Keep priorities to three or four", detail: "Five priorities means everything is priority two." },
      { title: "Set asset categories before adding assets", detail: "Re-categorising 200 assets later is a bad afternoon." },
      { title: "Add vendors as you engage them", detail: "One record per supplier, used everywhere." },
    ],
    functional: {
      fields: ["List item: name, order, colour where applicable", "Asset category: name, depreciation rule"],
      api: ["/api/config/ticket-category", "/api/config/ticket-priority", "/api/config/asset-category", "/api/vendors"],
      storage: ["`config` tables and the `vendors` table"],
      permissions: "Module `adminSetup`.",
    },
    demo: {
      goal: "Show configurability without spending demo time.",
      minutes: 1,
      prep: ["Pre-load categories in the prospect's language."],
      beats: [
        { screen: "Ticket categories", say: "Same idea as your lead stages — your words, everywhere.", do: "Show the list quickly and move on." },
      ],
      wow: "Every list in the product is yours to define.",
    },
  },
  {
    key: "setup-hr-config",
    title: "Shifts, locations & payroll settings",
    icon: "clock",
    category: "Administration",
    route: "/admin-setup/shifts",
    audience: "Administrators, HR",
    permission: "adminSetup",
    summary: "Work schedules, office locations and the rules payroll runs on.",
    what:
      "The HR configuration: shift definitions with start and end times and grace periods, work locations for multi-office businesses, and the payroll rules — cycle, components and statutory deductions.",
    why:
      "Attendance means nothing without a shift to measure against, and payroll can't run without components. This is the configuration that makes the whole HR side work.",
    features: [
      "Shifts with timings, grace period and weekly off pattern.",
      "Work locations, used by attendance and location-specific holidays.",
      "Payroll settings: pay cycle, earning and deduction components.",
      "Assignment of shifts to employees.",
    ],
    steps: [
      { title: "Define shifts to match reality", detail: "Include the grace period you actually apply, not the one in the handbook." },
      { title: "Add work locations", detail: "Needed for multi-office attendance and for holiday lists that differ by city." },
      { title: "Configure payroll components", detail: "Basic, allowances, deductions. Check statutory items against local rules — an accountant's half hour here saves a year of corrections." },
      { title: "Assign shifts to employees", detail: "Attendance flags late marks against the assigned shift; unassigned employees can't be assessed." },
      { title: "Run one test payroll", detail: "Run a month for two employees and check the arithmetic by hand before going live." },
    ],
    functional: {
      fields: ["Shift: name, start, end, grace, weekly off", "Location: name, address, geofence where used", "Payroll: cycle, component list with type and calculation"],
      api: ["/api/config/* for shifts and locations", "workspace store for payroll settings"],
      storage: ["`config` tables and the workspace store"],
      automations: ["Attendance derives late and short-hours flags from the assigned shift; payroll reads the component set for every run."],
      permissions: "Module `adminSetup`; administrators and HR.",
      notes: ["Statutory payroll rules differ by country and change over time — treat the components as configuration you own, not as tax advice."],
    },
    demo: {
      goal: "Show that HR is configurable to their actual working patterns.",
      minutes: 2,
      prep: ["Configure a shift that matches the prospect's working hours before the call."],
      beats: [
        { screen: "Shifts", say: "Your hours, your grace period — that's what late is measured against.", do: "Open the shift you configured." },
        { screen: "Payroll settings", say: "And your salary components, set once.", do: "Show the component list.", watch: "Expect country-specific statutory questions; note them rather than guessing." },
      ],
      wow: "Attendance and payroll follow your working patterns, not a template.",
    },
  },
  {
    key: "setup-branding",
    title: "Branding, theme & menu",
    icon: "image",
    category: "Administration",
    route: "/admin-setup/branding",
    audience: "Administrators",
    permission: "adminSetup",
    summary: "Your logo, colours, and the naming and order of the menu.",
    what:
      "The look of the workspace: logo, favicon, brand name and colours; the theme and sidebar styling; and the menu editor that renames, reorders, re-icons and hides navigation items.",
    why:
      "Staff adopt a system that looks like their company far faster than one that looks like a vendor's. It's the cheapest adoption lever available.",
    features: [
      "Logo and favicon upload, with size control.",
      "Brand name, tagline and primary colour.",
      "Theme and sidebar colours, icon style, density.",
      "Menu editor: rename, reorder, recolour, hide items.",
      "Printed documents (invoices, quotations, letters) inherit the branding.",
    ],
    steps: [
      { title: "Upload the logo", detail: "A transparent PNG works best. Set the size so it sits comfortably in the sidebar." },
      { title: "Set the primary colour", detail: "Use the brand hex code. It carries through buttons, highlights and printed documents." },
      { title: "Rename menu items", detail: "If your team says 'Enquiries' rather than 'Leads', change it. Training time drops immediately." },
      { title: "Hide what you don't use", detail: "An unused module in the menu is a permanent distraction. Hide it." },
      { title: "Check a printed document", detail: "Open an invoice's print view and confirm the logo and details are right before anything is sent." },
    ],
    functional: {
      fields: ["Logo, favicon, brand name, tagline, primary colour, logo sizing", "Theme, sidebar colours, icon style, density", "Menu: label, order, icon, colour, hidden flag per item"],
      api: ["Workspace store for appearance and nav (`nexus_appearance`, `nexus_nav_config`)", "GET /api/platform for the platform-level defaults"],
      storage: ["Workspace store; platform defaults come from the platform config and are overridden locally"],
      automations: ["Changes apply immediately for everyone in the workspace; the platform owner's defaults are the starting point."],
      permissions: "Module `adminSetup`.",
    },
    demo: {
      goal: "Make it their product, live, in ninety seconds.",
      minutes: 3,
      prep: [
        "Have the prospect's logo file downloaded from their website before the call.",
        "Have their brand hex colour ready.",
      ],
      beats: [
        { screen: "Branding", say: "Let's make this yours.", do: "Upload their logo and set their colour, then let the whole app repaint.", watch: "This is the most reliable 'wow' in the entire demo. Do it live, never in advance." },
        { screen: "Menu editor", say: "And it uses your words — you call them enquiries, so it says enquiries.", do: "Rename one menu item to their vocabulary." },
        { screen: "Invoice print view", say: "Right through to what your customer receives.", do: "Open a branded invoice." },
      ],
      wow: "Ninety seconds in, and it's your logo, your colours and your words — including on what your customers receive.",
    },
  },
  {
    key: "setup-integrations",
    title: "Integrations & notifications",
    icon: "plug",
    category: "Administration",
    route: "/admin-setup/integrations",
    audience: "Administrators",
    permission: "adminSetup",
    summary: "Connect email (Gmail or SMTP), web push and other services.",
    what:
      "Where the workspace connects to the outside world: Google/Gmail for the built-in mailbox, SMTP for plain sending, web push for browser notifications, and the notification preferences that decide what gets sent.",
    why:
      "Half the product's usefulness — sending quotes, emailing customers, reminding people — depends on a working mail path. Configure it once, properly, on day one.",
    features: [
      "Google connection for the Gmail mailbox (OAuth, no passwords stored).",
      "SMTP configuration for providers other than Google.",
      "Web push for browser notifications.",
      "Notification preferences by event type.",
      "A diagnostics endpoint for when mail doesn't send.",
    ],
    steps: [
      { title: "Choose your mail path", detail: "Google if you're on Workspace and want the in-app mailbox; SMTP if you just need sending." },
      { title: "Connect", detail: "Google uses OAuth — you approve access in a Google window and no password is stored. SMTP needs host, port, user and an app password." },
      { title: "Send a test", detail: "Do it before you rely on it. Quotation and invoice sending both depend on this path." },
      { title: "Enable web push", detail: "Grant the browser permission when prompted, then confirm a test notification arrives." },
      { title: "Tune notification preferences", detail: "Too many notifications get switched off entirely; pick the events that genuinely need attention." },
      { title: "If mail fails, diagnose", detail: "The Gmail diagnostics endpoint reports what's missing without exposing secrets." },
    ],
    functional: {
      fields: ["Google client id / secret and granted scopes", "SMTP host, port, encryption, username, password", "Push subscription and notification preferences"],
      api: ["/api/gmail/* including GET /api/gmail/diagnose", "/api/smtp/*", "/api/push/*"],
      storage: ["Credentials in the `settings` table server-side — never in the browser; preferences in the workspace store"],
      automations: ["OAuth tokens are refreshed automatically; an expired token is renewed rather than failing the send."],
      permissions: "Module `adminSetup`; administrators. Some integration options are plan-gated (`intgGoogle`, `intgEmail`, `intgPush`).",
      notes: ["If Google was connected before calendar scopes existed, reconnect once to grant them."],
    },
    demo: {
      goal: "Show that setup is short and doesn't involve a consultant.",
      minutes: 2,
      prep: ["Have the demo workspace's Google connection already working — never attempt a first OAuth flow live."],
      beats: [
        { screen: "Integrations", say: "Email, push, and you're connected. OAuth, so we never see a password.", do: "Show the connected state and send a test." },
      ],
      wow: "Go-live configuration is an afternoon, not a project.",
    },
  },
  // ────────────────────────── Platform (Super Admin) ─────────────────────────
  {
    key: "sa-overview",
    title: "Console overview",
    icon: "dashboard",
    category: "Platform (Super Admin)",
    route: "/admin",
    audience: "Platform owner only",
    summary: "The platform's own pulse: clients, demos, revenue and system state.",
    what:
      "The super-admin console home. It reports on the platform itself — how many client workspaces exist, demos booked from the landing page, subscription revenue and the health of the system — and is reached through its own login at /admin/login.",
    why:
      "Running a multi-tenant product means two jobs: the product, and the business around it. This console is the second job, and it is deliberately invisible to every client.",
    features: [
      "Client and workspace counts.",
      "Demos booked from the public landing page.",
      "Subscription and revenue summary.",
      "A customisable sidebar (order, icons, colours, density) stored in the platform database, so it follows you between machines.",
      "Quick actions: new client, compose mail, book demo, open the live site.",
    ],
    steps: [
      { title: "Sign in at /admin/login", detail: "Separate credentials from any client workspace. The console never appears in a client's sidebar." },
      { title: "Read the pulse", detail: "New clients, booked demos, revenue. It's the daily check." },
      { title: "Use quick actions", detail: "The four buttons above the menu cover most of what you do here." },
      { title: "Customise the rail", detail: "The customiser sets order, icons, colours and density; it's saved to the platform database, not to this browser." },
    ],
    functional: {
      fields: ["Aggregations across tenants, demos and payments"],
      api: ["/api/super-admin/* (login, profile, prefs)", "/api/tenants", "/api/platform", "/api/platform/demos"],
      storage: ["Platform `settings` table; console preferences under `superadmin_prefs`"],
      automations: ["Console preferences sync every 15 seconds, so a change made on one machine appears on another."],
      permissions: "Super-admin JWT only. Client administrators cannot reach these routes.",
      notes: ["Super-admin credentials are stored in the database `settings` table, not in .env, and can be rotated from the console."],
    },
    demo: {
      goal: "Internal — this is the screen you run the business from, not one you show clients.",
      minutes: 2,
      prep: ["Never share your screen on this console during a client call without checking what's on it first."],
      beats: [
        { screen: "Console overview", say: "(Internal) Daily check: new clients, demos booked, revenue.", do: "Review the pulse at the start of the day.", watch: "Client names from other companies are visible here — treat it as confidential." },
      ],
      wow: "One console for the whole platform business.",
    },
  },
  {
    key: "sa-clients",
    title: "Clients & workspaces",
    icon: "briefcase",
    category: "Platform (Super Admin)",
    route: "/admin/clients",
    audience: "Platform owner only",
    summary: "Create a client workspace — its own database, its own admin login.",
    what:
      "Client management: create a workspace for a new client, which provisions a dedicated database (tenant_<slug>) and seeds an administrator account, then manage the client's plan, status and details from the same list.",
    why:
      "Isolation per client is what makes the multi-tenant promise real. A shared table with a client id column is a data breach waiting for a bad WHERE clause; a separate database is not.",
    features: [
      "Create a client: company details, plan, admin contact.",
      "Provisioning creates the tenant database and seeds an admin login.",
      "Welcome credentials to hand over to the client.",
      "Plan assignment, which controls the modules the workspace can see.",
      "Client list with status and database name.",
    ],
    steps: [
      { title: "Collect the details first", detail: "Company name, admin's name and email, the plan they've bought." },
      { title: "Create the client", detail: "Provisioning creates the database and seeds the administrator account. Give it a moment on slower servers." },
      { title: "Hand over credentials", detail: "Use the welcome credentials view and send them over a channel the client controls. Ask them to change the password immediately." },
      { title: "Set the plan", detail: "The plan decides which modules the workspace sees; check it matches what they've paid for." },
      { title: "Verify before handing over", detail: "Sign in to the new workspace once yourself and confirm the branding and the seeded admin work." },
    ],
    functional: {
      fields: ["Company, slug, plan, admin name / email / password", "Database name, created date, status"],
      api: ["/api/tenants — list, create, sync"],
      storage: ["Client records in the platform database; each client's data in its own `tenant_<slug>` database"],
      automations: ["Creating a client runs CREATE DATABASE, applies the schema and seeds an administrator account."],
      permissions: "Super-admin only.",
      notes: [
        "Per-tenant login routing is not built yet — the main app authenticates against the default database; the per-client database is provisioned and ready ahead of that.",
        "Deleting a client does not automatically drop the database — that's deliberate, so a mistake isn't fatal.",
      ],
    },
    demo: {
      goal: "Internal — this is how you onboard a signed client.",
      minutes: 3,
      prep: ["Have the client's company details and admin contact ready before you start.", "Decide the plan before creating, not after."],
      beats: [
        { screen: "Clients", say: "(Internal) New client, own database, seeded admin.", do: "Create the workspace and copy the welcome credentials." },
        { screen: "Verification", say: "Always sign in once yourself before handing it over.", do: "Log into the new workspace and check branding.", watch: "Skipping this check is how a client's first impression gets ruined." },
      ],
      wow: "A signed client is live in minutes, on their own isolated database.",
    },
  },
  {
    key: "sa-database",
    title: "Database & backups",
    icon: "grid",
    category: "Platform (Super Admin)",
    route: "/admin/database",
    audience: "Platform owner only",
    summary: "Inspect any client database, and schedule and run backups.",
    what:
      "A read-only database inspector across the main and client databases — tables, structure and sample rows — plus backup scheduling, on-demand dumps and the list of stored backups.",
    why:
      "Support questions ('is that record actually saved?') are answered in seconds here instead of over SSH, and backups are the difference between an incident and a catastrophe.",
    features: [
      "Switch between the main database and any client database.",
      "Table list with row counts and sizes.",
      "Structure and sample data views.",
      "On-demand backup of the main or a client database.",
      "Scheduled backups with a cron entry you can copy.",
      "List of stored backups.",
    ],
    steps: [
      { title: "Pick the database", detail: "The main platform database, or the client you're investigating." },
      { title: "Find the table", detail: "Search by name; row counts tell you immediately whether data is arriving." },
      { title: "Check structure or data", detail: "Structure for schema questions, data for 'did that save?'." },
      { title: "Run a backup before anything risky", detail: "Before a migration or a bulk change, take a dump. It takes seconds." },
      { title: "Set the schedule", detail: "Configure the schedule in the console and add the cron entry it shows you on the server." },
      { title: "Test a restore", detail: "A backup you have never restored is a hope, not a backup. Test one on a scratch database." },
    ],
    functional: {
      fields: ["Read-only inspection; backup scope and schedule"],
      api: ["/api/db/databases | overview | table | data", "/api/db/schedule", "/api/db/backups", "/api/db/backup"],
      storage: ["Backups written on the server; the schedule in the platform settings"],
      automations: ["The scheduled job runs `php spark backup:run` from cron; the console shows the exact line to add."],
      permissions: "Super-admin only, self-guarded in the controller.",
      notes: ["Backups need mysqldump available on the server — if a dump produces no files, that's usually why."],
    },
    demo: {
      goal: "Internal — support and disaster-recovery tooling.",
      minutes: 2,
      prep: ["Confirm mysqldump works on the server before you rely on the schedule."],
      beats: [
        { screen: "Database", say: "(Internal) Answer 'did it save' without SSH.", do: "Open a client database and check a table's row count." },
        { screen: "Backups", say: "And take a dump before any risky change.", do: "Run an on-demand backup.", watch: "Verify a restore quarterly — put it in your calendar." },
      ],
      wow: "Support and recovery from a browser, with no server access needed.",
    },
  },
  {
    key: "sa-demos",
    title: "Demos & calendar",
    icon: "calendar",
    category: "Platform (Super Admin)",
    route: "/admin/demos",
    audience: "Platform owner only",
    summary: "Demos booked from the landing page, synced to Google Calendar and Meet.",
    what:
      "The demo pipeline: requests booked from the public landing page, with scheduling that syncs to Google Calendar and creates a Meet link through the connected Google account.",
    why:
      "A demo request that sits unanswered for a day is usually a lost deal. Having them land in a calendar with a meeting link removes every step between interest and a scheduled call.",
    features: [
      "Demo requests from the landing page with contact details.",
      "Schedule, reschedule and cancel.",
      "Google Calendar sync with a Meet link.",
      "Status tracking from requested to completed.",
    ],
    steps: [
      { title: "Check daily", detail: "Booked demos are the top of your own funnel — respond the same day." },
      { title: "Schedule it", detail: "Set the time; the calendar event and Meet link are created through the connected Google account." },
      { title: "Prepare using the demo station", detail: "Open the Documentation console's demo station for the modules that match the prospect's business, and do the prep items before the call." },
      { title: "Record the outcome", detail: "Mark completed or no-show. Your conversion rate on demos is a number worth knowing." },
    ],
    functional: {
      fields: ["Name, company, email, phone, requested date, notes", "Scheduled time, calendar event id, Meet link, status"],
      api: ["GET /api/platform/demos", "POST /api/platform/demos/book (public, from the landing page)", "POST /api/platform/demos", "Google Calendar via the connected OAuth account"],
      storage: ["Platform `settings` table under `platform.demos`"],
      automations: ["Scheduling creates the Google Calendar event and Meet link where the calendar scope has been granted."],
      permissions: "Super-admin only; the booking endpoint itself is public so the landing page can post to it.",
      notes: ["If Google was connected before the calendar scope was added, reconnect once — otherwise events won't be created."],
    },
    demo: {
      goal: "Internal — your own sales workflow.",
      minutes: 2,
      prep: ["Confirm the Google connection has the calendar scope before you rely on auto-scheduling."],
      beats: [
        { screen: "Demos", say: "(Internal) Landing-page requests, straight into your calendar with a Meet link.", do: "Schedule a demo and confirm the event was created." },
      ],
      wow: "From website interest to a calendar invite with a meeting link, without leaving the console.",
    },
  },
  {
    key: "sa-mail",
    title: "Platform mail",
    icon: "gmail",
    category: "Platform (Super Admin)",
    route: "/admin/mail",
    audience: "Platform owner only",
    summary: "The platform's own mailbox, for client and prospect correspondence.",
    what:
      "A mailbox in the console, using the platform's connected Google account, for correspondence with clients and prospects — welcome mails, demo follow-ups, renewal notices.",
    why:
      "Platform correspondence belongs next to the client list, not in a personal inbox that nobody else can see when you're away.",
    features: [
      "Read, search and compose from the platform account.",
      "Sits beside the client and demo lists.",
      "Uses the same OAuth connection as the rest of the platform.",
    ],
    steps: [
      { title: "Connect Google first", detail: "Super Admin → Settings → Google. Without it this screen has nothing to show." },
      { title: "Work the inbox", detail: "Demo requests and client questions land here." },
      { title: "Send welcome mail after provisioning", detail: "Right after creating a client, so credentials and context arrive together." },
    ],
    functional: {
      fields: ["To / cc / bcc, subject, body, attachments"],
      api: ["/api/gmail/* using the platform's connected account"],
      storage: ["Messages stay in Google; tokens in the platform `settings` table"],
      permissions: "Super-admin only.",
    },
    demo: {
      goal: "Internal — keep platform correspondence in one place.",
      minutes: 1,
      prep: ["Keep client names off screen if you're sharing this console for any reason."],
      beats: [
        { screen: "Mail", say: "(Internal) Client correspondence next to the client list.", do: "Open the inbox." },
      ],
      wow: "Platform correspondence lives with the platform, not in a personal inbox.",
    },
  },
  {
    key: "sa-settings",
    title: "Platform settings",
    icon: "settings",
    category: "Platform (Super Admin)",
    route: "/admin/settings",
    audience: "Platform owner only",
    summary: "Branding, landing page, plans, feature gating, payments, AI and integrations.",
    what:
      "The platform's own configuration: default branding every workspace inherits, the public landing page content, the subscription plans and exactly which modules each plan unlocks, Razorpay keys, the Google connection, the AI provider, push configuration and the super-admin credentials.",
    why:
      "This is where the commercial shape of the product is decided. The plan-to-feature matrix in particular is what turns a feature list into a price list.",
    features: [
      "Brand defaults: logo, favicon, name, colours — inherited by every client workspace.",
      "Landing page content: hero, features, plans, reviews.",
      "Subscription plans with price, period and highlight.",
      "Plan → feature matrix controlling which modules each plan unlocks.",
      "Razorpay keys for subscription checkout.",
      "Google (Gmail/Calendar/Meet), AI provider (Anthropic or free Groq) and web-push configuration.",
      "Super-admin credential rotation, with re-authentication.",
      "Default theme and menu that client workspaces start from.",
    ],
    steps: [
      { title: "Set the platform brand", detail: "Your logo, colours and name. Clients inherit these as their starting point and can override locally." },
      { title: "Write the landing page", detail: "Hero, features, plans and reviews all render on the public site from here." },
      { title: "Define plans and prices", detail: "Then set, per plan, exactly which modules are unlocked. This matrix is your pricing." },
      { title: "Connect payments", detail: "Razorpay key id and secret enable subscription checkout in every client workspace." },
      { title: "Connect Google and the AI provider", detail: "Google for mail, calendar and Meet; an Anthropic or Groq key to enable the AI assistant." },
      { title: "Rotate credentials deliberately", detail: "Changing super-admin credentials requires re-authentication. Store the new ones in a password manager before you save." },
    ],
    functional: {
      fields: ["brand, landing, plans, reviews, payment, google, automation, planFeatures, featureCatalog, appearance, nav"],
      api: ["GET /api/platform (public read — the landing page needs branding)", "POST /api/platform (super-admin)", "POST /api/super-admin/credentials"],
      storage: ["Platform `settings` table under `platform.config`"],
      automations: [
        "Newly added modules are granted to plans whose defaults include them, so an existing saved config never silently locks a new feature.",
        "Client workspaces inherit these defaults and layer their own overrides on top.",
      ],
      permissions: "Super-admin only for writes; reading the config is public because the landing page needs the branding.",
      notes: ["The Razorpay secret and Google client secret live in the database, not in .env — treat a database dump as containing secrets."],
    },
    demo: {
      goal: "Internal — this is where the product's commercial shape is set.",
      minutes: 3,
      prep: ["Never open this screen on a shared call; it holds keys and secrets."],
      beats: [
        { screen: "Plans & features", say: "(Internal) The matrix that decides what each plan unlocks — this is your pricing, expressed as configuration.", do: "Review the matrix before changing a price.", watch: "Removing a feature from a plan affects every existing workspace on it." },
      ],
      wow: "Pricing, packaging and branding are configuration, not a release.",
    },
  },
  {
    key: "sa-docs",
    title: "Documentation console",
    icon: "knowledge",
    category: "Platform (Super Admin)",
    route: "/admin/docs",
    audience: "Platform owner only",
    summary: "This manual: browse every module, attach screenshots and videos, run demos, export.",
    what:
      "The console you're reading this in. It holds the manual for every module in the product, lets you attach screenshots and walkthrough videos per module and per step, provides a full-screen demo station for client calls, and exports the whole thing as Markdown for a PDF or a help site.",
    why:
      "Documentation, sales demos and client training are the same content in three shapes. Keeping one source and publishing it into the product means the manual is never out of date, and clients see your screenshots inside their own Knowledge Base.",
    features: [
      "Every module documented: guide, functional reference, demo script, tips and FAQ.",
      "Attach screenshots and videos per module — uploaded files or YouTube / Vimeo / Loom / Drive links.",
      "Pin an image to a specific numbered step so it appears exactly where it's relevant.",
      "Demo station: a full-screen presenter view with prep list, beats and a timer.",
      "Coverage view showing which modules still have no media.",
      "Per-module private notes for your own team.",
      "Export the manual as Markdown, or print it as a PDF.",
      "Everything you publish appears in every client's Knowledge Base immediately.",
    ],
    steps: [
      { title: "Browse by category", detail: "The left rail groups modules the way the manual is organised. Search reaches every word, including the demo scripts." },
      { title: "Read the four tabs", detail: "Guide for clients, Functional for implementers and support, Demo station for sales calls, Media for the screenshots and videos." },
      { title: "Add a screenshot", detail: "Media tab → Add → upload a PNG or JPG. Give it a caption, and pin it to a step number if it illustrates one." },
      { title: "Add a video", detail: "Paste a YouTube, Vimeo, Loom or Drive link, or upload an MP4 directly. Uploaded files stream through the API and play inline." },
      { title: "Publish", detail: "Save publishes to the platform. Every client's Knowledge Base picks it up on their next load — there is nothing to deploy." },
      { title: "Run a demo", detail: "Open Demo station on the modules that match the prospect, do the prep items, then present with the beats on your second screen." },
      { title: "Export for a PDF or help site", detail: "Export Markdown for the whole manual or one module, or print the page to PDF for a client handbook." },
    ],
    functional: {
      fields: ["Per asset: module, kind (screenshot / video), title, caption, step pin, source (uploaded file or URL), order", "Per module: a private note"],
      api: [
        "GET /api/platform/docs — public read, used by client Knowledge Bases",
        "POST /api/platform/docs — super-admin, publishes the media set",
        "POST /api/platform/docs/upload — super-admin, multipart upload",
        "GET /api/platform/docs/file/{name} — streams an uploaded file, with range support for video scrubbing",
      ],
      storage: ["Media metadata in the platform `settings` table under `platform.docs`; uploaded files under public/uploads/docs"],
      automations: [
        "Uploaded media is addressed through the API rather than a static path, so one stored reference works locally and behind the production /api rewrite.",
        "Published media appears in every client workspace with no client-side action.",
      ],
      permissions: "Super-admin only for uploads and publishing. Reading is public so client workspaces can render the media.",
      notes: [
        "Upload size is capped by the server's PHP limits — for long videos, host on YouTube or Loom and paste the link instead.",
        "Accepted uploads: PNG, JPG, WebP, GIF, SVG, AVIF, MP4, WebM, OGG, MOV and PDF.",
      ],
    },
    demo: {
      goal: "Internal — how you prepare for and run every client demo.",
      minutes: 3,
      prep: [
        "Capture screenshots at a consistent window size — a 1440×900 browser window looks right in both the console and the client Knowledge Base.",
        "Use the demo workspace, not a real client's, for every screenshot.",
        "Keep videos under three minutes; anything longer doesn't get watched.",
      ],
      beats: [
        { screen: "Documentation", say: "(Internal) One source: the client manual, the functional reference and the demo script.", do: "Open a module and move through the four tabs." },
        { screen: "Media", say: "Screenshots and videos attach per module, and pin to the exact step they illustrate.", do: "Upload a screenshot and pin it to step 2." },
        { screen: "Demo station", say: "And before a call, this is the script — prep, beats, closing line.", do: "Open the demo station full-screen for the module you're about to present.", watch: "Run the prep list before the call, not during it." },
      ],
      wow: "One place to write the manual, publish the screenshots and run the demo — and clients see it all inside their own Knowledge Base.",
    },
    faqs: [
      { q: "Do clients see my private notes?", a: "No. Notes are for your own team; only screenshots, videos and their captions are rendered in the client Knowledge Base." },
      { q: "How big can an uploaded video be?", a: "It's limited by the server's PHP upload settings. If an upload fails, host the video on YouTube, Vimeo or Loom and paste the link — the player embeds it the same way." },
      { q: "How do I produce a client handbook?", a: "Export the whole manual as Markdown, or use the print action for a PDF that carries your branding." },
    ],
  },
];
