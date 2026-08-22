import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  if (params.projectId === "legacy") throw redirect("/projects/current");
  return json({ project: { id: params.projectId } });
}

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();
  return json({ saved: body.get("name") });
}

export function ErrorBoundary() {
  return <h1>Project failed</h1>;
}

export default function Project() {
  const { project } = useLoaderData<typeof loader>();
  const [search] = useSearchParams();
  return (
    <Form method="post">
      <h1>{project.id}: {search.get("tab")}</h1>
      <input name="name" />
      <button type="submit">Save</button>
    </Form>
  );
}
