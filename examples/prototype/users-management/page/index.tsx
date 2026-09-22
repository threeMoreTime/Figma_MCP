import React from "react";
import ReactDOM from "react-dom/client";
import { UsersManagementPage } from "./UsersManagementPage.js";
import "./page.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<UsersManagementPage />);
}
