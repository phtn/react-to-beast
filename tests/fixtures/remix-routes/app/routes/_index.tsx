import { Link } from "@remix-run/react";

export default function Index() {
  return <Link to="/projects/alpha?tab=activity">Open project</Link>;
}
