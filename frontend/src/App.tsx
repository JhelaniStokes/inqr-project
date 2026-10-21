import { useEffect, useState } from "react";
import { PenLine, LogOut } from "lucide-react";
import { api, getToken, setToken } from "./api";
import { Button } from "./components/ui";
import Login from "./Login";
import Dashboard from "./Dashboard";
import History from "./History";

type Page = "dashboard" | "history";

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(!!getToken());
  const [page, setPage] = useState<Page>("dashboard");

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((r) => setUser(r.username))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!user) return <Login onLogin={setUser} />;

  const logout = async () => {
    await api.logout().catch(() => {});
    setToken(null);
    setUser(null);
  };

  const navLink = (p: Page, label: string) => (
    <button
      onClick={() => setPage(p)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer ${
        page === p ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-semibold">
              <PenLine className="h-5 w-5 text-indigo-600" />
              CWE Feedback Tracker
            </div>
            <nav className="flex gap-1">
              {navLink("dashboard", "Dashboard")}
              {navLink("history", "History")}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {user}
            <Button variant="ghost" onClick={logout} className="px-2">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {page === "dashboard" ? <Dashboard /> : <History />}
      </main>
    </div>
  );
}
