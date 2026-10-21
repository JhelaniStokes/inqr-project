import { useEffect, useState } from "react";
import { Plus, X, Sparkles, Loader2, ThumbsUp, AlertTriangle, CheckSquare } from "lucide-react";
import { api, fmtDate, type ReportResponse } from "./api";
import { Badge, Button, Card, CardHeader, ErrorText, Input, Label, Textarea } from "./components/ui";

export default function Dashboard() {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const refresh = () => api.getReport().then(setReport);

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <AddSubmission onAdded={refresh} />
      </div>
      <div className="lg:col-span-3">
        <ChecklistPanel data={report} onGenerated={setReport} />
      </div>
    </div>
  );
}

function AddSubmission({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [paper, setPaper] = useState("");
  const [notes, setNotes] = useState<string[]>([""]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const setNote = (i: number, v: string) => setNotes(notes.map((n, j) => (j === i ? v : n)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.createSubmission(title, paper, notes);
      setTitle("");
      setPaper("");
      setNotes([""]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader title="Add a submission" description="Paste your paper and the feedback you got on it." />
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <Label>Title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ENGL 1101 – Essay 2" />
        </div>
        <div>
          <Label>Paper</Label>
          <Textarea rows={6} value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="Paste your paper here…" />
        </div>
        <div>
          <Label>Feedback notes</Label>
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={n}
                  onChange={(e) => setNote(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. Thesis isn't arguable" : "Another note…"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setNotes([...notes, ""]);
                    }
                  }}
                />
                {notes.length > 1 && (
                  <Button type="button" variant="ghost" className="px-2" onClick={() => setNotes(notes.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => setNotes([...notes, ""])}>
            <Plus className="h-4 w-4" /> Add note
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full">
          {saved ? "Saved ✓" : "Submit"}
        </Button>
      </form>
    </Card>
  );
}

function ChecklistPanel({ data, onGenerated }: { data: ReportResponse | null; onGenerated: (r: ReportResponse) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const report = data?.report;

  const generate = async () => {
    setError("");
    setLoading(true);
    try {
      onGenerated(await api.generateReport());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Your writing checklist"
        description={
          report
            ? `Generated ${fmtDate(report.generated_at)} from ${data!.submission_count} submission${data!.submission_count === 1 ? "" : "s"}`
            : "Built from patterns across all of your feedback."
        }
      >
        <div className="flex items-center gap-2">
          {report && data!.stale && <Badge tone="amber">Out of date</Badge>}
          <Button onClick={generate} disabled={loading || !data?.submission_count}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {report ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </CardHeader>
      <div className="p-5">
        <ErrorText>{error}</ErrorText>
        {!report ? (
          <p className="py-10 text-center text-sm text-slate-500">
            {data?.submission_count
              ? "Hit Generate to build your personalized checklist."
              : "Add a submission to get started."}
          </p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <List icon={<ThumbsUp className="h-4 w-4 text-emerald-600" />} title="Strengths" items={report.strengths} />
              <List icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} title="Recurring weaknesses" items={report.weaknesses} />
            </div>
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CheckSquare className="h-4 w-4 text-indigo-600" /> Before you submit, check:
              </h3>
              <ol className="space-y-2">
                {report.checklist.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-sm font-medium">{c.item}</p>
                    {c.seen_on != null && (
                      <span
                        title={c.why}
                        className="shrink-0 cursor-help whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                      >
                        {c.seen_on}/{data!.submission_count} papers
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function List({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
