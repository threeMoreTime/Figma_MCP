/**
 * Micro Client Router for Greenfield HTML Prototype
 * Handles route hash matching according to ui-blueprint.json route: "/users"
 */

class MicroRouter {
  constructor(routes = {}) {
    this.routes = routes;
    window.addEventListener("hashchange", () => this.handleRoute());
  }

  init() {
    if (!window.location.hash) {
      window.location.hash = "#/users";
    }
    this.handleRoute();
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || "/users";
    const handler = this.routes[hash] || this.routes["/users"];
    if (handler) {
      handler(hash);
    }
  }
}

if (typeof window !== "undefined") {
  window.D2C_ROUTER = { MicroRouter };
}
