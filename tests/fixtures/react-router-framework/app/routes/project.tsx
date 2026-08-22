import { Form, redirect } from "react-router";

export async function loader({ params }: { params: { projectId: string } }) {
  if (params.projectId === "legacy") throw redirect("/projects/current");
  return { project: { id: params.projectId } };
}

export async function action() {
  return { saved: true };
}

export function ErrorBoundary() {
  return <h1>Project failed</h1>;
}

export default function Project() {
  return <Form method="post"><button type="submit">Save</button></Form>;
}
