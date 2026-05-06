const config = window.UOTD_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  config.supabaseUrl || "",
  config.supabaseAnonKey || ""
);

const el = (id) => document.getElementById(id);

const state = {
  session: null
};

const ui = {
  authCard: document.getElementById("authCard"),
  authMessage: document.getElementById("authMessage"),
  appShell: document.getElementById("appShell"),
  searchLoading: document.getElementById("searchLoading"),
  pantryLoading: document.getElementById("pantryLoading"),
  suggestLoading: document.getElementById("suggestLoading"),
  profileMessage: document.getElementById("profileMessage"),
  modal: document.getElementById("dishModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalMeta: document.getElementById("modalMeta"),
  modalLoading: document.getElementById("modalLoading"),
  modalBody: document.getElementById("modalBody"),
  modalIngredients: document.getElementById("modalIngredients"),
  modalSteps: document.getElementById("modalSteps"),
  closeModal: document.getElementById("closeModal"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  panels: Array.from(document.querySelectorAll(".panel"))
};

const setLoading = (target, isLoading, message) => {
  if (!target) {
    return;
  }
  if (message) {
    target.textContent = message;
  }
  target.classList.toggle("hidden", !isLoading);
};

const setButtonBusy = (button, busyText, isBusy) => {
  if (!button) {
    return;
  }
  const idleText = button.dataset.idleText || button.textContent;
  if (!button.dataset.idleText) {
    button.dataset.idleText = idleText;
  }
  button.disabled = isBusy;
  button.textContent = isBusy ? busyText : idleText;
};

const updateAuthStatus = () => {
  const status = el("authStatus");
  status.textContent = state.session ? "Signed in" : "Not signed in";
};

const setHomeView = (signedIn) => {
  if (signedIn) {
    document.body.classList.remove("landing");
    ui.authCard.classList.add("hidden");
    ui.appShell.classList.remove("hidden");
  } else {
    document.body.classList.add("landing");
    ui.authCard.classList.remove("hidden");
    ui.appShell.classList.add("hidden");
    ui.modal.classList.add("hidden");
  }
};

const setActivePanel = (panelId) => {
  ui.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  ui.tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === panelId);
  });
};

const renderResults = (target, items, mode) => {
  if (!items || items.length === 0) {
    target.innerHTML = "<p>No results.</p>";
    return;
  }

  target.innerHTML = items
    .map((item) => {
      if (mode === "reverse") {
        return `
          <div class="result-card">
            <h3>${item.name}</h3>
            <p>${item.ingredients.join(", ")}</p>
          </div>
        `;
      }

      return `
        <div class="result-card">
          <h3>${item.name}</h3>
          <p>Cost: PHP ${item.estimatedCost.toFixed(2)} | Kcal: ${item.kcalPerServing}</p>
          <p>Pantry match: ${item.matchCount}/${item.totalIngredients}</p>
          <button class="dish-link" data-id="${item.id}">View details</button>
        </div>
      `;
    })
    .join("");
};

