import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => <main><Link to="/">Home</Link><Outlet /></main>,
  notFoundComponent: () => <h1>Not found</h1>,
});
