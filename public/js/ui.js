import { escapeHtml, getUser, setSession } from "./api.js";

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  file: '<path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/>',
  match: '<path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"/><path d="m8 12 3 3 5-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  logout: '<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<path d="M4 7V5h14v3M4 8h16v12H4V8Z"/><path d="M15 12h5v4h-5z"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/>',
  key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-7-1 3-3"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a5 5 0 0 0-4-5"/>',
};
export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bag}</svg>`;
}
export function brand() { return '<a class="brand" href="#/dashboard"><img src="/favicon.svg" width="34" height="34" alt=""><span>FindBack<span class="brand-dot">.</span></span></a>'; }
export function initials(name) { return escapeHtml((name || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("")); }

export function shell(route, title, subtitle, content, action = "") {
  const user = getUser();
  const navigation = [["dashboard", "grid", "Dashboard"], ["browse", "search", "Browse items"], ["my-reports", "file", "My reports"], ["matches", "match", "Potential matches"]];
  if (user.role === "ADMIN") navigation.push(["admin", "users", "Manage platform"]);
  return `<div class="workspace">
    <aside class="sidebar" id="sidebar">${brand()}<button id="sidebar-close" class="icon-button sidebar-close" aria-label="Close navigation">${icon("close")}</button><span class="workspace-label">Campus workspace</span>
      <nav aria-label="Main navigation">${navigation.map(([path, image, label]) => `<a href="#/${path}" class="nav-link ${route === path ? "active" : ""}" ${route === path ? 'aria-current="page"' : ""}>${icon(image)}<span>${label}</span>${path === "matches" ? '<span class="nav-dot"></span>' : ""}</a>`).join("")}</nav>
      <div class="sidebar-action"><a class="btn btn--primary" href="#/report-lost">${icon("plus")}Report lost item</a><a class="btn btn--secondary" href="#/report-found">${icon("bag")}Report found item</a></div>
      <div class="sidebar-footer"><div class="avatar">${initials(user.name)}</div><div class="profile"><strong>${escapeHtml(user.name)}</strong><span>${user.role === "ADMIN" ? "Administrator" : "Campus member"}</span></div><button id="sign-out" class="icon-button" aria-label="Sign out">${icon("logout")}</button></div>
    </aside>
    <div class="workspace-body"><header class="topbar"><button class="icon-button menu-button" id="menu-toggle" aria-label="Open navigation" aria-expanded="false">${icon("menu")}</button><div class="breadcrumb">Workspace<span>/</span><strong>${escapeHtml(title)}</strong></div><span class="topbar-label"><span class="status-dot"></span>Campus lost &amp; found</span></header>
    <main id="main-content" class="main-content" tabindex="-1"><div class="page-head"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>${action}</div>${content}<footer class="app-footer"><span>FindBack · Campus lost &amp; found</span><span>Your campus workspace</span></footer></main></div></div>`;
}
export function bindShell() {
  document.querySelector("#sign-out")?.addEventListener("click", () => { setSession(null); location.hash = "/login"; });
  document.querySelector("#menu-toggle")?.addEventListener("click", (event) => {
    const open = document.querySelector(".workspace").classList.toggle("menu-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
    event.currentTarget.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    document.querySelector("#main-content").inert = open;
    if (open) document.querySelector("#sidebar-close").focus();
  });
  document.querySelector("#sidebar-close")?.addEventListener("click", () => {
    document.querySelector(".workspace").classList.remove("menu-open");
    const button = document.querySelector("#menu-toggle"); button.setAttribute("aria-expanded","false"); button.setAttribute("aria-label","Open navigation");
    document.querySelector("#main-content").inert = false;
    if (window.matchMedia("(max-width:900px)").matches) button.focus();
  });
}
export function date(value, withTime = false) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
}
export function badge(report) { return `<span class="badge ${report.type === "LOST" ? "badge-lost" : "badge-found"}">${report.type === "LOST" ? "Lost" : "Found"}</span>`; }
export function image(report, className = "item-image") {
  const categoryIcon = { Wallet: "wallet", Phone: "phone", Keys: "key", Bags: "bag" }[report.category?.name] || "bag";
  const fallback = `<div class="${className} item-image-fallback" aria-label="${escapeHtml(report.category?.name || "Item")}">${icon(categoryIcon, 54)}<span>${escapeHtml(report.category?.name || "Item")}</span></div>`;
  if (!report.imageUrl) return fallback;
  return `<div class="${className}"><img src="${escapeHtml(report.imageUrl)}" alt="${escapeHtml(report.title)}" loading="lazy" referrerpolicy="no-referrer" data-item-photo>${fallback}</div>`;
}
export function bindImages() {
  document.querySelectorAll("[data-item-photo]").forEach((image) => {
    const showFallback = () => { image.hidden = true; image.nextElementSibling.style.display = "flex"; };
    image.addEventListener("error", showFallback, { once: true });
    if (image.complete && !image.naturalWidth) showFallback();
  });
}
export function reportCard(report) {
  return `<article class="card item-card">${image(report)}<div class="item-card-body"><div class="card-meta">${badge(report)}<span>${escapeHtml(report.category.name)}</span></div><h2>${escapeHtml(report.title)}</h2><p class="item-description">${escapeHtml(report.description)}</p><div class="item-meta"><span>${icon("pin", 16)}${escapeHtml(report.location.name)}</span><span>${icon("clock", 16)}${date(report.eventDate)}</span></div><button class="text-button" data-view="${report.id}">View item ${icon("arrow", 16)}</button></div></article>`;
}
export function empty(title, text, action = "") { return `<div class="empty-state">${icon("search", 38)}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p>${action}</div>`; }
export function toast(message) {
  const target = document.querySelector("#toast");
  target.textContent = message; target.hidden = false;
  clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => target.hidden = true, 4500);
}
export function dialog(title, body) {
  document.querySelector("#app-dialog")?.remove();
  const target = document.createElement("dialog"); target.id = "app-dialog"; target.className = "app-dialog";
  target.setAttribute("aria-labelledby","app-dialog-title");
  target.innerHTML = `<div class="dialog-head"><h2 id="app-dialog-title">${escapeHtml(title)}</h2><button class="icon-button" aria-label="Close dialog" data-close-dialog>${icon("close")}</button></div><div class="dialog-body">${body}</div>`;
  document.body.append(target); target.querySelector("[data-close-dialog]").onclick = () => target.close();
  target.addEventListener("click", (event) => { if (event.target === target) target.close(); });
  target.showModal(); return target;
}
export function fieldErrors(form) {
  for (const field of form.querySelectorAll("input, select, textarea")) {
    field.removeAttribute("aria-invalid");
    const error = form.querySelector(`[data-error="${field.name}"]`);
    if (error) error.textContent = "";
  }
  const invalid = [...form.querySelectorAll("input, select, textarea")].filter((field) => !field.checkValidity());
  for (const field of invalid) {
    field.setAttribute("aria-invalid", "true");
    const error = form.querySelector(`[data-error="${field.name}"]`);
    if (error) error.textContent = field.validationMessage;
  }
  invalid[0]?.focus(); return invalid.length === 0;
}
