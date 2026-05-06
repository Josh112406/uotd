const config = window.UOTD_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  config.supabaseUrl || "",
  config.supabaseAnonKey || ""
);

const el = (id) => document.getElementById(id);

const state = {
  session: null,
  modalBusy: false
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
  target.style.display = isLoading ? "inline-flex" : "none";
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
      // Using an AI image generation endpoint to get accurate Filipino food photos dynamically
      const cleanName = encodeURIComponent(item.name + " filipino food realistic high quality");
      const imgUrl = `https://image.pollinations.ai/prompt/${cleanName}?width=400&height=300&nologo=true`;

      if (mode === "reverse") {
        return `
          <div class="result-card clickable-card" data-id="${item.id}">
            <div class="img-wrapper">
              <img src="${imgUrl}" alt="${item.name}" loading="lazy"/>
            </div>
            <div class="card-content">
              <h3>${item.name}</h3>
              <p style="font-size: 13px; color: #555; margin: 0; line-height: 1.4;">${item.ingredients.join(", ")}</p>
            </div>
          </div>
        `;
      }

      let matchClass = "match-low";
      let matchRatio = item.totalIngredients > 0 ? item.matchCount / item.totalIngredients : 0;
      if (matchRatio >= 0.7 || item.matchCount === item.totalIngredients) matchClass = "match-high";
      else if (matchRatio >= 0.4) matchClass = "match-med";

      return `
        <div class="result-card clickable-card" data-id="${item.id}">
          <div class="img-wrapper">
            <img src="${imgUrl}" alt="${item.name}" loading="lazy"/>
          </div>
          <div class="card-content">
            <h3>${item.name}</h3>
            <div class="badges">
              <span class="badge">₱${item.estimatedCost.toFixed(0)}</span>
              <span class="badge">${item.kcalPerServing} kcal</span>
              <span class="badge ${matchClass}">${item.matchCount}/${item.totalIngredients} Match</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
};
          </div>
        </div>
      `;
    })
    .join("");
};

const resetModal = () => {
  ui.modal.classList.remove("hidden");
  ui.modalTitle.textContent = "Dish details";
  ui.modalMeta.textContent = "";
  ui.modalBody.classList.add("hidden");
  ui.modalBody.style.display = "none";
  ui.modalLoading.classList.remove("hidden");
  ui.modalLoading.textContent = "Loading details...";
  ui.modalLoading.style.display = "inline-flex";
};

const hideModal = () => {
  ui.modal.classList.add("hidden");
  ui.modalBody.classList.add("hidden");
  ui.modalBody.style.display = "none";
  ui.modalLoading.classList.add("hidden");
  ui.modalLoading.style.display = "none";
};

