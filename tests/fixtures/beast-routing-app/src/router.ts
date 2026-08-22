import {
  createBrowserRouter,
  createMemoryRouter,
  redirect,
  type RouteObject,
} from "@octanejs/remix-router";
import Home from "./routes/Home.btsx";
import NotFound from "./routes/NotFound.btsx";
import Project from "./routes/Project.btsx";
import ProjectError from "./routes/ProjectError.btsx";
import Shell from "./routes/Shell.btsx";

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: Shell,
    children: [
      { index: true, Component: Home },
      {
        path: "projects/:projectId",
        loader: ({ params }) => {
          if (params.projectId === "broken") throw new Error("project loader failed");
          return { project: { id: params.projectId ?? "missing" } };
        },
        action: async ({ request }) => {
          const body = await request.formData();
          return { saved: String(body.get("name") ?? "") };
        },
        shouldRevalidate: ({ actionResult }) => actionResult !== undefined,
        Component: Project,
        ErrorBoundary: ProjectError,
      },
      { path: "legacy", loader: () => redirect("/projects/current?tab=summary") },
      { path: "*", Component: NotFound },
    ],
  },
];

export function createRoutingMemoryRouter(initialEntries: string[] = ["/"]) {
  return createMemoryRouter(routes, { initialEntries });
}

export function createRoutingBrowserRouter() {
  return createBrowserRouter(routes);
}
