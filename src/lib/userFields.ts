// Which User-form fields are mandatory — configurable in Admin Setup.

export type UserFieldKey =
  | "name" | "email" | "phone" | "designation" | "department" | "role"
  | "companyCode" | "joiningDate" | "city" | "state" | "address" | "zip"
  | "bio" | "password" | "linkedin" | "twitter" | "github";

export const USER_FIELDS: { key: UserFieldKey; label: string; locked?: boolean }[] = [
  { key: "name", label: "Full Name", locked: true },
  { key: "email", label: "Email", locked: true },
  { key: "phone", label: "Phone Number" },
  { key: "designation", label: "Designation" },
  { key: "department", label: "Department" },
  { key: "role", label: "Role" },
  { key: "companyCode", label: "Company Code" },
  { key: "joiningDate", label: "Joining Date" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "address", label: "Address" },
  { key: "zip", label: "Zip" },
  { key: "bio", label: "Bio" },
  { key: "password", label: "Password" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "Twitter" },
  { key: "github", label: "GitHub" },
];

/** field key -> required? */
export type FieldConfig = Record<UserFieldKey, boolean>;

export const DEFAULT_FIELD_CONFIG: FieldConfig = {
  name: true, email: true, phone: false, designation: true, department: true, role: true,
  companyCode: false, joiningDate: false, city: false, state: false, address: false, zip: false,
  bio: false, password: true, linkedin: false, twitter: false, github: false,
};

const STORAGE_KEY = "user_field_config_v1";

export function loadFieldConfig(): FieldConfig {
  const cfg: FieldConfig = { ...DEFAULT_FIELD_CONFIG };
  if (typeof window === "undefined") return cfg;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FieldConfig>;
      for (const f of USER_FIELDS) {
        if (typeof parsed[f.key] === "boolean") cfg[f.key] = parsed[f.key] as boolean;
      }
    }
  } catch {
    // ignore — fall back to defaults
  }
  // Locked fields are always required.
  for (const f of USER_FIELDS) if (f.locked) cfg[f.key] = true;
  return cfg;
}

export function saveFieldConfig(cfg: FieldConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}
