import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => (
    <main>
      <Link to="/">Home</Link>
      <Link to="/projects/$projectId" params={{ projectId: "alpha" }} search={{ tab: "activity" }}>Alpha</Link>
      <Outlet />
    </main>
  ),
  notFoundComponent: () => <h1>Not found</h1>,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <h1>Home</h1>,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "projects",
  component: Outlet,
});

const projectRoute = createRoute({
  getParentRoute: () => projectsRoute,
  path: "$projectId",
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "summary",
  }),
  beforeLoad: ({ params }) => {
    if (params.projectId === "legacy") {
      throw redirect({
        to: "/projects/$projectId",
        params: { projectId: "current" },
        search: { tab: "summary" },
      });
    }
  },
  loader: ({ params }) => ({ id: params.projectId }),
  errorComponent: () => <h1>Project failed</h1>,
  component: () => <h1>Project</h1>,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, projectsRoute.addChildren([projectRoute])]),
  scrollRestoration: true,
});
