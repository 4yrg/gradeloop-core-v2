/**
 * Dummy student name mapping for demonstration purposes.
 * Maps submission/student IDs → human-readable names.
 */

export interface DummyStudent {
  name: string;
  initials: string;
  email: string;
  avatarColor: string; // tailwind bg class
  department: string;
  enrollmentYear: number;
}

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-lime-500",
  "bg-fuchsia-500",
];

/**
 * Complete mapping of every dummy ID used in syntactic + semantic sections.
 */
export const DUMMY_STUDENT_MAP: Record<string, DummyStudent> = {
  // ── Syntactic dummy clusters ──

  // Cluster A (real data may override; included for fallback)
  "fc85704b-3a1e-4d9f-b2c8-7e6f5a4d3c2b": {
    name: "Alex Morgan",
    initials: "AM",
    email: "alex.morgan@gradeloop.edu",
    avatarColor: "bg-red-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "2b3879d1-8c4f-4e7a-a1b3-9d8e7f6c5a4b": {
    name: "Brianna Chen",
    initials: "BC",
    email: "brianna.chen@gradeloop.edu",
    avatarColor: "bg-blue-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "27e280dc-5f3e-4b8c-9d1a-2c4b6e8f7a5d": {
    name: "Carlos Rivera",
    initials: "CR",
    email: "carlos.rivera@gradeloop.edu",
    avatarColor: "bg-green-500",
    department: "Computer Science",
    enrollmentYear: 2023,
  },

  // Cluster B
  "5ce3ba63-7d2f-4a6e-8b9c-1e3d5f7a9c8b": {
    name: "Diana Patel",
    initials: "DP",
    email: "diana.patel@gradeloop.edu",
    avatarColor: "bg-purple-500",
    department: "Software Engineering",
    enrollmentYear: 2024,
  },
  "3e587f9e-4c1a-4d8b-a7e6-2f9b8c3d5a1e": {
    name: "Ethan Nakamura",
    initials: "EN",
    email: "ethan.nakamura@gradeloop.edu",
    avatarColor: "bg-orange-500",
    department: "Software Engineering",
    enrollmentYear: 2024,
  },

  // Cluster C
  "93d8cf08-6b5a-4e3d-9c2f-8a7b4d1e6f3c": {
    name: "Fatima Al-Hassan",
    initials: "FA",
    email: "fatima.alhassan@gradeloop.edu",
    avatarColor: "bg-teal-500",
    department: "Computer Science",
    enrollmentYear: 2023,
  },
  "9295e171-2a8d-4f7c-b3e6-5c9a1d4f8b2e": {
    name: "George Kim",
    initials: "GK",
    email: "george.kim@gradeloop.edu",
    avatarColor: "bg-pink-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "d262b9fb-9e3c-4a5d-8b1f-6d7c2e4a9b3f": {
    name: "Hannah O'Brien",
    initials: "HO",
    email: "hannah.obrien@gradeloop.edu",
    avatarColor: "bg-indigo-500",
    department: "Computer Science",
    enrollmentYear: 2023,
  },

  // Cluster D
  "11bf0f07-1c4e-4d6a-a8b3-7f5e9d2c1a8b": {
    name: "Ivan Petrov",
    initials: "IP",
    email: "ivan.petrov@gradeloop.edu",
    avatarColor: "bg-cyan-500",
    department: "Information Systems",
    enrollmentYear: 2024,
  },
  "a4bfc312-8d6f-4c2e-b5a1-3e9d7c8f4b6a": {
    name: "Julia Santos",
    initials: "JS",
    email: "julia.santos@gradeloop.edu",
    avatarColor: "bg-amber-500",
    department: "Information Systems",
    enrollmentYear: 2024,
  },

  // ── Semantic dummy submissions ──

  "sub-a1b2": {
    name: "Kevin Liu",
    initials: "KL",
    email: "kevin.liu@gradeloop.edu",
    avatarColor: "bg-emerald-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "sub-c3d4": {
    name: "Laura Martinez",
    initials: "LM",
    email: "laura.martinez@gradeloop.edu",
    avatarColor: "bg-violet-500",
    department: "Computer Science",
    enrollmentYear: 2023,
  },
  "sub-e5f6": {
    name: "Michael Thompson",
    initials: "MT",
    email: "michael.thompson@gradeloop.edu",
    avatarColor: "bg-rose-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "sub-g7h8": {
    name: "Nadia Okafor",
    initials: "NO",
    email: "nadia.okafor@gradeloop.edu",
    avatarColor: "bg-sky-500",
    department: "Computer Science",
    enrollmentYear: 2023,
  },
  "sub-i9j0": {
    name: "Oscar Dubois",
    initials: "OD",
    email: "oscar.dubois@gradeloop.edu",
    avatarColor: "bg-lime-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "sub-k1l2": {
    name: "Priya Sharma",
    initials: "PS",
    email: "priya.sharma@gradeloop.edu",
    avatarColor: "bg-fuchsia-500",
    department: "Software Engineering",
    enrollmentYear: 2024,
  },
  "sub-m3n4": {
    name: "Quinn Anderson",
    initials: "QA",
    email: "quinn.anderson@gradeloop.edu",
    avatarColor: "bg-red-500",
    department: "Software Engineering",
    enrollmentYear: 2023,
  },
  "sub-o5p6": {
    name: "Ravi Gupta",
    initials: "RG",
    email: "ravi.gupta@gradeloop.edu",
    avatarColor: "bg-blue-500",
    department: "Software Engineering",
    enrollmentYear: 2024,
  },
  "sub-q7r8": {
    name: "Sophia Wang",
    initials: "SW",
    email: "sophia.wang@gradeloop.edu",
    avatarColor: "bg-green-500",
    department: "Computer Science",
    enrollmentYear: 2023,
  },
  "sub-s9t0": {
    name: "Tariq Hassan",
    initials: "TH",
    email: "tariq.hassan@gradeloop.edu",
    avatarColor: "bg-purple-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "sub-u1v2": {
    name: "Uma Krishnan",
    initials: "UK",
    email: "uma.krishnan@gradeloop.edu",
    avatarColor: "bg-orange-500",
    department: "Computer Science",
    enrollmentYear: 2024,
  },
  "sub-w3x4": {
    name: "Victor Zhang",
    initials: "VZ",
    email: "victor.zhang@gradeloop.edu",
    avatarColor: "bg-teal-500",
    department: "Computer Science",
    enrollmentYear: 2023,
  },
};

/**
 * Look up a student name for any ID. Falls back to a generated name
 * from the first 8 chars if the ID isn't in the map.
 */
export function getStudentName(id: string): string {
  return DUMMY_STUDENT_MAP[id]?.name ?? `Student ${id.substring(0, 8)}`;
}

/**
 * Look up initials for the avatar fallback.
 */
export function getStudentInitials(id: string): string {
  return DUMMY_STUDENT_MAP[id]?.initials ?? id.substring(0, 2).toUpperCase();
}

/**
 * Get the avatar background color.
 */
export function getStudentColor(id: string): string {
  if (DUMMY_STUDENT_MAP[id]) return DUMMY_STUDENT_MAP[id].avatarColor;
  // Deterministic color from hash
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Full student profile data.
 */
export function getStudentProfile(id: string): DummyStudent {
  return (
    DUMMY_STUDENT_MAP[id] ?? {
      name: `Student ${id.substring(0, 8)}`,
      initials: id.substring(0, 2).toUpperCase(),
      email: `${id.substring(0, 8)}@gradeloop.edu`,
      avatarColor: getStudentColor(id),
      department: "Unknown",
      enrollmentYear: 2024,
    }
  );
}