const openDishModal = async (dishId) => {
  if (!state.session) {
    ui.authMessage.textContent = "Please sign in to view dish details.";
    return;
  }
  if (state.modalBusy) {
    return;
  }
  state.modalBusy = true;
  resetModal();

  const showModalError = (message) => {
    ui.modalMeta.textContent = message;
    ui.modalBody.classList.add("hidden");
    setLoading(ui.modalLoading, false);
  };

  try {
    if (!dishId) {
      showModalError("Missing dish id.");
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
      showModalError("Failed to load details.");
      return;
    }

    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (parseError) {
      showModalError("Invalid response from server.");
      return;
    }
    if (!data || !data.item) {
      showModalError("No details found.");
      return;
    }

    ui.modalTitle.textContent = data.item.name;
    ui.modalMeta.textContent = `Servings: ${data.item.servings} | Kcal: ${data.item.kcalPerServing}`;

    const ingredients = Array.isArray(data.item.ingredients) ? data.item.ingredients : [];
    ui.modalIngredients.innerHTML = ingredients.length
      ? ingredients.map((ing) => `<li>${ing.name} - ${ing.quantity} ${ing.unit}</li>`).join("")
      : "<li>No ingredients listed.</li>";

    const steps = Array.isArray(data.item.steps) && data.item.steps.length
      ? data.item.steps
      : ["Steps coming soon."];
    ui.modalSteps.innerHTML = steps.map((step) => `<li>${step}</li>`).join("");

    setLoading(ui.modalLoading, false);
    ui.modalLoading.style.display = "none";
    ui.modalBody.classList.remove("hidden");
    ui.modalBody.style.display = "block";
  } catch (error) {
    showModalError("Failed to load details.");
  } finally {
    ui.modalLoading.classList.add("hidden");
    ui.modalLoading.style.display = "none";
    state.modalBusy = false;
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
  let data = { items: [] };
  try {
    const res = await fetch(`/api/pantry-list?_=${Date.now()}`, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...getAuthHeader()
      }
    });
    if (!res.ok) {
      throw new Error("Failed to load pantry.");
    }
    data = await res.json();
  } catch (error) {
    const list = el("pantryList");
    list.innerHTML = "<li>Failed to load pantry.</li>";
  }

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
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.session = session || null;
    updateAuthStatus();
    setHomeView(Boolean(state.session));
    if (!state.session) {
      hideModal();
    }
  });

  ui.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActivePanel(btn.dataset.target);
    });
  });

  ui.closeModal.addEventListener("click", () => {
    hideModal();
  });
  ui.modal.addEventListener("click", (event) => {
    if (event.target === ui.modal) {
      hideModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !ui.modal.classList.contains("hidden")) {
      hideModal();
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
    hideModal();
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
    const qty = Number(el("pantryQty").value || 0);
    const unit = el("pantryUnit").value.trim();

    if (!ingredientName || qty <= 0 || !unit) {
      setLoading(ui.pantryLoading, true, "Please provide a valid name, quantity (>0), and select a unit.");
      setTimeout(() => setLoading(ui.pantryLoading, false), 2500);
      return;
    }

    if (!/^[A-Za-z\s\-]+$/.test(ingredientName)) {
      setLoading(ui.pantryLoading, true, "Ingredient name can only contain letters, spaces, and hyphens.");
      setTimeout(() => setLoading(ui.pantryLoading, false), 2500);
      return;
    }

    setLoading(ui.pantryLoading, true, "Adding ingredient...");

    try {
      const res = await fetch(`/api/pantry-add?_=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...getAuthHeader()
        },
        body: JSON.stringify({
          ingredient_name: ingredientName,
          quantity: qty,
          unit: unit
        })
      });
      if (!res.ok) {
        throw new Error("Failed to add ingredient.");
      }
    } catch (error) {
      setLoading(ui.pantryLoading, true, "Failed to add ingredient.");
    }

    el("pantryName").value = "";
    el("pantryQty").value = "";
    el("pantryUnit").value = "";
    loadPantry();
  });

  el("btnRefreshPantry").addEventListener("click", loadPantry);

  el("btnSearch").addEventListener("click", async () => {
    const ingredients = el("ingredientSearch").value.trim();
    setLoading(ui.searchLoading, true, "Searching...");
    try {
      const res = await fetch(`/api/ulam-search?ingredients=${encodeURIComponent(ingredients)}&_=${Date.now()}`);
      if (!res.ok) {
        throw new Error("Search failed.");
      }
      const data = await res.json();
      renderResults(el("searchResults"), data.items, "forward");
    } catch (error) {
      el("searchResults").innerHTML = "<p>Search failed. Try again.</p>";
    } finally {
      setLoading(ui.searchLoading, false);
    }
  });

  el("btnReverse").addEventListener("click", async () => {
    const dish = el("dishSearch").value.trim();
    setLoading(ui.searchLoading, true, "Searching dish...");
    try {
      const res = await fetch(`/api/ulam-reverse?dish=${encodeURIComponent(dish)}&_=${Date.now()}`);
      if (!res.ok) {
        throw new Error("Reverse search failed.");
      }
      const data = await res.json();
      renderResults(el("searchResults"), data.items, "reverse");
    } catch (error) {
      el("searchResults").innerHTML = "<p>Search failed. Try again.</p>";
    } finally {
      setLoading(ui.searchLoading, false);
    }
  });

  el("btnSuggest").addEventListener("click", async () => {
    const mode = el("suggestMode").value;
    setLoading(ui.suggestLoading, true, "Finding matches...");
    try {
      const res = await fetch(`/api/ulam-suggest?mode=${encodeURIComponent(mode)}&_=${Date.now()}` , {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...getAuthHeader()
        }
      });
      if (!res.ok) {
        throw new Error("Suggestion failed.");
      }
      const data = await res.json();
      renderResults(el("suggestions"), data.items, "forward");
    } catch (error) {
      el("suggestions").innerHTML = "<p>Suggestions failed. Try again.</p>";
    } finally {
      setLoading(ui.suggestLoading, false);
    }
  });

  el("searchResults").addEventListener("click", (event) => {
    const card = event.target.closest(".clickable-card");
    if (!card) {
      return;
    }
    openDishModal(card.dataset.id);
  });

  el("suggestions").addEventListener("click", (event) => {
    const card = event.target.closest(".clickable-card");
    if (!card) {
      return;
    }
    openDishModal(card.dataset.id);
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
