// A lightweight, shared user directory used for announcement audience targeting,
// task assignment and "view as" previews. Deterministic so it stays stable
// across renders, and mirrors the team shown on the Users page.
//
// The organisation has a single Counsellor department with 10 members.

export type DirectoryUser = {
  name: string;
  email: string;
  department: string;
  designation: string;
};

export const DEPARTMENT = "Counsellor";

const COUNSELLORS: { first: string; last: string; designation: string }[] = [
  { first: "Aarav", last: "Sharma", designation: "Senior Counsellor" },
  { first: "Diya", last: "Patel", designation: "Academic Counsellor" },
  { first: "Vivaan", last: "Reddy", designation: "Career Counsellor" },
  { first: "Ananya", last: "Nair", designation: "Admissions Counsellor" },
  { first: "Aditya", last: "Iyer", designation: "Student Counsellor" },
  { first: "Ishaan", last: "Gupta", designation: "Senior Counsellor" },
  { first: "Saanvi", last: "Mehta", designation: "Academic Counsellor" },
  { first: "Kabir", last: "Khanna", designation: "Career Counsellor" },
  { first: "Myra", last: "Joshi", designation: "Admissions Counsellor" },
  { first: "Arjun", last: "Verma", designation: "Student Counsellor" },
];

const ALL: DirectoryUser[] = COUNSELLORS.map((c) => ({
  name: `${c.first} ${c.last}`,
  email: `${c.first.toLowerCase()}.${c.last.toLowerCase()}@educationvibes.in`,
  department: DEPARTMENT,
  designation: c.designation,
}));

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
