import { api, escapeHtml } from "./api.js";
import { badge, bindImages, date, dialog, image } from "./ui.js";

export async function showReport(id) {
  const { report } = await api(`/reports/${id}`);
  dialog(report.title, `${image(report)}${badge(report)}<dl class="detail-list">
    <div><dt>Category</dt><dd>${escapeHtml(report.category.name)}</dd></div><div><dt>Location</dt><dd>${escapeHtml(report.location.name)}</dd></div>
    <div><dt>Date</dt><dd>${date(report.eventDate,true)}</dd></div>${report.color ? `<div><dt>Color</dt><dd>${escapeHtml(report.color)}</dd></div>` : ""}
    ${report.locationDetails ? `<div><dt>Location details</dt><dd>${escapeHtml(report.locationDetails)}</dd></div>` : ""}<div><dt>Reported by</dt><dd>${escapeHtml(report.user.name)}</dd></div>
    <div><dt>Status</dt><dd>${escapeHtml(report.status.toLowerCase())}</dd></div></dl><p class="dialog-description">${escapeHtml(report.description)}</p>
    ${report.privateDetails ? `<div class="form-help" style="margin-top:24px"><h3>Private details</h3><p>${escapeHtml(report.privateDetails)}</p></div>` : ""}`);
  bindImages();
}
export function bindReportViews() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try { await showReport(button.dataset.view); }
    catch (error) { dialog("Could not open this item", `<p>${escapeHtml(error.message)}</p>`); }
    finally { button.disabled = false; }
  }));
}
