import { createRoot, flushSync } from "octane";
import App from "./App.btsx";
import { createRoutingMemoryRouter } from "./router";

type TestRouter = ReturnType<typeof createRoutingMemoryRouter>;

export async function mountRoutingApp(container: HTMLElement, initialEntries: string[]) {
  const router = createRoutingMemoryRouter(initialEntries);
  const root = createRoot(container);
  flushSync(() => root.render(App, { router }));
  await router.load();
  flushSync(() => {});
  return {
    router,
    async settleNavigation(callback: () => void | Promise<void>) {
      const resolved = new Promise<void>((resolve) => {
        const unsubscribe = router.subscribe("onResolved", () => {
          unsubscribe();
          resolve();
        });
      });
      await callback();
      await resolved;
      flushSync(() => {});
    },
    async settle(callback: () => void | Promise<void>) {
      await callback();
      flushSync(() => {});
    },
    async unmount() {
      flushSync(() => root.unmount());
      router.history.destroy();
    },
  };
}
