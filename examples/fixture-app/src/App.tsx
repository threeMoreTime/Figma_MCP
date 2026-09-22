import React from "react";
import UsersPage from "./pages/UsersPage.js";
import { getAdaptedUsersPagePropsForRevision } from "./adapter/page-adapter.js";

export interface AppProps {
  revision?: 1 | 2;
}

export const App: React.FC<AppProps> = ({ revision: initialRev }) => {
  let rev = initialRev;
  if (!rev && typeof window !== "undefined" && window.location) {
    const params = new URLSearchParams(window.location.search);
    const revParam = params.get("rev");
    if (revParam === "2") {
      rev = 2;
    } else {
      rev = 1;
    }
  }

  const adaptedProps = getAdaptedUsersPagePropsForRevision((rev || 1) as 1 | 2);

  return (
    <div style={{ maxWidth: 1200, margin: "20px auto", fontFamily: "sans-serif" }}>
      <UsersPage {...adaptedProps} />
    </div>
  );
};

export default App;

