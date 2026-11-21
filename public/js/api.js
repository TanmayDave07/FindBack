const SESSION_KEY = "findback-session";
let session = null;
try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { sessionStorage.removeItem(SESSION_KEY); }

export function getUser() { return session?.user || null; }
export function setSession(data) {
  session = data;
  if (data) sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  else sessionStorage.removeItem(SESSION_KEY);
}

export async function api(path, options = {}) {
  const requestToken = session?.token;
  const headers = { ...options.headers };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (options.body) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`/api${path}`, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  } catch {
    throw new Error("Could not reach FindBack. Check your connection and try again.");
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && requestToken && session?.token === requestToken) {
      setSession(null);
      location.hash = "/login";
    }
    const error = new Error(data?.error || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function refreshSession() {
  if (!session?.token) return null;
  const { user } = await api("/auth/me");
  setSession({ ...session, user });
  return user;
}

export async function getMyReports() {
  const user = getUser();
  let page = 1;
  let reports = [];
  let total = 1;
  while (reports.length < total) {
    const data = await api(`/reports?page=${page}&limit=100`);
    reports.push(...data.reports);
    total = data.total;
    if (!data.reports.length) break;
    page++;
  }
  return reports.filter((report) => report.userId === user.id);
}

export function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function queryString(values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== "" && value !== undefined && value !== null) query.set(key, value);
  return query.toString();
}
