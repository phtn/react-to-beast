import { createBrowserRouter, redirect, RouterProvider } from "react-router-dom";
import { HomeRoute } from "./routes/HomeRoute";
import { ProjectRoute } from "./routes/ProjectRoute";
import { ShellRoute } from "./routes/ShellRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ShellRoute />,
    children: [
      { index: true, element: <HomeRoute /> },
      {
        path: "projects/:projectId",
        loader: ({ params }) => ({ project: { id: params.projectId } }),
        action: async ({ request }) => ({ saved: (await request.formData()).get("name") }),
        shouldRevalidate: ({ actionResult }) => Boolean(actionResult),
        errorElement: <h1>Project failed</h1>,
        element: <ProjectRoute />,
      },
      { path: "legacy", loader: () => redirect("/projects/current?tab=summary") },
      { path: "*", element: <h1>Not found</h1> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
