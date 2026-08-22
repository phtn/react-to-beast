import { createRoot } from "octane";
import InteractiveProfile from "../../beast-interactive/InteractiveProfile.btsx";

const container = document.querySelector<HTMLElement>("#app");
if (container === null) throw new Error("Interactive fixture host is missing.");

createRoot(container).render(InteractiveProfile, {
  initialName: "Ada",
  onConnect() {},
  onDisconnect() {},
  onRefAttach() {},
  onSubmit() {},
});
