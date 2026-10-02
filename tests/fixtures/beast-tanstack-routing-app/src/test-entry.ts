import { createRoot, act } from "octane";
import App from "./App.btsx";
import { createRoutingMemoryRouter } from "./router";

type TestRouter = ReturnType<typeof createRoutingMemoryRouter>;

export async function mountRoutingApp(container: HTMLElement, initialEntries: string[]) {
  const router = createRoutingMemoryRouter(initialEntries);
  const root = createRoot(container);
  await act(() => root.render(App, { router }));
  await router.load();
  await act(() => {});
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
      await act(() => {});
    },
    async settle(callback: () => void | Promise<void>) {
      await callback();
      await act(() => {});
    },
    async unmount() {
      await act(() => root.unmount());
      router.history.destroy();
    },
  };
}