const openDishModal = async (dishId) => {
  if (!state.session) {
    ui.authMessage.textContent = "Please sign in to view dish details.";
    return;
  }
  ui.modal.classList.remove("hidden");
  ui.modalTitle.textContent = "Dish details";
  ui.modalMeta.textContent = "";
  ui.modalBody.classList.add("hidden");
  setLoading(ui.modalLoading, true, "Loading details...");

  try {
    if (!dishId) {
      ui.modalMeta.textContent = "Missing dish id.";
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`/api/ulam-detail?id=${encodeURIComponent(dishId)}&_=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      ui.modalMeta.textContent = "Failed to load details.";
      return;
    }

    const data = await res.json();
    if (!data || !data.item) {
      ui.modalMeta.textContent = "No details found.";
      return;
    }

    ui.modalTitle.textContent = data.item.name;
    ui.modalMeta.textContent = `Servings: ${data.item.servings} | Kcal: ${data.item.kcalPerServing}`;

    ui.modalIngredients.innerHTML = data.item.ingredients
      .map((ing) => `<li>${ing.name} - ${ing.quantity} ${ing.unit}</li>`)
      .join("");

    ui.modalSteps.innerHTML = (data.item.steps || ["Steps coming soon."])
      .map((step) => `<li>${step}</li>`)
      .join("");

    setLoading(ui.modalLoading, false);
    ui.modalBody.classList.remove("hidden");
  } catch (error) {
    ui.modalMeta.textContent = "Failed to load details.";
  } finally {
    setLoading(ui.modalLoading, false);
  }
};

const ensureSession = async () => {
  const { data } = await supabaseClient.auth.getSession();
  state.session = data.session || null;
  updateAuthStatus();
  setHomeView(Boolean(state.session));
};

const getAuthHeader = () => {
  if (!state.session) {
    return {};
  }
  return {
    Authorization: `Bearer ${state.session.access_token}`
  };
};

const loadProfile = async () => {
  if (!state.session) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("display_name,budget_per_meal,kcal_target,diet_tags")
    .eq("user_id", state.session.user.id)
    .maybeSingle();

  if (error || !data) {
    return;
  }

  el("displayName").value = data.display_name || "";
  el("budget").value = data.budget_per_meal || "";
  el("kcal").value = data.kcal_target || "";
  el("dietTags").value = (data.diet_tags || []).join(", ");
};

const loadPantry = async () => {
  setLoading(ui.pantryLoading, true, "Loading pantry...");
  const res = await fetch("/api/pantry-list", {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    }
  });
  const data = await res.json();

  const list = el("pantryList");
  list.innerHTML = "";

  (data.items || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.ingredient_name} - ${item.quantity} ${item.unit}`;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.className = "ghost";
    btn.addEventListener("click", async () => {
      await fetch("/api/pantry-remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader()
        },
        body: JSON.stringify({ id: item.id })
      });
      loadPantry();
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
  setLoading(ui.pantryLoading, false);
};

const setupHandlers = () => {
  ui.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActivePanel(btn.dataset.target);
    });
  });

  ui.closeModal.addEventListener("click", () => {
    ui.modal.classList.add("hidden");
  });
  ui.modal.addEventListener("click", (event) => {
    if (event.target === ui.modal) {
      ui.modal.classList.add("hidden");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !ui.modal.classList.contains("hidden")) {
      ui.modal.classList.add("hidden");
    }
  });

  el("btnSignUp").addEventListener("click", async () => {
    const email = el("email").value.trim();
    const password = el("password").value.trim();
    if (!email || !password) {
      return;
    }
    setButtonBusy(el("btnSignUp"), "Signing up...", true);
    const { error } = await supabaseClient.auth.signUp({ email, password });
    setButtonBusy(el("btnSignUp"), "Signing up...", false);
    if (error) {
      ui.authMessage.textContent = error.message;
      return;
    }
    ui.authMessage.textContent = "Check your email to confirm sign up, then sign in.";
  });

  el("btnSignIn").addEventListener("click", async () => {
    const email = el("email").value.trim();
    const password = el("password").value.trim();
    if (!email || !password) {
      return;
    }
    setButtonBusy(el("btnSignIn"), "Signing in...", true);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setButtonBusy(el("btnSignIn"), "Signing in...", false);
    if (error) {
      ui.authMessage.textContent = error.message;
      return;
    }
    ui.authMessage.textContent = "";
    await ensureSession();
    await loadProfile();
    await loadPantry();
  });

  el("btnSignOut").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    await ensureSession();
  });

  el("btnSaveProfile").addEventListener("click", async () => {
    if (!state.session) {
      return;
    }
    setLoading(ui.profileMessage, true, "Saving profile...");
    const payload = {
      user_id: state.session.user.id,
      display_name: el("displayName").value.trim(),
      budget_per_meal: Number(el("budget").value || 0),
      kcal_target: Number(el("kcal").value || 0),
      diet_tags: el("dietTags").value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };

    await supabaseClient.from("profiles").upsert(payload);
    setLoading(ui.profileMessage, true, "Profile saved.");
    setTimeout(() => setLoading(ui.profileMessage, false), 1500);
  });

  el("btnAddPantry").addEventListener("click", async () => {
    const ingredientName = el("pantryName").value.trim();
    if (!ingredientName) {
      return;
    }
    setLoading(ui.pantryLoading, true, "Adding ingredient...");

    await fetch("/api/pantry-add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify({
        ingredient_name: ingredientName,
        quantity: Number(el("pantryQty").value || 0),
        unit: el("pantryUnit").value.trim()
      })
    });

    el("pantryName").value = "";
    el("pantryQty").value = "";
    el("pantryUnit").value = "";
    loadPantry();
  });

  el("btnRefreshPantry").addEventListener("click", loadPantry);

  el("btnSearch").addEventListener("click", async () => {
    const ingredients = el("ingredientSearch").value.trim();
    setLoading(ui.searchLoading, true, "Searching...");
    const res = await fetch(`/api/ulam-search?ingredients=${encodeURIComponent(ingredients)}`);
    const data = await res.json();
    renderResults(el("searchResults"), data.items, "forward");
    setLoading(ui.searchLoading, false);
  });

  el("btnReverse").addEventListener("click", async () => {
    const dish = el("dishSearch").value.trim();
    setLoading(ui.searchLoading, true, "Searching dish...");
    const res = await fetch(`/api/ulam-reverse?dish=${encodeURIComponent(dish)}`);
    const data = await res.json();
    renderResults(el("searchResults"), data.items, "reverse");
    setLoading(ui.searchLoading, false);
  });

  el("btnSuggest").addEventListener("click", async () => {
    const mode = el("suggestMode").value;
    setLoading(ui.suggestLoading, true, "Finding matches...");
    const res = await fetch(`/api/ulam-suggest?mode=${encodeURIComponent(mode)}` , {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      }
    });
    const data = await res.json();
    renderResults(el("suggestions"), data.items, "forward");
    setLoading(ui.suggestLoading, false);
  });

  el("searchResults").addEventListener("click", (event) => {
    const button = event.target.closest(".dish-link");
    if (!button) {
      return;
    }
    openDishModal(button.dataset.id);
  });

  el("suggestions").addEventListener("click", (event) => {
    const button = event.target.closest(".dish-link");
    if (!button) {
      return;
    }
    openDishModal(button.dataset.id);
  });
};

ensureSession().then(() => {
  setupHandlers();
  if (state.session) {
    loadProfile();
    loadPantry();
  }
  setActivePanel("searchPanel");
});
