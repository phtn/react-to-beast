import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { HomeRoute } from "./routes/HomeRoute";
import { ProjectRoute } from "./routes/ProjectRoute";

const router = createBrowserRouter([
  { path: "/", element: <HomeRoute /> },
  { path: "/projects/:projectId", element: <ProjectRoute /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
