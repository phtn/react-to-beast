import { useState } from "react";
import styles from "./App.module.css";

export function App() {
  const [name, setName] = useState("");

  return (
    <label className={styles.field}>
      Name
      <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
    </label>
  );
}
