import { Form, useBlocker, useLoaderData, useParams, useSearchParams } from "react-router-dom";

export function ProjectRoute() {
  const { projectId } = useParams();
  const { project } = useLoaderData() as { project: { id: string } };
  const [search] = useSearchParams();
  useBlocker(false);
  return (
    <Form method="post">
      <h1>Project {projectId ?? project.id}: {search.get("tab") ?? "summary"}</h1>
      <input name="name" />
      <button type="submit">Save</button>
    </Form>
  );
}
