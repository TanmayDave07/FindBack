// Runs only in frontendQaServer's browser pages, against the isolated test API.
const results = JSON.parse(sessionStorage.getItem("frontend-qa-results") || "[]");
const sleep = (time) => new Promise(resolve => setTimeout(resolve,time));
async function waitFor(check, label) {
  const start = Date.now();
  while (!check()) {
    if (Date.now()-start > 12000) throw new Error(`Timed out: ${label}`);
    await sleep(60);
  }
}
function pass(label, value) {
  if (!value) throw new Error(label);
  results.push({test:label,passed:true});
}
async function route(path, heading) {
  location.hash = path;
  await sleep(80);
  await waitFor(()=>document.documentElement.dataset.ready === "true" && document.querySelector("h1")?.textContent === heading,heading);
}
function fill(form, values) {
  for (const [name,value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    field.value = value; field.dispatchEvent(new Event("input",{bubbles:true}));
  }
}
function choose(form,name,label) {
  const field = form.elements.namedItem(name);
  field.value = [...field.options].find(option=>option.textContent === label).value;
}
async function submitReport(type,title) {
  await route(type === "LOST" ? "/report-lost" : "/report-found",type === "LOST" ? "Report a lost item" : "Report a found item");
  const form = document.querySelector("#report-form");
  fill(form,{title,color:type === "LOST" ? "Black" : "Blue",date:"2026-11-10",time:"14:00",description:type === "LOST" ? "Black leather wallet" : "Blue water bottle"});
  choose(form,"categoryId",type === "LOST" ? "Wallet" : "Other");
  choose(form,"locationId",type === "LOST" ? "Library" : "R1");
  form.requestSubmit();
  await waitFor(()=>location.hash.includes("/matches?") && document.querySelector("h1")?.textContent === "Potential matches" && document.documentElement.dataset.ready === "true","report submitted and matches loaded");
  return new URLSearchParams(location.hash.split("?")[1]).get("report");
}
async function studentFlow() {
  if (sessionStorage.getItem("frontend-qa-phase") === "after-reload") {
    await waitFor(()=>document.querySelector("h1")?.textContent === "My reports" && document.documentElement.dataset.ready === "true","authenticated bookmark after reload");
    pass("Authenticated My Reports bookmark survives reload",true);
    await route(`/matches?report=${sessionStorage.getItem("frontend-qa-report")}`,"Potential matches");
    return;
  }
  await route("/register","Create your account");
  const form = document.querySelector("#auth-form");
  fill(form,{name:"Harsh NST",email:"frontend-harsh@example.com",password:"FrontendTest123!",confirmPassword:"DifferentPassword123"});
  form.requestSubmit();
  pass("Registration checks password confirmation",form.querySelector('[data-error="confirmPassword"]').textContent.includes("match"));
  fill(form,{confirmPassword:"FrontendTest123!"});form.requestSubmit();
  await waitFor(()=>document.querySelector("h1")?.textContent === "Campus overview" && document.documentElement.dataset.ready === "true","registered dashboard");
  pass("Registration signs in and loads real campus counts",document.querySelectorAll(".stat-value").length === 4);
  const reportId = await submitReport("LOST","Black wallet");
  pass("Lost submission automatically displays ranked matches",document.querySelectorAll(".match-card").length === 3);
  pass("Best matching score is visible",document.querySelector(".score-number")?.textContent === "100%");
  pass("Claim submission is clearly coming soon",[...document.querySelectorAll("button")].some(button=>button.textContent === "Submit claim" && button.disabled));
  document.querySelector("[data-view]").click();
  await waitFor(()=>document.querySelector("dialog[open]"),"item details");
  pass("Counterpart private identifying details stay hidden",!document.querySelector("dialog").textContent.includes("Private QA identifying detail"));
  document.querySelector("[data-close-dialog]").click();
  await route("/my-reports","My reports");
  document.querySelector(`[data-edit="${reportId}"]`).click();
  await waitFor(()=>document.querySelector("dialog #report-form"),"edit form");
  const edit = document.querySelector("dialog #report-form");fill(edit,{title:"Black wallet with front pocket"});edit.requestSubmit();
  await waitFor(()=>!document.querySelector("dialog[open]") && document.querySelector(".report-row h2")?.textContent === "Black wallet with front pocket","saved report edit");
  pass("My Reports edits are saved through the API",true);
  await route("/browse","Browse campus items");
  const filters=document.querySelector("#browse-filters");fill(filters,{q:"wallet"});choose(filters,"categoryId","Wallet");filters.requestSubmit();
  await sleep(80);
  await waitFor(()=>location.hash.includes("q=wallet") && document.documentElement.dataset.ready === "true","browse filters");
  pass("Browse search and category filter use actual results",document.querySelectorAll(".item-card").length === 4);
  const foundTab=[...document.querySelectorAll(".tabs a")].find(link=>link.textContent === "Found items");foundTab.click();
  await sleep(80);
  await waitFor(()=>location.hash.includes("type=FOUND") && document.documentElement.dataset.ready === "true","found filter");
  pass("Browse type filtering returns only found reports",document.querySelectorAll(".badge-found").length === 3 && document.querySelectorAll(".badge-lost").length === 0);
  await route("/my-reports","My reports");
  document.querySelector(`[data-close="${reportId}"]`).click();document.querySelector("#confirm-report-action").click();
  await waitFor(()=>!document.querySelector("dialog[open]") && document.querySelector(".badge-status")?.textContent === "Closed","close report");
  pass("Closing keeps report history and updates status",true);
  await submitReport("FOUND","Blue water bottle");
  pass("Found submission reaches its ranked-match page",document.querySelectorAll(".match-card").length === 1);
  const nextLost = await submitReport("LOST","Black wallet");sessionStorage.setItem("frontend-qa-report",nextLost);
  await route("/admin","Administrator access required");
  pass("Students cannot open platform management",!document.querySelector('[href="#/admin"]'));
  document.querySelector("#sign-out").click();
  await waitFor(()=>document.querySelector("#auth-form"),"sign out");
  pass("Signing out returns to authentication",!sessionStorage.getItem("findback-session"));
  const login=document.querySelector("#auth-form");fill(login,{email:"frontend-harsh@example.com",password:"FrontendTest123!"});login.requestSubmit();
  await waitFor(()=>document.querySelector("h1")?.textContent === "Campus overview" && document.documentElement.dataset.ready === "true","login");
  pass("Existing users can sign in",true);
  await route("/my-reports","My reports");
  sessionStorage.setItem("frontend-qa-phase","after-reload");sessionStorage.setItem("frontend-qa-results",JSON.stringify(results));
  location.reload();
  return "reloading";
}
async function adminFlow() {
  await route("/admin","Manage platform");
  pass("Admin can view campus member and report tables",document.querySelectorAll("table").length === 2);
  const select=document.querySelector("[data-status]");select.value="CLOSED";select.dispatchEvent(new Event("change",{bubbles:true}));
  await waitFor(()=>!select.disabled,"admin status update");
  pass("Admin status changes complete",document.querySelector("#toast").textContent.includes("updated"));
  select.value="ACTIVE";select.dispatchEvent(new Event("change",{bubbles:true}));await waitFor(()=>!select.disabled,"restored admin status");
  document.querySelector("[data-edit]").click();await waitFor(()=>document.querySelector("dialog #report-form"),"admin edit");
  pass("Admin can edit another member's report",!!document.querySelector("dialog #report-form"));
  document.querySelector("[data-close-dialog]").click();
}
async function mobileFlow() {
  await route("/matches","Potential matches");
  const toggle = document.querySelector("#menu-toggle");
  toggle.click();
  pass("Mobile menu opens with an announced state",toggle.getAttribute("aria-expanded") === "true");
  pass("Open mobile navigation makes background content inert",document.querySelector("#main-content").inert);
  window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  pass("Escape closes mobile navigation and restores content",toggle.getAttribute("aria-expanded") === "false" && !document.querySelector("#main-content").inert);
  toggle.click();document.querySelector('[href="#/my-reports"]').click();
  await sleep(80);
  await waitFor(()=>document.querySelector("h1")?.textContent === "My reports" && document.documentElement.dataset.ready === "true","mobile navigation");
  pass("Mobile links navigate and close the menu",!document.querySelector(".workspace").classList.contains("menu-open"));
  document.querySelector("[data-edit]").click();await waitFor(()=>document.querySelector("dialog #report-form"),"mobile edit dialog");
  const form=document.querySelector("dialog #report-form");fill(form,{title:""});form.requestSubmit();
  pass("Mobile report errors appear under their fields",form.querySelector('[data-error="title"]').textContent.length > 0 && form.elements.namedItem("title").getAttribute("aria-invalid") === "true");
  document.querySelector("[data-close-dialog]").click();await route("/matches","Potential matches");
  await route("/browse","Browse campus items");
  const filters=document.querySelector("#browse-filters");fill(filters,{status:"all"});filters.requestSubmit();await sleep(80);
  await waitFor(()=>document.documentElement.dataset.ready === "true" && location.hash.includes("status=all"),"all statuses filter");
  pass("All statuses includes closed report history",[...document.querySelectorAll(".item-card h2")].some(item=>item.textContent === "Black wallet with front pocket"));
  [...document.querySelectorAll(".tabs a")].find(link=>link.textContent === "Lost items").click();await sleep(80);
  await waitFor(()=>document.documentElement.dataset.ready === "true" && location.hash.includes("type=LOST"),"all statuses after type change");
  pass("All statuses stays selected when switching item type",document.querySelector('[name="status"]').value === "all" && [...document.querySelectorAll(".item-card h2")].some(item=>item.textContent === "Black wallet with front pocket"));
  await route("/matches","Potential matches");
}
const kind=new URLSearchParams(location.search).get("flow");
try {
  if (kind === "admin") await adminFlow();
  else if (kind === "mobile") await mobileFlow();
  else if (await studentFlow() === "reloading") throw new Error("QA_RELOAD_PENDING");
  await fetch("/qa-results",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,passed:true,tests:results})});
  document.documentElement.dataset.qaResult="passed";
} catch (error) {
  if(error.message !== "QA_RELOAD_PENDING") {
    await fetch("/qa-results",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,passed:false,error:error.message,tests:results})});
    document.documentElement.dataset.qaResult="failed";
  }
}
