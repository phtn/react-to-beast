import {
  Suspense,
  createContext,
  createPortal,
  useContext,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

const Theme = createContext<"light" | "dark">("light");

function ThemeLabel() {
  return <p>Theme: {useContext(Theme)}</p>;
}

export function InteractiveProfile({ portalTarget }: { portalTarget: HTMLElement }) {
  const [name, setName] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [role, setRole] = useState("reader");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === "/") inputRef.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const changeName = (event: ChangeEvent<HTMLInputElement>) => setName(event.currentTarget.value);
  const submit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return (
    <Theme.Provider value={theme}>
      <form onSubmit={submit}>
        <label>
          Name
          <input ref={inputRef} value={name} onChange={changeName} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={subscribed}
            onChange={(event) => setSubscribed(event.currentTarget.checked)}
          />
          Subscribe
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.currentTarget.value)}>
            <option value="reader">Reader</option>
            <option value="editor">Editor</option>
          </select>
        </label>
        <input name="nickname" defaultValue="Ada" />
        <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>Toggle theme</button>
        <button type="submit">Save</button>
        <ThemeLabel />
      </form>
      <Suspense fallback={<p>Preparing toast…</p>}>
        {createPortal(<p role="status">Editing {name || "Anonymous"}</p>, portalTarget)}
      </Suspense>
    </Theme.Provider>
  );
}
