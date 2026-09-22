/**
 * State Management & DOM Interaction Engine for Greenfield HTML Prototype
 * Conforms 100% to interaction-contract.json and ui-blueprint.json.
 */

class PrototypeState {
  constructor() {
    this.pageState = "ready"; // "ready" | "loading" | "empty" | "error"
    this.users = [];
    this.filteredUsers = [];
    this.searchText = "";
  }

  async init() {
    this.bindEvents();
    const api = window.D2C_MOCK_API;
    if (api && typeof api.fetchUsers === "function") {
      this.users = await api.fetchUsers();
    }
    this.applyFilter();
    this.render();
  }

  setPageState(newState) {
    this.pageState = newState;
    this.render();
  }

  setSearchText(text) {
    this.searchText = text.trim().toLowerCase();
    this.applyFilter();
    this.renderTableOnly();
  }

  applyFilter() {
    if (!this.searchText) {
      this.filteredUsers = [...this.users];
    } else {
      this.filteredUsers = this.users.filter((u) => {
        return (
          u.name.toLowerCase().includes(this.searchText) ||
          u.email.toLowerCase().includes(this.searchText) ||
          u.role.toLowerCase().includes(this.searchText)
        );
      });
    }
  }

  bindEvents() {
    // State switcher buttons
    document.getElementById("btn-state-ready")?.addEventListener("click", () => this.setPageState("ready"));
    document.getElementById("btn-state-loading")?.addEventListener("click", () => this.setPageState("loading"));
    document.getElementById("btn-state-empty")?.addEventListener("click", () => this.setPageState("empty"));
    document.getElementById("btn-state-error")?.addEventListener("click", () => this.setPageState("error"));

    // Search filter
    const searchInput = document.getElementById("input-search");
    searchInput?.addEventListener("input", (e) => {
      this.setSearchText(e.target.value);
    });

    // Create Modal triggers
    const createBtn = document.getElementById("btn-create-user");
    const modal = document.getElementById("modal-create-user");
    const closeBtn = document.getElementById("btn-modal-close");
    const cancelBtn = document.getElementById("btn-modal-cancel");
    const form = document.getElementById("form-create-user");

    createBtn?.addEventListener("click", () => {
      this.resetFormValidation();
      form?.reset();
      if (typeof modal?.showModal === "function") {
        modal.showModal();
      } else {
        modal?.setAttribute("open", "");
      }
    });

    const closeModal = () => {
      if (typeof modal?.close === "function") {
        modal.close();
      } else {
        modal?.removeAttribute("open");
      }
      this.resetFormValidation();
    };

    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);

    // Form submit
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById("input-username");
      const emailInput = document.getElementById("input-email");
      const roleInput = document.getElementById("input-role");

      const username = usernameInput?.value?.trim() || "";
      const email = emailInput?.value?.trim() || "";
      const role = roleInput?.value?.trim() || "";

      let hasError = false;
      this.resetFormValidation();

      if (!username) {
        hasError = true;
        this.showFieldError("username", "请输入用户姓名");
      }

      if (!role) {
        hasError = true;
        this.showFieldError("role", "请输入系统角色");
      }

      if (hasError) {
        return;
      }

      try {
        const api = window.D2C_MOCK_API;
        if (!api || typeof api.createUser !== "function") {
          throw new Error("Mock API 未初始化");
        }
        const newUser = await api.createUser({ username, email, role });
        this.users = [newUser, ...this.users];
        this.applyFilter();
        closeModal();
        this.renderTableOnly();
        this.showToast("用户创建成功");
      } catch (err) {
        alert(err.message || "创建失败");
      }
    });
  }

  showFieldError(field, message) {
    const errorEl = document.getElementById("error-" + field);
    const inputEl = document.getElementById("input-" + field);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("visible");
    }
    if (inputEl) {
      inputEl.classList.add("has-error");
    }
  }

  resetFormValidation() {
    document.querySelectorAll(".d2c-error-msg").forEach((el) => {
      el.textContent = "";
      el.classList.remove("visible");
    });
    document.querySelectorAll(".d2c-input").forEach((el) => {
      el.classList.remove("has-error");
    });
  }

  showToast(message) {
    const container = document.getElementById("notification-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "d2c-toast";
    toast.id = "toast-notice";
    toast.innerHTML = `<span class="d2c-tag d2c-tag-success">成功</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  renderTableOnly() {
    const tbody = document.getElementById("users-table-tbody");
    if (!tbody) return;

    tbody.innerHTML = this.filteredUsers
      .map((u) => {
        const roleColorClass =
          u.role === "超级管理员"
            ? "d2c-tag-primary"
            : u.role === "安全审计员"
            ? "d2c-tag-primary"
            : "d2c-tag";
        const statusColorClass = u.status === "active" ? "d2c-tag-success" : "d2c-tag-danger";
        const statusText = u.status === "active" ? "正常" : "禁用";
        const actionText = u.status === "active" ? "禁用" : "启用";

        return `<tr class="d2c-table-row" data-user-id="${u.id}">
  <td class="d2c-td" data-col="name">${u.name}</td>
  <td class="d2c-td" data-col="email">${u.email}</td>
  <td class="d2c-td" data-col="role"><span class="d2c-tag ${roleColorClass}">${u.role}</span></td>
  <td class="d2c-td" data-col="status"><span class="d2c-tag ${statusColorClass}">${statusText}</span></td>
  <td class="d2c-td" data-col="createdAt">${u.createdAt}</td>
  <td class="d2c-td" data-col="action">
    <button type="button" class="d2c-btn d2c-btn-link" data-semantic-id="users.management.row_toggle" onclick="window.__toggleStatus('${u.id}')">
      ${actionText}
    </button>
  </td>
</tr>`;
      })
      .join("");
  }

  render() {
    // 1. Update State Switcher active styling
    ["ready", "loading", "empty", "error"].forEach((s) => {
      const btn = document.getElementById("btn-state-" + s);
      if (btn) {
        if (s === this.pageState) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });

    // 2. Toggle content views
    const loadingView = document.getElementById("state-loading-view");
    const errorView = document.getElementById("state-error-view");
    const emptyView = document.getElementById("state-empty-view");
    const readyView = document.getElementById("state-ready-view");

    if (loadingView) loadingView.style.display = this.pageState === "loading" ? "block" : "none";
    if (errorView) errorView.style.display = this.pageState === "error" ? "block" : "none";
    if (emptyView) emptyView.style.display = this.pageState === "empty" ? "block" : "none";
    if (readyView) readyView.style.display = this.pageState === "ready" ? "block" : "none";

    if (this.pageState === "ready") {
      this.renderTableOnly();
    }
  }
}

// Global hook for row toggle
window.__toggleStatus = (id) => {
  const app = window.__d2cPrototypeState;
  if (!app) return;
  app.users = app.users.map((u) =>
    u.id === id ? { ...u, status: u.status === "active" ? "disabled" : "active" } : u
  );
  app.applyFilter();
  app.renderTableOnly();
};

if (typeof window !== "undefined") {
  window.D2C_STATE = { PrototypeState };
}
