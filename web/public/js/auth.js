/* Auth page logic: clipper sign-in/up (Discord, Google, email) + admin sign-in/register. */

let config = { providers: { discord: false, google: false }, adminSignup: "closed" };
let clipperMode = "signin"; // signin | signup
let nextUrl = qs("next") || "/dashboard";

function show(elId, message, isError) {
  const el = document.getElementById(elId);
  if (!message) return el.classList.remove("show");
  el.textContent = message;
  el.classList.add("show");
}

function switchMode(mode) {
  document.getElementById("tab-clipper").classList.toggle("active", mode === "clipper");
  document.getElementById("tab-admin").classList.toggle("active", mode === "admin");
  document.getElementById("panel-clipper").classList.toggle("active", mode === "clipper");
  document.getElementById("panel-admin").classList.toggle("active", mode === "admin");
}

function oauth(provider) {
  const url =
    "/api/auth/sign-in/social?provider=" +
    provider +
    "&callbackURL=" +
    encodeURIComponent(nextUrl);
  location.href = url;
}

function setClipperMode(mode) {
  clipperMode = mode;
  const isSignup = mode === "signup";
  document.getElementById("clipper-title").textContent = isSignup ? "Create your account" : "Sign in to CLIPTIC";
  document.getElementById("clipper-sub").textContent = isSignup
    ? "Join the network — you can also use Discord or Google above."
    : "Content creators sign in with Discord or Google.";
  document.getElementById("clipper-name-field").style.display = isSignup ? "block" : "none";
  document.getElementById("c-password").autocomplete = isSignup ? "new-password" : "current-password";
  document.getElementById("clipper-submit").textContent = isSignup ? "Create account" : "Sign in";
  document.getElementById("clipper-toggle").innerHTML = isSignup
    ? 'Already have an account? <span class="linklike" onclick="setClipperMode(\'signin\')">Sign in</span>'
    : 'New here? <span class="linklike" onclick="setClipperMode(\'signup\')">Create an account</span>';
}

async function afterAuth() {
  try {
    const me = await api("/me");
    if (me.role === "admin") location.href = nextUrl === "/dashboard" ? "/admin" : nextUrl;
    else location.href = nextUrl === "/admin" ? "/dashboard" : nextUrl;
  } catch {
    location.href = "/dashboard";
  }
}

async function clipperSubmit(event) {
  event.preventDefault();
  show("clipper-error", null);
  const email = document.getElementById("c-email").value.trim();
  const password = document.getElementById("c-password").value;
  try {
    if (clipperMode === "signup") {
      const name = document.getElementById("c-name").value.trim() || email.split("@")[0];
      await authFetch("/sign-up/email", { name, email, password });
    } else {
      await authFetch("/sign-in/email", { email, password });
    }
    await afterAuth();
  } catch (err) {
    show("clipper-error", err.message || "Sign-in failed");
  }
  return false;
}

async function adminSubmit(event) {
  event.preventDefault();
  show("admin-error", null);
  try {
    await authFetch("/sign-in/email", {
      email: document.getElementById("a-email").value.trim(),
      password: document.getElementById("a-password").value,
    });
    // Admin sign-in must actually be an admin
    const me = await api("/me");
    if (me.role !== "admin") {
      show("admin-error", "This account is not an admin. Use the Clipper tab instead.");
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" }).catch(() => {});
      return false;
    }
    location.href = qs("next") && qs("next") !== "/dashboard" ? qs("next") : "/admin";
  } catch (err) {
    show("admin-error", err.message || "Sign-in failed");
  }
  return false;
}

async function adminRegister(event) {
  event.preventDefault();
  show("admin-error", null);
  try {
    const data = await api("/auth/register-admin", {
      method: "POST",
      body: {
        name: document.getElementById("r-name").value.trim(),
        email: document.getElementById("r-email").value.trim(),
        password: document.getElementById("r-password").value,
        code: document.getElementById("r-code") ? document.getElementById("r-code").value.trim() : "",
      },
    });
    if (data && data.success) {
      toast("Admin account created — opening console…", "success");
      setTimeout(() => (location.href = "/admin"), 600);
    }
  } catch (err) {
    show("admin-error", err.message || "Registration failed");
  }
  return false;
}

async function boot() {
  setClipperMode("signin");
  try {
    config = await api("/config");
  } catch {}

  // OAuth provider availability
  const discordBtn = document.getElementById("btn-discord");
  const googleBtn = document.getElementById("btn-google");
  if (!config.providers.discord) {
    discordBtn.disabled = true;
    discordBtn.innerHTML =
      '<i class="fa-brands fa-discord"></i> Continue with Discord <span class="na">not configured yet</span>';
  }
  if (!config.providers.google) {
    googleBtn.disabled = true;
    googleBtn.innerHTML =
      '<i class="fa-brands fa-google"></i> Continue with Google <span class="na">not configured yet</span>';
  }

  // Admin registration visibility
  const note = document.getElementById("admin-note");
  const reg = document.getElementById("admin-register");
  if (config.adminSignup === "closed") {
    reg.style.display = "none";
    note.style.display = "block";
    note.textContent = "Admin registration is closed — ask an existing admin for access.";
  } else if (config.adminSignup === "open") {
    reg.style.display = "block";
    note.style.display = "block";
    note.textContent = "Bootstrap mode: no admin exists yet — the first registration becomes the owner admin.";
    document.getElementById("r-code-field").style.display = "none";
  } else {
    reg.style.display = "block";
    note.style.display = "block";
    note.textContent = "Admin sign-in with your own credentials. Registration requires the team invite code.";
  }

  // Already signed in? Skip the form.
  try {
    const me = await api("/me");
    if (me.role === "admin" && (qs("next") === "/admin" || !qs("next"))) location.href = "/admin";
    else if (!qs("next") || qs("next") === "/admin") location.href = "/dashboard";
    else location.href = qs("next");
  } catch {}
}

boot();
