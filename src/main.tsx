import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// ft-design-system styles
import "../node_modules/ft-design-system/dist/dist/styles.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
