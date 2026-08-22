import { useEffect } from "react";

export function UnsafeEffect() {
  useEffect(() => {
    setInterval(() => console.info("tick"), 1_000);
  }, []);

  return <p>Timer active</p>;
}
