import { api, escapeHtml, setSession } from "../api.js";
import { brand, fieldErrors, icon } from "../ui.js";

function field(name, label, type, autocomplete, required = true) {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" ${required ? "required" : ""} ${type === "password" ? 'minlength="8"' : ""} aria-describedby="${name}-error"><span class="field__error" id="${name}-error" data-error="${name}"></span></div>`;
}
export async function render({ route }) {
  const registration = route === "register";
  return `<main id="main-content" tabindex="-1"><section class="auth-layout hero" data-enter>
    <div class="auth-story">${brand()}<div><p class="auth-title">Campus lost<br>&amp; found.</p><p class="hero__lead">Report lost items, share what you’ve found, and compare potential matches in one place.</p>
      <div class="auth-steps"><div class="auth-step"><span class="step-icon">${icon("bag")}</span><span>Report an item on campus</span></div><div class="auth-step"><span class="step-icon">${icon("match")}</span><span>Compare ranked potential matches</span></div><div class="auth-step"><span class="step-icon">${icon("file")}</span><span>Keep track of your reports</span></div></div></div><p class="auth-note">Potential matches are scored out of 100.</p></div>
    <div class="auth-form-side"><div class="auth-mobile-brand">${brand()}</div><p class="auth-kicker">Your campus workspace</p><h1>${registration ? "Create your account" : "Sign in to FindBack"}</h1><p class="auth-intro">${registration ? "Join your campus lost-and-found community." : "Sign in to view your reports and potential matches."}</p>
      <div class="auth-tabs"><a href="#/login" class="${!registration ? "active" : ""}" ${!registration ? 'aria-current="page"' : ""}>Sign in</a><a href="#/register" class="${registration ? "active" : ""}" ${registration ? 'aria-current="page"' : ""}>Create account</a></div>
      <form class="auth-form" id="auth-form" novalidate>
        ${registration ? field("name", "Full name", "text", "name") : ""}
        ${field("email", "Email address", "email", "email")}
        ${field("password", "Password", "password", registration ? "new-password" : "current-password")}
        ${registration ? field("confirmPassword", "Confirm password", "password", "new-password") : ""}
        <button class="btn btn--primary" type="submit">${registration ? "Create account" : "Sign in"}${icon("arrow", 18)}</button><p class="form-status" id="auth-status" role="status"></p>
      </form><p class="auth-foot">${registration ? "Use a password with at least 8 characters." : 'New to FindBack? <a class="link" href="#/register">Create an account</a>.'}</p>
    </div></section></main>`;
}
export function bind({ route }) {
  const form = document.querySelector("#auth-form");
  const registration = route === "register";
  form.onsubmit = async (event) => {
    event.preventDefault();
    const status = form.querySelector("#auth-status"); status.textContent = ""; status.classList.remove("error");
    if (!fieldErrors(form)) return;
    const data = Object.fromEntries(new FormData(form));
    if (registration && data.password !== data.confirmPassword) {
      form.querySelector('[data-error="confirmPassword"]').textContent = "Passwords must match.";
      form.confirmPassword.setAttribute("aria-invalid", "true"); form.confirmPassword.focus(); return;
    }
    if (new TextEncoder().encode(data.password).length > 72) {
      form.querySelector('[data-error="password"]').textContent = "This password is too long."; return;
    }
    delete data.confirmPassword;
    const button = form.querySelector("button[type=submit]"); button.disabled = true; status.textContent = registration ? "Creating your account…" : "Signing in…";
    try {
      const result = await api(`/auth/${registration ? "register" : "login"}`, { method: "POST", body: data });
      setSession(result); location.hash = "/dashboard";
    } catch (error) {
      status.textContent = error.message; status.classList.add("error");
    } finally { button.disabled = false; }
  };
}
