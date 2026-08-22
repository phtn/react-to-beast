import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";

export default function Root() {
  return (
    <html lang="en">
      <head><Meta /><Links /></head>
      <body><Outlet /><ScrollRestoration /><Scripts /></body>
    </html>
  );
}
