import { Link, Outlet, useNavigation } from "react-router-dom";

export function ShellRoute() {
  const navigation = useNavigation();
  return (
    <main>
      <nav><Link to="/">Home</Link></nav>
      <output>{navigation.state}</output>
      <Outlet />
    </main>
  );
}
