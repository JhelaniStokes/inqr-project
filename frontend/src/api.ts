export type ChecklistItem = { item: string; why: string; seen_on?: number };
export type Report = {
  strengths: string[];
  weaknesses: string[];
  checklist: ChecklistItem[];
  generated_at: string;
};
export type ReportResponse = { report: Report | null; submission_count: number; stale: boolean };
export type Submission = {
  id: number;
  title: string;
  feedback: string[];
  created_at: string;
  paper_text?: string;
};

export const getToken = () => localStorage.getItem("token");
export const setToken = (t: string | null) =>
  t ? localStorage.setItem("token", t) : localStorage.removeItem("token");

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken() ?? ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  signup: (username: string, password: string) =>
    req<{ token: string; username: string }>("POST", "/signup", { username, password }),
  login: (username: string, password: string) =>
    req<{ token: string; username: string }>("POST", "/login", { username, password }),
  logout: () => req("POST", "/logout"),
  me: () => req<{ username: string }>("GET", "/me"),
  createSubmission: (title: string, paper_text: string, feedback: string[]) =>
    req<{ id: number }>("POST", "/submissions", { title, paper_text, feedback }),
  listSubmissions: () => req<Submission[]>("GET", "/submissions"),
  getSubmission: (id: number) => req<Submission>("GET", `/submissions/${id}`),
  deleteSubmission: (id: number) => req("DELETE", `/submissions/${id}`),
  getReport: () => req<ReportResponse>("GET", "/report"),
  generateReport: () => req<ReportResponse>("POST", "/report/generate"),
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
