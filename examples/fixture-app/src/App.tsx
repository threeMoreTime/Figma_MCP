import React from "react";
import UsersPage from "./pages/UsersPage.js";

export const App: React.FC = () => {
  return (
    <div style={{ maxWidth: 1200, margin: "20px auto", fontFamily: "sans-serif" }}>
      <UsersPage />
    </div>
  );
};

export default App;
