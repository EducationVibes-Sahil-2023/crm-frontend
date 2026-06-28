// In-app AI assistant ("Nexus AI").
//
// The assistant is an agent: it runs a tool-use loop against the live data in
// this app — Leads (localStorage intake store), HRMS (localStorage) and
// Inventory / Tasks (CodeIgniter backend). Every model call goes through the
// backend relay at /api/ai/chat so the Anthropic API key never reaches the
// browser. The loop (call → run tools → feed results back → repeat) is driven
// here on the client because the tools read client-side state.

import { getToken } from "@/lib/auth";
import { loadIntakeLeads } from "@/lib/leadStore";
import {
  listEmployees,
  loadLeaves,
  loadARs,
  loadMedical,
  loadPayslips,
  formatMoney,
} from "@/lib/hr";
import { inventoryApi, stockStatus, itemValue } from "@/lib/inventory";
import { api } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

// ---------- message / block shapes (Anthropic Messages API) ----------

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type ContentBlock = TextBlock | ToolUseBlock | { type: string; [k: string]: unknown };
export type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

type AssistantReply = { content: ContentBlock[]; stop_reason?: string };

export type ToolEvent = { name: string; label: string };

// ---------- system prompt ----------

export const SYSTEM_PROMPT = `You are Nexus AI, the built-in assistant for the Nexus CRM + HRMS platform.
You help staff manage Leads (sales/admissions pipeline), HRMS (employees, payroll, leave, attendance) and Inventory & assets.

Guidelines:
- Use the provided tools to look up real data before answering anything about leads, employees, payroll, leave, inventory or tasks. Never invent numbers — call a tool.
- Be concise and lead with the answer. Use short markdown-free sentences and compact lists; format currency as the tools return it (Indian rupees).
- When asked for "an overview", "how are we doing", or similar, combine the relevant tools and give a brief, useful summary with the key figures and anything that needs attention (low stock, pending approvals, overdue follow-ups).
- If a tool returns nothing, say so plainly instead of guessing.
- You can read and summarise data; you cannot yet create or edit records, so if asked to do so, explain how to do it in the app.`;

// ---------- tool definitions (sent to Claude) ----------

