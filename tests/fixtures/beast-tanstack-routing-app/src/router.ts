import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@octanejs/tanstack-router";
import Home from "./routes/Home.btsx";
import NotFound from "./routes/NotFound.btsx";
import Project from "./routes/Project.btsx";
import ProjectError from "./routes/ProjectError.btsx";
import Shell from "./routes/Shell.btsx";

const rootRoute = createRootRoute({
  component: Shell,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
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
  loader: ({ params }) => {
    if (params.projectId === "broken") throw new Error("tanstack project loader failed");
    return { project: { id: params.projectId } };
  },
  beforeLoad: ({ params }) => {
    if (params.projectId !== "legacy") return;
    throw redirect({
      to: "/projects/$projectId",
      params: { projectId: "current" },
      search: { tab: "summary" },
    });
  },
  component: Project,
  errorComponent: ProjectError,
});

const routeTree = rootRoute.addChildren([indexRoute, projectsRoute.addChildren([projectRoute])]);

export function createRoutingMemoryRouter(initialEntries: string[] = ["/"]) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries }),
    notFoundMode: "root",
  });
}

export function createRoutingBrowserRouter() {
  return createRouter({
    routeTree,
    history: createBrowserHistory(),
    notFoundMode: "root",
  });
}
