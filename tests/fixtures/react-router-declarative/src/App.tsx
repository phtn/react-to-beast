import {
  BrowserRouter,
  Link,
  Outlet,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from "react-router";

function ProjectsLayout() {
  return (
    <section>
      <Link to="/projects?sort=name">Projects</Link>
      <Outlet />
    </section>
  );
}

function Project() {
  const { projectId } = useParams();
  const [search] = useSearchParams();
  return <h1>{projectId}: {search.get("tab") ?? "summary"}</h1>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<h1>Home</h1>} />
        <Route path="projects" element={<ProjectsLayout />}>
          <Route index element={<h1>Projects</h1>} />
          <Route path=":projectId" element={<Project />} />
        </Route>
        <Route path="*" element={<h1>Not found</h1>} />
      </Routes>
    </BrowserRouter>
  );
}
