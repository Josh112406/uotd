const config = window.UOTD_CONFIG || {};
const supabase = window.supabase.createClient(
  config.supabaseUrl || "",
  config.supabaseAnonKey || ""
);

const el = (id) => document.getElementById(id);

const state = {
  session: null
};

const updateAuthStatus = () => {
  const status = el("authStatus");
  status.textContent = state.session ? "Signed in" : "Not signed in";
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
        </div>
      `;
    })
    .join("");
};

const ensureSession = async () => {
  const { data } = await supabase.auth.getSession();
  state.session = data.session || null;
  updateAuthStatus();
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

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,budget_per_meal,kcal_target,diet_tags")
    .eq("user_id", state.session.user.id)
    .single();

  if (error || !data) {
    return;
  }

  el("displayName").value = data.display_name || "";
  el("budget").value = data.budget_per_meal || "";
  el("kcal").value = data.kcal_target || "";
  el("dietTags").value = (data.diet_tags || []).join(", ");
};

const loadPantry = async () => {
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
};

const setupHandlers = () => {
  el("btnSignUp").addEventListener("click", async () => {
    const email = el("email").value.trim();
    const password = el("password").value.trim();
    if (!email || !password) {
      return;
    }
    await supabase.auth.signUp({ email, password });
    await ensureSession();
  });

  el("btnSignIn").addEventListener("click", async () => {
    const email = el("email").value.trim();
    const password = el("password").value.trim();
    if (!email || !password) {
      return;
    }
    await supabase.auth.signInWithPassword({ email, password });
    await ensureSession();
    await loadProfile();
    await loadPantry();
  });

  el("btnSignOut").addEventListener("click", async () => {
    await supabase.auth.signOut();
    await ensureSession();
  });

  el("btnSaveProfile").addEventListener("click", async () => {
    if (!state.session) {
      return;
    }
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

    await supabase.from("profiles").upsert(payload);
  });

  el("btnAddPantry").addEventListener("click", async () => {
    const ingredientName = el("pantryName").value.trim();
    if (!ingredientName) {
      return;
    }

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
    const res = await fetch(`/api/ulam-search?ingredients=${encodeURIComponent(ingredients)}`);
    const data = await res.json();
    renderResults(el("searchResults"), data.items, "forward");
  });

  el("btnReverse").addEventListener("click", async () => {
    const dish = el("dishSearch").value.trim();
    const res = await fetch(`/api/ulam-reverse?dish=${encodeURIComponent(dish)}`);
    const data = await res.json();
    renderResults(el("searchResults"), data.items, "reverse");
  });

  el("btnSuggest").addEventListener("click", async () => {
    const mode = el("suggestMode").value;
    const res = await fetch(`/api/ulam-suggest?mode=${encodeURIComponent(mode)}` , {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      }
    });
    const data = await res.json();
    renderResults(el("suggestions"), data.items, "forward");
  });
};

ensureSession().then(() => {
  setupHandlers();
  if (state.session) {
    loadProfile();
    loadPantry();
  }
});
