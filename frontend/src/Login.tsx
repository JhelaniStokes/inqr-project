import { useState } from "react";
import { PenLine } from "lucide-react";
import { api, setToken } from "./api";
import { Button, Card, ErrorText, Input, Label } from "./components/ui";

export default function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await (mode === "login" ? api.login : api.signup)(username, password);
      setToken(r.token);
      onLogin(r.username);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const tab = (m: typeof mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md py-1.5 text-sm font-medium cursor-pointer ${
        mode === m ? "bg-white shadow-sm" : "text-slate-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <PenLine className="mx-auto mb-2 h-8 w-8 text-indigo-600" />
          <h1 className="text-xl font-semibold">CWE Feedback Tracker</h1>
          <p className="mt-1 text-sm text-slate-500">Turn your past feedback into a personal writing checklist.</p>
        </div>
        <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1">
          {tab("login", "Log in")}
          {tab("signup", "Sign up")}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
