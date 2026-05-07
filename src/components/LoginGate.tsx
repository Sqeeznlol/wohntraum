import { useEffect, useState } from "react";

const PASSWORD = "StimoL6";
const STORAGE_KEY = "hsp_auth";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  if (authed === null) return null;
  if (authed) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === PASSWORD) {
      window.localStorage.setItem(STORAGE_KEY, "true");
      setAuthed(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="font-serif-display text-3xl tracking-tight text-sapphire">
            HomeseekerPlus
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.28em] text-steel">
            Zugang
          </p>
        </div>
        <div className="space-y-2 text-left">
          <input
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => {
              setPwd(e.target.value);
              setError(false);
            }}
            placeholder="Passwort"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sapphire focus:outline-none focus:ring-1 focus:ring-sapphire"
          />
          {error && (
            <p className="text-sm text-red-600">Falsches Passwort</p>
          )}
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sapphire px-4 py-2 text-sm font-medium text-white transition hover:bg-sapphire/90"
        >
          Einloggen
        </button>
      </form>
    </div>
  );
}
