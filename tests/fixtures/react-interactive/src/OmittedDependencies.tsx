import { useCallback, useEffect, useMemo } from "react";

export function OmittedDependencies({ value }: { value: number }) {
  useEffect(() => console.info(value));
  const doubled = useMemo(() => value * 2);
  const report = useCallback(() => console.info(doubled));

  return <button onClick={report}>Report {doubled}</button>;
}
