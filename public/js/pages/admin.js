import { api, escapeHtml, getUser } from "../api.js";
import { bindImages, date, dialog, empty, icon, shell, toast } from "../ui.js";
import { bindForm, formMarkup } from "./reportForm.js";
import { renderPage } from "../router.js";

export async function render({ params }) {
  if (getUser().role !== "ADMIN") return shell("admin","Administrator access required","This page is available to campus administrators.",empty("This page is for administrators","You can manage your own reports from My reports.",'<a class="btn btn--secondary" href="#/my-reports">View my reports</a>'));
  const page = Number(params.get("page") || 1);
  const [{users}, reports] = await Promise.all([api("/admin/users"),api(`/reports?limit=20&page=${page}`)]);
  const content = `<div class="stats"><div class="stat"><span class="stat-label">Campus members${icon("users",18)}</span><strong class="stat-value">${users.length}</strong></div><div class="stat"><span class="stat-label">Total reports${icon("file",18)}</span><strong class="stat-value">${reports.total}</strong></div></div>
    <div class="panel"><div class="section-head"><h2>Campus reports</h2><a class="text-button" href="#/browse?status=all">Browse all reports ${icon("arrow",16)}</a></div><div class="table-wrap"><table><thead><tr><th>Item</th><th>Reported by</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>${reports.reports.map((report) => `<tr><td>${escapeHtml(report.title)}</td><td>${escapeHtml(report.user.name)}</td><td>${report.type}</td><td><select class="admin-status" data-status="${report.id}" aria-label="Status for ${escapeHtml(report.title)}">${["ACTIVE","MATCHED","RESOLVED","CLOSED"].map((status) => `<option ${report.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></td><td><button class="text-button" data-edit="${report.id}">Edit report</button><a class="text-button" href="#/matches?report=${report.id}">View matches</a></td></tr>`).join("") || '<tr><td colspan="5">No campus reports yet.</td></tr>'}</tbody></table></div>${reports.total > 20 ? `<div class="pagination"><span>Page ${reports.page} of ${Math.ceil(reports.total/20)}</span><div class="pagination-controls">${reports.page > 1 ? `<a class="btn btn--secondary" href="#/admin?page=${reports.page-1}">Previous page</a>` : ""}${reports.page*20 < reports.total ? `<a class="btn btn--secondary" href="#/admin?page=${reports.page+1}">Next page</a>` : ""}</div></div>` : ""}</div>
    <div class="panel" style="margin-top:28px"><div class="section-head"><h2>Campus members</h2></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>${users.map((user) => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${user.role === "ADMIN" ? "Administrator" : "Student"}</td><td>${date(user.createdAt)}</td></tr>`).join("")}</tbody></table></div></div>`;
  return shell("admin","Manage platform","Review campus reports and manage their status using your administrator access.",content);
}
export function bind() {
  document.querySelectorAll("[data-status]").forEach((select) => select.onchange = async () => {
    select.disabled = true;
    try { await api(`/reports/${select.dataset.status}`, {method:"PATCH",body:{status:select.value}}); toast("Report status updated."); }
    catch(error) { toast(error.message); await renderPage(); }
    finally { select.disabled = false; }
  });
  document.querySelectorAll("[data-edit]").forEach((button) => button.onclick = async () => {
    try { const {report} = await api(`/reports/${button.dataset.edit}`); const target = dialog("Edit campus report",await formMarkup(report.type,report)); bindForm(target.querySelector("form"),async () => { target.close(); await renderPage(); }); }
    catch(error) { toast(error.message); }
  });
}
