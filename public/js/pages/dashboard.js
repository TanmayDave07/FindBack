import { api, getMyReports, getUser } from "../api.js";
import { bindImages, empty, icon, reportCard, shell } from "../ui.js";
import { bindReportViews } from "../reportViews.js";

export async function render() {
  const [recent, lost, found, mine] = await Promise.all([
    api("/reports?status=ACTIVE&limit=6"), api("/reports?type=LOST&status=ACTIVE&limit=1"),
    api("/reports?type=FOUND&status=ACTIVE&limit=1"), getMyReports(),
  ]);
  const content = `<div class="intro-banner"><div><h2>Report an item on campus</h2><p>Add a report with the details you remember. FindBack will look for matching reports.</p></div><div class="btn-row"><a class="btn btn--primary" href="#/report-lost">Report lost item ${icon("arrow", 16)}</a><a class="btn btn--secondary" href="#/report-found">Report found item</a></div></div>
    <div class="stats">${[["Active campus reports", recent.total, "file"], ["Lost items", lost.total, "search"], ["Found items", found.total, "bag"], ["Your reports", mine.length, "match"]].map(([label, value, image]) => `<div class="stat"><span class="stat-label">${label}${icon(image,18)}</span><strong class="stat-value">${value}</strong></div>`).join("")}</div>
    <div class="section-head"><div><h2>Recently reported items</h2><p>The latest lost and found reports from campus.</p></div><a class="text-button" href="#/browse">Browse all ${icon("arrow",16)}</a></div>
    ${recent.reports.length ? `<div class="item-grid">${recent.reports.map(reportCard).join("")}</div>` : empty("No campus reports yet", "A new report will appear here as soon as someone submits one.", '<a class="btn btn--secondary" href="#/report-found">Report a found item</a>')}`;
  return shell("dashboard", "Campus overview", `Welcome back, ${getUser().name.split(" ")[0]}. Here’s what’s happening on campus.`, content);
}
export function bind() { bindImages(); bindReportViews(); }
