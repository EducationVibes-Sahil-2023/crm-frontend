// Subscription payments via Razorpay Checkout. Talks to the backend
// /api/payments/* endpoints (per-tenant `subscription_payments` table) and
// drives the Razorpay checkout popup. Every attempt is recorded server-side.

import { getToken, getUser } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

export type PayConfig = { enabled: boolean; keyId: string; currency: string };

export type Payment = {
  id: number;
  planId: string;
  planName: string;
  cycle: string;
  amount: number; // smallest unit (paise/cents)
  currency: string;
  status: "created" | "paid" | "failed" | string;
  orderId: string;
  paymentId: string;
  payerEmail: string;
  paidAt: string | null;
  createdAt: string | null;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json", ...(init?.headers as Record<string, string>) });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.messages?.error ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const paymentsApi = {
  config: (): Promise<PayConfig> => req<PayConfig>("/payments/config"),
  list: async (): Promise<Payment[]> => (await req<{ payments: Payment[] }>("/payments")).payments ?? [],
  createOrder: (body: { planId: string; planName: string; cycle: string; amount: number; email?: string; name?: string }) =>
    req<{ orderId: string; amount: number; currency: string; keyId: string }>("/payments/order", { method: "POST", body: JSON.stringify(body) }),
  verify: (body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    req<{ ok: boolean; payment: Payment }>("/payments/verify", { method: "POST", body: JSON.stringify(body) }),
};

// ---- Razorpay Checkout glue ----

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpFailure = { error?: { description?: string } };
type RzpOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler: (r: RzpResponse) => void;
  modal?: { ondismiss?: () => void };
};
type RzpInstance = { open: () => void; on: (event: string, cb: (r: RzpFailure) => void) => void };
type RzpCtor = new (options: RzpOptions) => RzpInstance;

declare global {
  interface Window { Razorpay?: RzpCtor }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<RzpCtor> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Checkout is only available in the browser."));
    if (window.Razorpay) return resolve(window.Razorpay);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay failed to initialise.")));
    if (existing) {
      existing.addEventListener("load", onload, { once: true });
      existing.addEventListener("error", () => reject(new Error("Couldn't load Razorpay checkout.")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = onload;
    s.onerror = () => reject(new Error("Couldn't load Razorpay checkout. Check your connection."));
    document.body.appendChild(s);
  });
}

/**
 * Run the full subscribe flow for a plan: create an order, open Razorpay
 * Checkout, verify the signature. Resolves with the verified Payment, or
 * throws (cancelled / failed / not configured) — all surfaced to the caller.
 */
export async function payForPlan(plan: {
  id: string;
  name: string;
  amount: number; // major units (e.g. 79 for ₹79 / $79)
  cycle: string;
  appName?: string;
}): Promise<Payment> {
  const cfg = await paymentsApi.config();
  if (!cfg.enabled) {
    throw new Error("Online payments aren't set up yet. Ask your admin to add Razorpay keys in Platform Settings.");
  }
  const Razorpay = await loadCheckout();
  const user = getUser();
  const order = await paymentsApi.createOrder({
    planId: plan.id,
    planName: plan.name,
    cycle: plan.cycle,
    amount: plan.amount,
    email: user?.email,
    name: user?.name,
  });

  return new Promise<Payment>((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: plan.appName || "Subscription",
      description: `${plan.name} plan · ${plan.cycle}`,
      order_id: order.orderId,
      prefill: { email: user?.email, name: user?.name },
      theme: { color: "#2563eb" },
      handler: (resp) => {
        paymentsApi
          .verify({
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          })
          .then((v) => resolve(v.payment))
          .catch(reject);
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    rzp.on("payment.failed", (r) => reject(new Error(r?.error?.description || "Payment failed. Please try again.")));
    rzp.open();
  });
}

/** Format a smallest-unit amount for display, e.g. (7900, "INR") -> "₹79". */
export function formatAmount(amount: number, currency: string): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: major % 1 === 0 ? 0 : 2 }).format(major);
  } catch {
    return `${major} ${currency}`;
  }
}
