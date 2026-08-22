import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>) => ({ tab: String(search.tab ?? "summary") }),
  beforeLoad: ({ params }) => {
    if (params.projectId === "legacy") throw redirect({ to: "/projects/current" });
  },
  loader: ({ params }) => ({ id: params.projectId }),
  errorComponent: () => <h1>Project failed</h1>,
  component: () => <h1>Project</h1>,
});
