import { createRoot } from "octane";
import App from "./App.btsx";
import { createRoutingBrowserRouter } from "./router";

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app container");

createRoot(container).render(App, { router: createRoutingBrowserRouter() });
