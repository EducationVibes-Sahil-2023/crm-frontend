// A lightweight, shared user directory used for announcement audience targeting,
// task assignment and "view as" previews.
//
// A fresh workspace starts with NO team members — the list is empty until the
// admin adds real users. (Previously this returned 10 hardcoded sample
// counsellors, which made every assignee picker / Users page show fake people
// even on an empty database.)

export type DirectoryUser = {
  name: string;
  email: string;
  department: string;
  designation: string;
};

export const DEPARTMENT = "Counsellor";

const ALL: DirectoryUser[] = [];

export function listDirectory(): DirectoryUser[] {
  return ALL;
}

export function directoryDepartments(): string[] {
  return [DEPARTMENT];
}

export function findUser(email: string): DirectoryUser | undefined {
  return ALL.find((u) => u.email === email);
}

// How many directory users fall into a set of departments.
export function countInDepartments(departments: string[]): number {
  if (departments.length === 0) return 0;
  const set = new Set(departments);
  return ALL.filter((u) => set.has(u.department)).length;
}

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
