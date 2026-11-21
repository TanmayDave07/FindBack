import { getUser, escapeHtml } from "./api.js";
import { bindShell, shell } from "./ui.js";

const modules = { login: "auth", register: "auth", dashboard: "dashboard", "report-lost": "reportForm", "report-found": "reportForm", browse: "browse", "my-reports": "myReports", matches: "matches", admin: "admin" };
let renderNumber = 0;
export async function renderPage() {
  const number = ++renderNumber;
  const [path, search = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const route = path || (getUser() ? "dashboard" : "login");
  const params = new URLSearchParams(search);
  if (!getUser() && !["login", "register"].includes(route)) { location.hash = "/login"; return; }
  if (getUser() && ["login", "register"].includes(route)) { location.hash = "/dashboard"; return; }
  document.querySelector("#app-dialog")?.remove();
  document.documentElement.dataset.ready = "";
  document.querySelector("#app").setAttribute("aria-busy", "true");
  try {
    const page = await import(`./pages/${modules[route] || "dashboard"}.js`);
    const html = await page.render({ route, params });
    if (number !== renderNumber) return;
    document.querySelector("#app").innerHTML = html;
    bindShell(); page.bind?.({ route, params });
    document.title = `${document.querySelector("h1")?.textContent || "Campus lost and found"} · FindBack`;
    window.scrollTo(0,0);
  } catch (error) {
    if (number !== renderNumber) return;
    document.querySelector("#app").innerHTML = getUser() ? shell(route, "Could not load this page", "Your reports are still saved. Please try again.", `<div class="empty-state"><p>${escapeHtml(error.message)}</p><button class="btn btn--secondary" id="retry-page">Try again</button></div>`) : `<main id="main-content"><div class="empty-state"><h1>Could not open FindBack</h1><p>${escapeHtml(error.message)}</p><button class="btn btn--secondary" id="retry-page">Try again</button></div></main>`;
    bindShell(); document.querySelector("#retry-page").onclick = renderPage;
  } finally {
    if (number === renderNumber) { document.querySelector("#app").setAttribute("aria-busy", "false"); document.documentElement.dataset.ready = "true"; }
  }
}
