import { api, escapeHtml, queryString } from "../api.js";
import { bindImages, empty, icon, reportCard, shell } from "../ui.js";
import { bindReportViews } from "../reportViews.js";

function filterSelect(name, label, rows, current = "") {
  const plural = label === "Category" ? "categories" : "locations";
  return `<div class="field"><label for="filter-${name}">${label}</label><select id="filter-${name}" name="${name}"><option value="">All ${plural}</option>${rows.map((row) => `<option value="${row.id}" ${current === row.id ? "selected" : ""}>${escapeHtml(row.name)}</option>`).join("")}</select></div>`;
}
function link(params, updates) {
  const values = Object.fromEntries(params); Object.assign(values, updates);
  if (values.status === "") values.status = "all";
  return `#/browse?${queryString(values)}`;
}
export async function render({ params }) {
  const filters = Object.fromEntries(params); filters.limit = 12; filters.status ??= "ACTIVE";
  if (filters.status === "all") filters.status = "";
  const [data, { categories }, { locations }] = await Promise.all([api(`/reports?${queryString(filters)}`), api("/categories"), api("/locations")]);
  const pages = Math.max(1,Math.ceil(data.total/data.limit));
  const content = `<form id="browse-filters" class="panel filter-panel" novalidate><div class="search-row"><div class="field"><label for="keyword-search">Search items</label><input id="keyword-search" type="search" name="q" value="${escapeHtml(filters.q)}" placeholder="Search by title, color, or description"></div><button class="btn btn--primary" type="submit" style="align-self:end">${icon("search",18)}Search items</button></div><div class="filter-grid">
    ${filterSelect("categoryId","Category",categories,filters.categoryId)}${filterSelect("locationId","Location",locations,filters.locationId)}
    <div class="field"><label for="date-from">From date</label><input id="date-from" type="date" name="dateFrom" value="${escapeHtml(filters.dateFrom)}"></div><div class="field"><label for="date-to">To date</label><input id="date-to" type="date" name="dateTo" value="${escapeHtml(filters.dateTo)}"></div>
    <div class="field"><label for="filter-status">Status</label><select id="filter-status" name="status"><option value="all" ${filters.status === "" ? "selected" : ""}>All statuses</option>${["ACTIVE","MATCHED","RESOLVED","CLOSED"].map((value) => `<option value="${value}" ${filters.status === value ? "selected" : ""}>${value[0]+value.slice(1).toLowerCase()}</option>`).join("")}</select></div></div><div><a class="text-button" href="#/browse">Clear filters</a></div></form>
    <nav class="tabs" aria-label="Item type">${[["","All items"],["LOST","Lost items"],["FOUND","Found items"]].map(([type,label]) => `<a href="${link(params,{type,page:1})}" class="${(filters.type||"") === type ? "active" : ""}" ${(filters.type||"") === type ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    <p class="list-summary">${data.total} ${data.total === 1 ? "item" : "items"} ${filters.q ? `matching “${escapeHtml(filters.q)}”` : "on the campus board"}</p>
    ${data.reports.length ? `<div class="item-grid">${data.reports.map(reportCard).join("")}</div>` : empty("No items found", "Try a different keyword or choose a wider set of filters.", '<a class="btn btn--secondary" href="#/browse">Reset filters</a>')}
    <div class="pagination"><span>Page ${data.page} of ${pages}</span><div class="pagination-controls">${data.page > 1 ? `<a class="btn btn--secondary" href="${link(params,{page:data.page-1})}">Previous page</a>` : '<button class="btn btn--secondary" disabled>Previous page</button>'}${data.page < pages ? `<a class="btn btn--secondary" href="${link(params,{page:data.page+1})}">Next page</a>` : '<button class="btn btn--secondary" disabled>Next page</button>'}</div></div>`;
  return shell("browse", "Browse campus items", "Look through lost and found reports. A familiar detail could be the one you need.", content);
}
export function bind({ params }) {
  bindImages(); bindReportViews();
  document.querySelector("#browse-filters").onsubmit = (event) => {
    event.preventDefault();
    event.currentTarget.querySelector('[name="dateTo"]').setCustomValidity("");
    const values = Object.fromEntries(new FormData(event.currentTarget)); values.type = params.get("type") || "";
    if (values.dateFrom && values.dateTo && values.dateFrom > values.dateTo) {
      event.currentTarget.querySelector('[name="dateTo"]').setCustomValidity("Choose a date on or after the from date.");
      event.currentTarget.querySelector('[name="dateTo"]').reportValidity(); return;
    }
    location.hash = `/browse?${queryString(values)}`;
  };
  document.querySelector('[name="dateTo"]').oninput = (event) => event.currentTarget.setCustomValidity("");
}
