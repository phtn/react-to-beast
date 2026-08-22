import { useParams } from "react-router-dom";

export function ProjectRoute() {
  const { projectId } = useParams();
  return <h1>Project {projectId}</h1>;
}
