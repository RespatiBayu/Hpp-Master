import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import PosStandaloneApp from "./views/PosStandaloneApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PosStandaloneApp />
  </StrictMode>
);
