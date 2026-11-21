import { api, escapeHtml, getMyReports } from "../api.js";
import { badge, bindImages, date, dialog, empty, image, shell, toast } from "../ui.js";
import { bindForm, formMarkup } from "./reportForm.js";
import { renderPage } from "../router.js";

export async function render({ params }) {
  const reports = await getMyReports();
  const status = params.get("status") || "all";
  const visible = reports.filter((report) => status === "all" || report.status === status);
  const content = `<nav class="tabs" aria-label="Report status">${[["all","All reports"],["ACTIVE","Active"],["CLOSED","Closed"]].map(([value,label]) => `<a href="#/my-reports?status=${value}" class="${status === value ? "active" : ""}" ${status === value ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav><p class="list-summary">${visible.length} ${visible.length === 1 ? "report" : "reports"} submitted by you</p>
    ${visible.length ? `<div class="panel report-list">${visible.map((report) => `<article class="report-row">${image(report,"row-image")}<div class="row-content"><div class="btn-row">${badge(report)}<span class="badge badge-status">${report.status[0]+report.status.slice(1).toLowerCase()}</span></div><h2>${escapeHtml(report.title)}</h2><p>${escapeHtml(report.location.name)} · ${date(report.eventDate)}</p></div><div class="row-actions"><a class="btn btn--secondary" href="#/matches?report=${report.id}">View matches</a><button class="btn btn--secondary" data-edit="${report.id}">Edit report</button>${report.status === "ACTIVE" ? `<button class="text-button" data-close="${report.id}">Close report</button>` : ""}<button class="text-button danger-button" data-delete="${report.id}">Delete</button></div></article>`).join("")}</div>` : empty("No reports here yet", "Report a lost or found item to keep track of it here.", '<a class="btn btn--primary" href="#/report-lost">Report lost item</a>')}`;
  return shell("my-reports", "My reports", "Keep your details up to date, view matches, and close reports when they’re no longer needed.", content);
}
export function bind() {
  bindImages();
  document.querySelectorAll("[data-edit]").forEach((button) => button.onclick = async () => {
    button.disabled = true;
    try {
      const { report } = await api(`/reports/${button.dataset.edit}`);
      const target = dialog("Edit your report", await formMarkup(report.type,report));
      bindForm(target.querySelector("#report-form"), async () => { target.close(); await renderPage(); });
    } catch (error) { toast(error.message); }
    finally { button.disabled = false; }
  });
  for (const action of ["close","delete"]) document.querySelectorAll(`[data-${action}]`).forEach((button) => button.onclick = () => {
    const closing = action === "close";
    const target = dialog(closing ? "Close this report?" : "Delete this report?", `<p>${closing ? "Your report will stay in your history. It will stop receiving matching suggestions." : "This removes the report and its potential matches permanently."}</p><div class="form-actions"><button class="btn btn--primary" id="confirm-report-action">${closing ? "Close report" : "Delete report"}</button><button class="btn btn--secondary" id="cancel-report-action">Keep report</button><p class="form-status" role="status"></p></div>`);
    target.querySelector("#cancel-report-action").onclick = () => target.close();
    target.querySelector("#confirm-report-action").onclick = async (event) => {
      const confirm = event.currentTarget;
      confirm.disabled = true;
      try { await api(`/reports/${button.dataset[action]}${closing ? "/close" : ""}`,{method:closing ? "POST" : "DELETE"}); target.close(); toast(closing ? "Report closed." : "Report deleted."); await renderPage(); }
      catch (error) { target.querySelector(".form-status").textContent = error.message; target.querySelector(".form-status").classList.add("error"); confirm.disabled = false; }
    };
  });
}
