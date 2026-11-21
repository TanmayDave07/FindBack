import { api, escapeHtml } from "../api.js";
import { fieldErrors, shell, toast } from "../ui.js";

function input(name, label, type, value = "", extra = "") {
  return `<div class="field"><label for="report-${name}">${label}</label><input id="report-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra} aria-describedby="${name}-error"><span class="field__error" id="${name}-error" data-error="${name}"></span></div>`;
}
function select(name, label, rows, value = "") {
  return `<div class="field"><label for="report-${name}">${label}</label><select id="report-${name}" name="${name}" required aria-describedby="${name}-error"><option value="">Choose ${label.toLowerCase()}</option>${rows.map((row) => `<option value="${row.id}" ${row.id === value ? "selected" : ""}>${escapeHtml(row.name)}</option>`).join("")}</select><span class="field__error" id="${name}-error" data-error="${name}"></span></div>`;
}
export async function formMarkup(type, report = null) {
  const [{ categories }, { locations }] = await Promise.all([api("/categories"), api("/locations")]);
  const localDate = report ? new Date(new Date(report.eventDate).getTime() - new Date(report.eventDate).getTimezoneOffset() * 60000).toISOString() : "";
  return `<form id="report-form" class="report-form" novalidate data-type="${type}" ${report ? `data-id="${report.id}"` : ""}><div class="form-grid">
    <div class="full">${input("title", "Item title", "text", report?.title, 'required maxlength="120" placeholder="e.g. Black leather wallet"')}</div>
    ${select("categoryId", "Category", categories, report?.categoryId)}${input("color", "Color (optional)", "text", report?.color, 'maxlength="50" placeholder="e.g. Black"')}
    ${select("locationId", type === "LOST" ? "Last seen location" : "Found location", locations, report?.locationId)}${input("locationDetails", "Location details (optional)", "text", report?.locationDetails, 'maxlength="500" placeholder="Floor, room, or nearby landmark"')}
    ${input("date", type === "LOST" ? "Date last seen" : "Date found", "date", localDate.slice(0,10), "required")}${input("time", "Time (optional)", "time", localDate.slice(11,16))}
    <div class="field full"><label for="report-description">Item description</label><textarea id="report-description" name="description" required maxlength="5000" placeholder="Describe its appearance and any useful public details." aria-describedby="description-error">${escapeHtml(report?.description)}</textarea><span class="field__error" id="description-error" data-error="description"></span><small>This description is visible to campus members.</small></div>
    <div class="full">${input("imageUrl", "Photo URL (optional)", "url", report?.imageUrl, 'maxlength="2048" placeholder="https://…"')}</div>
    <div class="field full"><label for="report-privateDetails">Private identifying details (optional)</label><textarea id="report-privateDetails" name="privateDetails" maxlength="5000" placeholder="Serial numbers, wallet contents, or details only the owner would know.">${escapeHtml(report?.privateDetails)}</textarea><small>Visible only to you and administrators.</small></div>
    </div><div class="form-actions"><button class="btn btn--primary" type="submit">${report ? "Save changes" : type === "LOST" ? "Submit lost report" : "Submit found report"}</button><p class="form-status" role="status"></p></div></form>`;
}
export async function render({ route }) {
  const lost = route === "report-lost";
  const form = await formMarkup(lost ? "LOST" : "FOUND");
  return shell("", lost ? "Report a lost item" : "Report a found item", lost ? "Tell us what’s missing and where you last saw it." : "Share what you found and where it was picked up.", `<div class="form-layout"><div class="panel form-panel">${form}</div><aside class="form-help"><h2>A few useful details</h2><p>Better report details make potential matches more useful.</p><ul><li>Choose the closest category and campus location.</li><li>Include the color and a short description.</li><li>Add the time if you remember it.</li><li>Keep identifying details in the private field.</li></ul></aside></div>`);
}
export function bindForm(form, onSaved) {
  form.onsubmit = async (event) => {
    event.preventDefault();
    const status = form.querySelector(".form-status"); status.textContent = ""; status.classList.remove("error");
    if (!fieldErrors(form)) return;
    const values = Object.fromEntries(new FormData(form));
    const body = { type: form.dataset.type, title: values.title, categoryId: values.categoryId, locationId: values.locationId, description: values.description };
    if (values.time) body.eventDate = new Date(`${values.date}T${values.time}`).toISOString();
    else body.date = values.date;
    for (const field of ["color", "locationDetails", "imageUrl", "privateDetails"]) body[field] = values[field] || null;
    const button = form.querySelector('[type="submit"]'); button.disabled = true; status.textContent = "Saving your report…";
    try {
      const id = form.dataset.id;
      const { report } = await api(id ? `/reports/${id}` : "/reports", { method: id ? "PATCH" : "POST", body });
      toast(id ? "Report updated." : "Report submitted. Potential matches have been checked.");
      if (onSaved) await onSaved(report);
      else location.hash = `/matches?report=${report.id}`;
    } catch (error) { status.textContent = error.message; status.classList.add("error"); }
    finally { button.disabled = false; }
  };
}
export function bind() { bindForm(document.querySelector("#report-form")); }
