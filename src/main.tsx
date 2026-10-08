import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { LoadingSheet } from "./ui/LoadingSheet";
import { InstallHint } from "./ui/InstallHint";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LoadingSheet />
    <App />
    <InstallHint />
  </React.StrictMode>
);
