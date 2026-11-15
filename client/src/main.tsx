import { createRoot } from "react-dom/client";
import App from "./App";
import { registerWebMcpTools } from "./lib/webmcp";
import "./index.css";

// Let in-browser AI agents use MealMaster through WebMCP, where supported
registerWebMcpTools();

createRoot(document.getElementById("root")!).render(<App />);
