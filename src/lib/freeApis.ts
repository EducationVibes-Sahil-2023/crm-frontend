// Free / freemium third-party API integrations — configured in Admin Setup → Integrations.
import type { IconName } from "@/components/icons";

export type FreeApiMeta = {
  key: string;
  name: string;
  desc: string;
  field: string; // label for the credential input
  placeholder: string;
  icon: IconName;
  tag: string; // "Free", "Free tier", …
  secret?: boolean; // mask the credential
  docs: string;
};

export const FREE_APIS: FreeApiMeta[] = [
  { key: "telegram", name: "Telegram Bot", desc: "Send notifications via a Telegram bot.", field: "Bot token", placeholder: "123456:ABC-DEF…", icon: "send", tag: "Free", secret: true, docs: "https://core.telegram.org/bots/api" },
  { key: "slack", name: "Slack", desc: "Post alerts to a Slack channel.", field: "Incoming webhook URL", placeholder: "https://hooks.slack.com/services/…", icon: "chat", tag: "Free", docs: "https://api.slack.com/messaging/webhooks" },
  { key: "discord", name: "Discord", desc: "Send messages to a Discord channel.", field: "Webhook URL", placeholder: "https://discord.com/api/webhooks/…", icon: "message", tag: "Free", docs: "https://discord.com/developers/docs/resources/webhook" },
  { key: "sendgrid", name: "SendGrid", desc: "Transactional email (100/day free).", field: "API key", placeholder: "SG.…", icon: "gmail", tag: "Free tier", secret: true, docs: "https://docs.sendgrid.com" },
  { key: "mailgun", name: "Mailgun", desc: "Email sending API (free trial).", field: "API key", placeholder: "key-…", icon: "gmail", tag: "Free tier", secret: true, docs: "https://documentation.mailgun.com" },
  { key: "whatsapp", name: "WhatsApp Cloud API", desc: "Send WhatsApp messages (Meta free tier).", field: "Access token", placeholder: "EAAG…", icon: "phone", tag: "Free tier", secret: true, docs: "https://developers.facebook.com/docs/whatsapp" },
  { key: "fcm", name: "Firebase Cloud Messaging", desc: "Free push notifications to devices.", field: "Server key", placeholder: "AAAA…", icon: "bell", tag: "Free", secret: true, docs: "https://firebase.google.com/docs/cloud-messaging" },
  { key: "openweather", name: "OpenWeather", desc: "Weather data by location.", field: "API key", placeholder: "8f2c…", icon: "visitor", tag: "Free", secret: true, docs: "https://openweathermap.org/api" },
  { key: "ipinfo", name: "IPInfo", desc: "Geolocate lead & visitor IPs.", field: "Access token", placeholder: "abc123…", icon: "pin", tag: "Free tier", secret: true, docs: "https://ipinfo.io/developers" },
  { key: "recaptcha", name: "Google reCAPTCHA", desc: "Bot protection for public forms.", field: "Site key", placeholder: "6Lc…", icon: "win", tag: "Free", docs: "https://developers.google.com/recaptcha" },
  { key: "razorpay", name: "Razorpay", desc: "Collect payments (test mode free).", field: "Key ID", placeholder: "rzp_test_…", icon: "payment", tag: "Free test", docs: "https://razorpay.com/docs" },
  { key: "exchangerate", name: "ExchangeRate-API", desc: "Live currency conversion rates.", field: "API key", placeholder: "a1b2c3…", icon: "revenue", tag: "Free", secret: true, docs: "https://www.exchangerate-api.com" },
  { key: "cloudinary", name: "Cloudinary", desc: "Media storage & CDN (free tier).", field: "Environment URL", placeholder: "cloudinary://…", icon: "image", tag: "Free tier", secret: true, docs: "https://cloudinary.com/documentation" },
  { key: "zoom", name: "Zoom", desc: "Create meetings (free tier).", field: "JWT / account token", placeholder: "eyJ…", icon: "videoCam", tag: "Free tier", secret: true, docs: "https://developers.zoom.us" },
];

export type FreeApiEntry = { enabled: boolean; credential: string };
export type FreeApiConfig = Record<string, FreeApiEntry>;

export function defaultFreeApis(): FreeApiConfig {
  return Object.fromEntries(FREE_APIS.map((a) => [a.key, { enabled: false, credential: "" }]));
}

const STORAGE_KEY = "free_apis_v1";

export function loadFreeApis(): FreeApiConfig {
  const cfg = defaultFreeApis();
  if (typeof window === "undefined") return cfg;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cfg;
    const parsed = JSON.parse(raw) as Partial<FreeApiConfig>;
    for (const a of FREE_APIS) {
      const e = parsed[a.key];
      if (e) cfg[a.key] = { enabled: !!e.enabled, credential: typeof e.credential === "string" ? e.credential : "" };
    }
  } catch {
    // ignore — fall back to defaults
  }
  return cfg;
}

export function saveFreeApis(cfg: FreeApiConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function countEnabledFreeApis(cfg: FreeApiConfig): number {
  return FREE_APIS.filter((a) => cfg[a.key]?.enabled).length;
}
