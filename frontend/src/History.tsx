import { useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { api, fmtDate, type Submission } from "./api";
import { Badge, Button, Card, CardHeader } from "./components/ui";

export default function History() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);

  const load = () => api.listSubmissions().then(setSubs);
  useEffect(() => {
    load();
  }, []);

  const open = async (id: number) => setSelected(await api.getSubmission(id));

  const remove = async (id: number) => {
    if (!confirm("Delete this submission?")) return;
    await api.deleteSubmission(id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Past submissions" description={`${subs.length} total`} />
        <ul className="divide-y divide-slate-100">
          {subs.length === 0 && <li className="p-5 text-sm text-slate-500">Nothing here yet.</li>}
          {subs.map((s) => (
            <li
              key={s.id}
              onClick={() => open(s.id)}
              className={`group flex cursor-pointer items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 ${
                selected?.id === s.id ? "bg-indigo-50/60" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="text-xs text-slate-500">
                  {fmtDate(s.created_at)} · {s.feedback.length} notes
                </p>
              </div>
              <Button
                variant="destructive"
                className="px-2 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(s.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-3">
        {!selected ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-500">
            <FileText className="mb-2 h-8 w-8 text-slate-300" />
            Select a submission to view it.
          </div>
        ) : (
          <>
            <CardHeader title={selected.title} description={fmtDate(selected.created_at)}>
              <Badge>{selected.feedback.length} notes</Badge>
            </CardHeader>
            <div className="space-y-5 p-5">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Feedback</h3>
                <ul className="space-y-2">
                  {selected.feedback.map((f, i) => (
                    <li key={i} className="rounded-lg border-l-4 border-indigo-400 bg-slate-50 px-3 py-2 text-sm">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Paper</h3>
                <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 p-4 text-sm leading-relaxed text-slate-700">
                  {selected.paper_text}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
