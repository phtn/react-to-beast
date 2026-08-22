import { act, createRoot } from "octane";
import App from "./App.btsx";
import { createRoutingMemoryRouter } from "./router";

type TestRouter = ReturnType<typeof createRoutingMemoryRouter>;

export async function waitForRouterIdle(router: TestRouter) {
  if (router.state.initialized && router.state.navigation.state === "idle") return;
  await new Promise<void>((resolve) => {
    const unsubscribe = router.subscribe((state) => {
      if (!state.initialized || state.navigation.state !== "idle") return;
      unsubscribe();
      resolve();
    });
  });
}

export async function mountRoutingApp(container: HTMLElement, initialEntries: string[]) {
  const router = createRoutingMemoryRouter(initialEntries);
  await waitForRouterIdle(router);
  const root = createRoot(container);
  await act(() => root.render(App, { router }));
  return {
    router,
    async settle(callback: () => void | Promise<void>) {
      await act(callback);
    },
    async unmount() {
      await act(() => root.unmount());
      await router.dispose();
    },
  };
}
