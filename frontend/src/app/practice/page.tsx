"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Brain, Check, CheckCircle2, Clock3, Flame, Heart, RotateCcw, Trophy, Zap } from "lucide-react";
import { api, PracticeAnswerResponse, PracticeQuestion, PracticeQuestionsResponse, PracticeSummary } from "@/lib/api";

type Mode = "mcq" | "typing" | "mixed" | "review";
type Feedback = { correct: boolean; answer: string; message: string };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function PracticePage() {
  const [mode, setMode] = useState<Mode>("mixed");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [roundXp, setRoundXp] = useState(0);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [summary, setSummary] = useState<PracticeSummary>({ mistakes_to_review: 0, questions_practiced_today: 0 });
  const recordSaved = useRef(false);
  const isSprint = mode !== "review";
  const current = questions[index];
  const options = useMemo(() => Array.isArray(current?.options) ? current.options.filter((x): x is string => typeof x === "string") : [], [current]);
  const isChoice = current?.exercise_type === "multiple_choice" || current?.exercise_type === "fill_blank";
  const roundOver = isSprint && !running && (seconds === 0 || (questions.length > 0 && index >= questions.length));
  const reviewComplete = mode === "review" && questions.length > 0 && index >= questions.length;

  const loadSummary = useCallback(async () => {
    try { setSummary(await api<PracticeSummary>("/api/practice/summary")); } catch { /* supplementary panel */ }
  }, []);

  const loadQuestions = useCallback(async (nextMode: Mode, startRound = true) => {
    setLoading(true); setError(""); setFeedback(null); setAnswer(""); setIndex(0); recordSaved.current = false; setPersonalBest(null);
    try {
      const response = await api<PracticeQuestionsResponse>(`/api/practice/questions?mode=${nextMode}&limit=20`);
      setQuestions(response.questions);
      setSeconds(60); setScore(0); setAnswered(0); setRoundXp(0);
      setRunning(nextMode !== "review" && startRound && response.questions.length > 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load practice questions."); setQuestions([]); setRunning(false);
    } finally { setLoading(false); }
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => { void loadQuestions("mixed", true); }, [loadQuestions]);
  useEffect(() => {
    if (!running || mode === "review") return;
    const timer = window.setInterval(() => setSeconds((v) => {
      if (v <= 1) { window.clearInterval(timer); setRunning(false); return 0; }
      return v - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running, mode]);

  useEffect(() => {
    if (mode === "review" || running || loading || answered === 0 || recordSaved.current) return;
    if (seconds > 0 && index < questions.length) return;
    recordSaved.current = true;
    api<{ success: boolean; best_correct: number }>("/api/practice/sprint-record", {
      method: "POST", body: JSON.stringify({ mode, answered, correct: score, xp_earned: roundXp, duration_seconds: 60 - seconds }),
    }).then((result) => setPersonalBest(result.best_correct)).catch(() => setPersonalBest(score));
  }, [mode, running, loading, answered, seconds, index, questions.length, score, roundXp]);

  async function submitAnswer(value: string) {
    if (!current || submitting || feedback || !value.trim()) return;
    setSubmitting(true); setError("");
    try {
      const result = await api<PracticeAnswerResponse>("/api/practice/answer", { method: "POST", body: JSON.stringify({ exercise_id: current.id, answer: value, mode }) });
      setFeedback({ correct: result.correct, answer: result.correct_answer, message: result.message });
      setAnswered((n) => n + 1); setRoundXp((n) => n + result.xp_earned);
      if (result.correct) setScore((n) => n + 1);
      void loadSummary();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not check that answer."); }
    finally { setSubmitting(false); }
  }

  function advance() {
    setFeedback(null); setAnswer("");
    if (index + 1 >= questions.length) { setIndex(questions.length); if (isSprint) setRunning(false); return; }
    setIndex((n) => n + 1);
  }
  function startMode(next: Mode) { setMode(next); void loadQuestions(next, next !== "review"); }
  function restart() { void loadQuestions(mode === "review" ? "mixed" : mode, true); }
  const progress = isSprint ? Math.max(0, Math.min(100, seconds / 60 * 100)) : questions.length ? Math.min(100, index / questions.length * 100) : 0;

  return <main className="min-h-screen bg-[#f7f9fc] text-[#202b3c]">
    <header className="border-b border-[#e4eaf2] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link href="/" className="flex items-center gap-2 text-sm font-extrabold text-gray-500 hover:text-[#238636]"><ArrowLeft size={18}/> Back to learning path</Link><Link href="/" aria-label="Onelingo home" className="flex items-center"><Image src="/onelingo-logo.svg" alt="Onelingo" width={160} height={55} priority className="h-11 w-auto object-contain" /></Link><Link href="/profile" className="text-sm font-extrabold text-gray-500">Profile</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#182b49] via-[#234b83] to-[#2878a9] p-6 text-white shadow-xl sm:p-9"><div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-cyan-100"><Zap size={14}/> Lingo practice arcade</div><h1 className="max-w-2xl text-3xl font-black sm:text-4xl">Small rounds. <span className="text-[#b8f36b]">Big brain gains.</span></h1><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">Pick one answer style, race the clock, and build a personal best. Practice never removes lesson hearts.</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/10 px-3 py-2"><Heart size={13} className="mr-1 inline"/> No hearts lost</span><span className="rounded-full bg-white/10 px-3 py-2"><Trophy size={13} className="mr-1 inline"/> Saved records</span></div></div><div className="grid grid-cols-2 gap-3 md:w-64"><div className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-blue-100">Mistakes to fix</p><p className="mt-1 text-3xl font-black">{summary.mistakes_to_review}</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-blue-100">Practiced today</p><p className="mt-1 text-3xl font-black">{summary.questions_practiced_today}</p></div></div></div></section>
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]"><section className="min-w-0">
        <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-[#e3e9f1] bg-white p-2 lg:grid-cols-4">{([ ["mcq", "MCQ Sprint", "Choice questions", "🟦"], ["typing", "Typing Sprint", "Type answers", "⌨️"], ["mixed", "Mixed Sprint", "A little of both", "⚡"], ["review", "Mistake dojo", "Fix tricky words", "🧠"] ] as [Mode, string, string, string][]).map(([value, title, subtitle, emoji]) => <button key={value} onClick={() => startMode(value)} className={`flex items-center gap-3 rounded-xl p-3 text-left ${mode === value ? "bg-[#eaf3ff] ring-2 ring-[#bcd7ff]" : "hover:bg-gray-50"}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl">{emoji}</span><span><span className="block text-sm font-black">{title}</span><span className="mt-1 block text-xs text-gray-500">{subtitle}</span></span></button>)}</div>
        <div className="overflow-hidden rounded-3xl border border-[#e3e9f1] bg-white shadow-sm"><div className="border-b border-[#edf0f5] px-5 py-4 sm:px-7"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{isSprint ? `${mode.toUpperCase()} · 60-second sprint` : "Personalised · Review queue"}</p><h2 className="mt-1 text-xl font-black">{isSprint ? "How many can you get right?" : "Turn misses into wins"}</h2></div><div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${isSprint && seconds <= 10 ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-700"}`}><Clock3 size={17}/>{isSprint ? `0:${String(seconds).padStart(2, "0")}` : `${Math.min(index, questions.length)} / ${questions.length}`}</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full transition-all ${isSprint && seconds <= 10 ? "bg-red-500" : "bg-[#72c900]"}`} style={{ width: `${progress}%` }}/></div></div>
          <div className="p-5 sm:p-7">{loading && <p className="py-12 text-center font-bold text-gray-400">Loading your next challenge…</p>}{!loading && error && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}<button onClick={() => void loadQuestions(mode, isSprint)} className="ml-3 underline">Try again</button></div>}
            {!loading && !error && isSprint && (roundOver || questions.length === 0) && <div className="py-8 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-600"><Trophy size={38}/></div><p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-blue-600">Sprint complete</p><h3 className="mt-2 text-3xl font-black">{score} correct answers!</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">You answered {answered} question{answered === 1 ? "" : "s"}. Total round reward: <strong className="text-green-700">{roundXp} XP</strong>.</p><div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-3"><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-400">Personal best</p><p className="text-2xl font-black">{personalBest ?? score}</p><p className="text-xs text-gray-500">correct answers</p></div><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-400">Accuracy</p><p className="text-2xl font-black">{answered ? Math.round(score / answered * 100) : 0}%</p></div></div><button onClick={restart} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#58a700] px-6 py-3 font-black text-white"><RotateCcw size={17}/> Run it back</button></div>}
            {!loading && !error && mode === "review" && questions.length === 0 && <div className="py-10 text-center"><Brain size={34} className="mx-auto text-green-600"/><h3 className="mt-4 text-2xl font-black">Your slate is clean!</h3><p className="mt-2 text-sm text-gray-500">Missed lesson questions will appear here automatically.</p><button onClick={() => startMode("mixed")} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-black text-white">Start a sprint <ArrowRight size={16} className="ml-1 inline"/></button></div>}
            {!loading && !error && reviewComplete && <div className="py-10 text-center"><CheckCircle2 size={34} className="mx-auto text-green-600"/><h3 className="mt-4 text-2xl font-black">Dojo session complete!</h3><p className="mt-2 text-sm text-gray-500">You got {score} of {answered} answers right.</p><button onClick={() => void loadQuestions("review", false)} className="mt-5 rounded-xl bg-[#58a700] px-5 py-3 font-black text-white">Review again <RotateCcw size={16} className="ml-1 inline"/></button></div>}
            {!loading && !error && current && !roundOver && !reviewComplete && <><span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-[11px] font-black uppercase text-purple-700">{current.lesson_title}</span><h3 className="mt-4 text-2xl font-black leading-snug">{current.prompt}</h3><p className="mt-2 text-sm text-gray-500">{isChoice ? "Choose the best answer." : "Type your answer, then check."}</p>
              {!feedback && isChoice && <div className="mt-5 grid gap-3 sm:grid-cols-2">{options.map((option, i) => <button key={`${option}-${i}`} disabled={submitting} onClick={() => void submitAnswer(option)} className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-[#e4eaf2] p-4 text-left font-bold hover:border-blue-300 hover:bg-blue-50"><span className="flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-black text-gray-400">{LETTERS[i] ?? i + 1}</span>{option}</button>)}</div>}
              {!feedback && !isChoice && <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void submitAnswer(answer); }}><input autoComplete="off" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer…" className="w-full rounded-2xl border-2 border-[#e4eaf2] px-4 py-4 text-lg font-bold outline-none focus:border-blue-400"/><button disabled={!answer.trim() || submitting} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-black text-white disabled:opacity-40">{submitting ? "Checking…" : "Check answer"}</button></form>}
              {feedback && <div className={`mt-5 rounded-xl border p-4 ${feedback.correct ? "border-green-200 bg-green-50" : "border-rose-200 bg-rose-50"}`}><div className="flex items-center gap-2 font-black">{feedback.correct ? <Check size={20}/> : <Brain size={20}/>} {feedback.correct ? "Nice one!" : "Not quite — now you know."}</div><p className="mt-1 text-sm text-gray-600">{feedback.message}</p>{!feedback.correct && <p className="mt-2 rounded-lg bg-white p-3 text-sm font-bold">Correct answer: <span className="text-green-700">{feedback.answer}</span></p>}<button onClick={advance} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#202b3c] px-5 py-3 font-black text-white">{index + 1 >= questions.length ? (isSprint ? "See sprint results" : "Finish review") : "Continue"}<ArrowRight size={17}/></button></div>}
            </>}
          </div><div className="flex items-center justify-between border-t border-[#edf0f5] bg-[#fbfcfe] px-5 py-3 text-xs font-bold text-gray-400"><span>Practice mode · No hearts at stake</span><span>{isSprint ? `${score} correct so far` : `${summary.mistakes_to_review} saved for review`}</span></div></div>
      </section><aside className="space-y-4"><div className="rounded-2xl border border-[#e3e9f1] bg-white p-5"><h2 className="font-black">How scoring works</h2><div className="mt-3 space-y-3 text-sm"><p><Zap size={17} className="mr-2 inline text-green-600"/>+2 XP per correct answer when eligible.</p><p><Heart size={17} className="mr-2 inline text-rose-500"/>Practice never removes lesson hearts.</p><p><Trophy size={17} className="mr-2 inline text-amber-500"/>Each sprint mode keeps its own record.</p></div></div><div className="rounded-2xl border border-[#e3e9f1] bg-white p-5"><h2 className="font-black">Your challenge</h2><p className="mt-2 text-sm leading-6 text-gray-500">Try each sprint type and see which one gives you your best score.</p><Link href="/profile" className="mt-4 inline-flex rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-black">View all stats →</Link></div></aside></div>
    </div>
  </main>;
}
