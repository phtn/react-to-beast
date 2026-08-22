import { Link, Outlet, ScrollRestoration } from "react-router";

export default function Shell() {
  return (
    <main>
      <Link to="/">Home</Link>
      <Outlet />
      <ScrollRestoration />
    </main>
  );
}