export const AI_TOOLS = [
  {
    name: "lead_overview",
    description:
      "Summary of the Leads pipeline: total leads, and counts broken down by status, source and type. Use for pipeline health questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_leads",
    description:
      "Search/filter leads. Returns matching leads with key fields. Use to find a specific person/company or list leads by status or city.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free text matched against name, company, email or phone." },
        status: { type: "string", description: "Exact lead status to filter by, e.g. New, Follow Up, Won." },
        city: { type: "string", description: "City to filter by." },
        limit: { type: "integer", description: "Max results (default 15)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "hr_overview",
    description:
      "HRMS summary: headcount, department breakdown, pending leave/attendance/medical approvals, and current payroll status.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_employees",
    description: "Search employees by name or department. Returns name, department, designation and email.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text matched against employee name or email." },
        department: { type: "string", description: "Department to filter by." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "inventory_overview",
    description:
      "Inventory summary: total items, total stock value, and which items are low or out of stock and need reordering.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "task_overview",
    description: "Task management summary: open vs completed task counts and the most recent open tasks.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// ---------- tool executors (run on the client against live data) ----------

const LABELS: Record<string, string> = {
  lead_overview: "Analysing the leads pipeline",
  search_leads: "Searching leads",
  hr_overview: "Reviewing HRMS",
  search_employees: "Searching employees",
  inventory_overview: "Checking inventory",
  task_overview: "Reviewing tasks",
};

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) || "—";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "lead_overview": {
      const leads = loadIntakeLeads().filter((l) => !l.deleted);
      const won = leads.filter((l) => /won|admission|enrolled|convert|closed won/i.test(l.status)).length;
      return JSON.stringify({
        total: leads.length,
        won,
        conversionRate: leads.length ? `${Math.round((won / leads.length) * 100)}%` : "0%",
        byStatus: countBy(leads, (l) => l.status),
        bySource: countBy(leads, (l) => l.source),
        byType: countBy(leads, (l) => l.type),
      });
    }
    case "search_leads": {
      const q = String(input.query ?? "").trim().toLowerCase();
      const status = String(input.status ?? "").trim().toLowerCase();
      const city = String(input.city ?? "").trim().toLowerCase();
      const limit = Math.min(50, Math.max(1, Number(input.limit) || 15));
      let leads = loadIntakeLeads().filter((l) => !l.deleted);
      if (q) leads = leads.filter((l) => `${l.name} ${l.company} ${l.email} ${l.phone}`.toLowerCase().includes(q));
      if (status) leads = leads.filter((l) => l.status.toLowerCase() === status);
      if (city) leads = leads.filter((l) => l.city.toLowerCase().includes(city));
      const total = leads.length;
      const rows = leads.slice(0, limit).map((l) => ({
        name: l.name, company: l.company, phone: l.phone, email: l.email,
        city: l.city, status: l.status, source: l.source, assignedTo: l.assignedTo ?? "—",
        followUpDate: l.followUpDate,
      }));
      return JSON.stringify({ total, showing: rows.length, leads: rows });
    }
    case "hr_overview": {
      const emps = listEmployees();
      const leaves = loadLeaves();
      const ars = loadARs();
      const medical = loadMedical();
      const slips = loadPayslips();
      const pendingPay = slips.filter((s) => s.status === "pending").length;
      return JSON.stringify({
        headcount: emps.length,
        byDepartment: countBy(emps, (e) => e.department),
        pendingApprovals: {
          leaves: leaves.filter((l) => l.status === "Pending").length,
          attendanceRegularisations: ars.filter((a) => a.status === "Pending").length,
          medicalClaims: medical.filter((m) => m.status === "Pending").length,
        },
        payroll: slips.length
          ? { latestMonth: slips[0]?.month, payslips: slips.length, pendingApproval: pendingPay }
          : "No payslips generated yet.",
      });
    }
    case "search_employees": {
      const q = String(input.query ?? "").trim().toLowerCase();
      const dept = String(input.department ?? "").trim().toLowerCase();
      let emps = listEmployees();
      if (q) emps = emps.filter((e) => `${e.name} ${e.email}`.toLowerCase().includes(q));
      if (dept) emps = emps.filter((e) => e.department.toLowerCase().includes(dept));
      return JSON.stringify({
        total: emps.length,
        employees: emps.slice(0, 30).map((e) => ({
          name: e.name, department: e.department, designation: e.designation,
          email: e.email, monthlyCtc: formatMoney(e.ctc),
        })),
      });
    }
    case "inventory_overview": {
      const items = await inventoryApi.list();
      const low = items.filter((i) => stockStatus(i) === "low");
      const out = items.filter((i) => stockStatus(i) === "out");
      const value = items.reduce((s, i) => s + itemValue(i), 0);
      return JSON.stringify({
        totalItems: items.length,
        totalStockValue: formatMoney(value),
        lowStock: low.map((i) => ({ name: i.name, sku: i.sku, quantity: Number(i.quantity), reorderLevel: Number(i.reorder_level) })),
        outOfStock: out.map((i) => ({ name: i.name, sku: i.sku })),
      });
    }
    case "task_overview": {
      const tasks = await api.listTasks();
      const open = tasks.filter((t) => t.is_done !== "1");
      return JSON.stringify({
        total: tasks.length,
        open: open.length,
        completed: tasks.length - open.length,
        recentOpen: open.slice(0, 10).map((t) => ({ title: t.title, created: t.created_at })),
      });
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

// ---------- the relay call + agentic loop ----------

async function callProxy(messages: ApiMessage[], systemExtra?: string): Promise<AssistantReply> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      system: systemExtra ? `${SYSTEM_PROMPT}\n\n${systemExtra}` : SYSTEM_PROMPT,
      tools: AI_TOOLS,
      thinking: { type: "adaptive" },
      max_tokens: 4096,
      messages,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.messages?.error ?? data?.error ?? `AI service error (${res.status})`;
    throw new Error(String(err));
  }
  return data as AssistantReply;
}

function textOf(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Run the assistant. `history` is the running Anthropic message list (the
 * caller appends the new user turn before calling). Returns the updated history
 * and the assistant's final text. `onTool` fires as each tool runs so the UI
 * can show progress.
 */
export async function ask(
  history: ApiMessage[],
  onTool?: (e: ToolEvent) => void,
  systemExtra?: string,
): Promise<{ messages: ApiMessage[]; text: string }> {
  const convo = [...history];

  for (let step = 0; step < 6; step++) {
    const reply = await callProxy(convo, systemExtra);
    convo.push({ role: "assistant", content: reply.content });

    const toolUses = (reply.content || []).filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );

    if (reply.stop_reason !== "tool_use" || toolUses.length === 0) {
      return { messages: convo, text: textOf(reply.content) || "(no response)" };
    }

    const results: ContentBlock[] = [];
    for (const tu of toolUses) {
      onTool?.({ name: tu.name, label: LABELS[tu.name] ?? `Running ${tu.name}` });
      let out: string;
      try {
        out = await runTool(tu.name, tu.input ?? {});
      } catch (e) {
        out = `Error: ${(e as Error).message}`;
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out } as ContentBlock);
    }
    convo.push({ role: "user", content: results });
  }

  return {
    messages: convo,
    text: "That needed too many steps — try asking something more specific.",
  };
}

export const SUGGESTIONS = [
  "Give me a pipeline overview",
  "Which inventory items need reordering?",
  "Any pending HR approvals?",
  "How many leads are in Follow Up?",
];
