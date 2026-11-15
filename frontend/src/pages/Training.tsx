import { useEffect, useState } from "react";
import { Award, BookOpen, CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "../lib/api";
import type { Module, Quiz, QuizResult } from "../lib/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Modal, Textarea } from "../components/ui";
import { useAuth } from "../lib/auth";

const CATEGORY_LABELS: Record<string, string> = {
  phishing: "Phishing Awareness",
  social_engineering: "Social Engineering",
  passwords: "Password Security",
  mfa: "Multi-Factor Auth",
  email_security: "Email Security",
};

export default function Training() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [active, setActive] = useState<Module | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<QuizResult[]>([]);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", category: "phishing", content: "", duration_minutes: 10 });
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    api<Module[]>("/training/modules").then(setModules).catch(() => {});
    api<Quiz[]>("/training/quizzes").then(setQuizzes).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  // For participants, allow quiz-taking: use first participant record matching email? Participants log in as users;
  // quizzes need participant_id. Fetch participants list to find own record.
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  useEffect(() => {
    if (user?.role === "participant") {
      // participant users have participant_id not exposed; fetch via participants list (org_admin only).
      // For demo, participants use the admin quiz submit with their linked id; fallback: first participant.
      api<any[]>("/participants").then((list) => {
        const match = list.find((p) => p.email === user.email);
        setMyParticipantId(match?.id || list[0]?.id || null);
      }).catch(() => {});
    }
  }, [user]);

  const moduleQuizzes = (mid: string) => quizzes.filter((q) => q.module_id === mid);

  const startQuiz = (q: Quiz) => {
    setQuiz(q);
    setAnswers({});
    setResult(null);
  };

  const submitQuiz = async () => {
    if (!quiz || !myParticipantId) return;
    const res = await api<any>(`/training/quizzes/${quiz.id}/submit`, {
      method: "POST",
      body: { participant_id: myParticipantId, answers },
    });
    setResult(res);
    api<QuizResult[]>(`/training/results/${myParticipantId}`).then(setHistory).catch(() => {});
  };

  const createModule = async (e: React.FormEvent) => {
    e.preventDefault();
    await api("/training/modules", { method: "POST", body: { ...moduleForm, organization_id: user?.organization_id } });
    setShowCreate(false);
    setModuleForm({ title: "", description: "", category: "phishing", content: "", duration_minutes: 10 });
    load();
  };

  const canEdit = user?.role !== "participant";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Security Awareness Training</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Lessons, quizzes, and completion tracking</p>
        </div>
        {canEdit && <Button onClick={() => setShowCreate(true)}>New Module</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <Card key={m.id} className="flex flex-col">
            <CardContent className="pt-5 flex-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent-500" />
                <Badge tone="blue">{CATEGORY_LABELS[m.category] || m.category}</Badge>
              </div>
              <h3 className="mt-2 font-semibold">{m.title}</h3>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{m.description}</p>
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" /> {m.duration_minutes} min · {moduleQuizzes(m.id).length} quiz{moduleQuizzes(m.id).length === 1 ? "" : "zes"}
              </div>
            </CardContent>
            <div className="border-t border-slate-200 dark:border-navy-700 px-5 py-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setActive(m)}>Read</Button>
              {moduleQuizzes(m.id).map((q) => (
                <Button key={q.id} size="sm" onClick={() => startQuiz(q)}>Quiz</Button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Lesson reader */}
      <Modal open={!!active} onClose={() => setActive(null)} title={active?.title || ""} wide>
        {active && (
          <div className="prose-sm max-w-none">
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <Badge tone="blue">{CATEGORY_LABELS[active.category]}</Badge>
              <span>{active.duration_minutes} min</span>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{active.content}</div>
          </div>
        )}
      </Modal>

      {/* Quiz modal */}
      <Modal open={!!quiz} onClose={() => setQuiz(null)} title={quiz?.title || "Quiz"} wide>
        {quiz && !result && (
          <div className="space-y-5">
            {quiz.questions.map((q, qi) => (
              <div key={q.id} className="rounded-lg border border-slate-200 dark:border-navy-700 p-4">
                <div className="font-medium text-sm mb-3">{qi + 1}. {q.question}</div>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${answers[q.id] === oi ? "border-accent-500 bg-accent-500/10" : "border-slate-200 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-800"}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Passing score: {quiz.passing_score}%</span>
              <Button onClick={submitQuiz} disabled={Object.keys(answers).length < quiz.questions.length}>Submit Answers</Button>
            </div>
          </div>
        )}
        {quiz && result && (
          <div className="space-y-4">
            <div className={`rounded-xl p-5 text-center ${result.passed ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <div className="text-3xl font-bold">{result.score}%</div>
              <div className="flex items-center justify-center gap-2 mt-1">
                {result.passed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                <span className="font-medium">{result.passed ? "Passed" : "Not passed"} — {result.correct}/{result.total} correct</span>
              </div>
            </div>
            {result.passed && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
                <Award className="h-8 w-8 text-amber-500" />
                <div>
                  <div className="font-semibold">Certificate of Completion</div>
                  <div className="text-sm text-slate-500">Awarded for passing "{quiz.title}"</div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {quiz.questions.map((q, qi) => {
                const d = result.details[q.id];
                return (
                  <div key={q.id} className={`rounded-lg border p-3 text-sm ${d.correct ? "border-emerald-300 dark:border-emerald-800" : "border-red-300 dark:border-red-800"}`}>
                    <div className="font-medium">{qi + 1}. {q.question}</div>
                    {!d.correct && (
                      <div className="mt-1 text-xs text-slate-500">
                        Correct answer: <b>{q.options[d.correct_index]}</b>
                        {d.explanation && <span> — {d.explanation}</span>}
                      </div>
                    )}
                    {d.correct && d.explanation && <div className="mt-1 text-xs text-slate-500">{d.explanation}</div>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setQuiz(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create module */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Training Module" wide>
        <form onSubmit={createModule} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title"><Input required value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} /></Field>
            <Field label="Category">
              <select className="w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 py-2 text-sm" value={moduleForm.category} onChange={(e) => setModuleForm({ ...moduleForm, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description"><Input required value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} /></Field>
          <Field label="Duration (minutes)"><Input type="number" min={1} value={moduleForm.duration_minutes} onChange={(e) => setModuleForm({ ...moduleForm, duration_minutes: +e.target.value })} /></Field>
          <Field label="Content (Markdown)"><Textarea rows={8} required className="font-mono text-xs" value={moduleForm.content} onChange={(e) => setModuleForm({ ...moduleForm, content: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      {/* Quiz history */}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Your Quiz History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-2 text-sm">
                  <span>{quizzes.find((q) => q.id === r.quiz_id)?.title || r.quiz_id}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.score}%</span>
                    <Badge tone={r.passed ? "green" : "red"}>{r.passed ? "Passed" : "Failed"}</Badge>
                    <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
