"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, RotateCcw, Trophy } from "lucide-react";
import { api } from "@/lib/api";

type Question = {
  id: number;
  lesson_id: number;
  exercise_type: string;
  prompt: string;
  options: string[];
  lesson_title: string;
  unit_title: string;
};
type QuestionResponse = { questions: Question[]; count: number; limit: number };
type AnswerResult = { correct: boolean; xp_earned: number; correct_answer?: string };

export default function ProgressQuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [correct, setCorrect] = useState(0);
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadQuiz() {
    setLoading(true); setError(""); setQuestions([]); setIndex(0); setAnswer(""); setFeedback(null); setCorrect(0); setXp(0);
    try {
      const response = await api<QuestionResponse>("/api/progress-quiz/questions?limit=20");
      setQuestions(response.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the progress quiz.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadQuiz(); }, []);

  const current = questions[index];
  const finished = questions.length > 0 && index >= questions.length;

  async function submitAnswer(value = answer) {
    if (!current || submitting || !value.trim()) return;
    setSubmitting(true); setError("");
    try {
      const result = await api<AnswerResult>("/api/practice/answer", {
        method: "POST",
        body: JSON.stringify({ exercise_id: current.id, answer: value, mode: "mixed" }),
      });
      setFeedback(result);
      if (result.correct) setCorrect((n) => n + 1);
      setXp((n) => n + (result.xp_earned || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check this answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    setIndex((n) => n + 1);
    setAnswer("");
    setFeedback(null);
  }

  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-7 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-500 hover:text-duo-green"><ArrowLeft size={17}/> Back to learning path</Link>
      <section className="mt-5 overflow-hidden rounded-3xl border-2 border-[#d8e9df] bg-white shadow-sm">
        <header className="bg-gradient-to-r from-[#e8f8ed] via-[#f8fff9] to-[#e9f2ff] p-6 sm:p-8">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-widest text-duo-green">Course checkpoint</span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Progress Quiz</h1>
          <p className="mt-2 max-w-xl leading-7 text-gray-600">A mixed review of questions from units you have fully completed. Multiple choice and typing are mixed together; take your time and see what you remember.</p>
          {questions.length > 0 && !finished && <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs font-extrabold text-gray-500"><span>QUESTION {index + 1} OF {questions.length}</span><span>{correct} correct so far</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-duo-green transition-all" style={{ width: `${(index / questions.length) * 100}%` }}/></div>
          </div>}
        </header>
        <div className="p-5 sm:p-8">
          {loading && <p className="py-12 text-center font-bold text-gray-400">Building your quiz from completed units…</p>}
          {!loading && error && !current && <div className="rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}
          {!loading && !error && questions.length === 0 && <div className="py-8 text-center"><div className="text-5xl">📚</div><h2 className="mt-4 text-2xl font-black">Your quiz is waiting</h2><p className="mx-auto mt-2 max-w-md leading-6 text-gray-500">Complete every skill in your first unit to unlock a mixed progress quiz. Then it will pull questions from all completed units.</p><Link href="/" className="mt-5 inline-flex rounded-xl bg-duo-green px-5 py-3 font-extrabold text-white">Continue learning</Link></div>}
          {finished && <div className="py-6 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Trophy size={42}/></div><h2 className="mt-5 text-3xl font-black">Progress check complete!</h2><p className="mt-2 text-gray-500">Nice work showing up for a review.</p><div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3"><div className="rounded-2xl bg-green-50 p-5"><div className="text-3xl font-black text-green-700">{correct}/{questions.length}</div><div className="mt-1 text-sm font-bold text-green-800">Correct answers</div></div><div className="rounded-2xl bg-blue-50 p-5"><div className="text-3xl font-black text-blue-700">+{xp}</div><div className="mt-1 text-sm font-bold text-blue-800">XP earned</div></div></div><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={() => void loadQuiz()} className="inline-flex items-center gap-2 rounded-xl bg-duo-green px-5 py-3 font-extrabold text-white"><RotateCcw size={17}/> Retake quiz</button><Link href="/" className="rounded-xl border-2 border-gray-200 px-5 py-3 font-extrabold text-gray-600">Back to course</Link></div></div>}
          {current && !finished && <div>
            <div className="mb-4 flex flex-wrap gap-2 text-xs font-extrabold uppercase tracking-wide text-gray-400"><span className="rounded-lg bg-gray-100 px-3 py-2">{current.unit_title}</span><span className="rounded-lg bg-gray-100 px-3 py-2">{current.lesson_title}</span><span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">{["multiple_choice", "fill_blank"].includes(current.exercise_type) ? "Choose an answer" : "Type your answer"}</span></div>
            <h2 className="text-xl font-black leading-8 text-gray-900 sm:text-2xl">{current.prompt}</h2>
            {!feedback && ["multiple_choice", "fill_blank"].includes(current.exercise_type) && current.options?.length > 0
              ? <div className="mt-6 grid gap-3">{current.options.map((option) => <button key={option} disabled={submitting} onClick={() => { setAnswer(option); void submitAnswer(option); }} className={`rounded-xl border-2 px-4 py-4 text-left font-bold transition ${answer === option ? "border-duo-green bg-green-50" : "border-gray-200 hover:border-duo-green hover:bg-green-50/50"}`}>{option}</button>)}</div>
              : !feedback && <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void submitAnswer(); }}><input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={submitting} autoComplete="off" className="min-w-0 flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 font-semibold outline-none focus:border-duo-green" placeholder="Type your answer…"/><button disabled={submitting || !answer.trim()} className="rounded-xl bg-duo-green px-5 py-3 font-extrabold text-white disabled:opacity-50">Check answer</button></form>}
            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
            {feedback && <div className={`mt-6 rounded-2xl p-5 ${feedback.correct ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}><div className="flex items-center gap-2 font-black">{feedback.correct ? <CheckCircle2 size={20}/> : <span>💡</span>}{feedback.correct ? "Correct!" : "Keep going!"}</div>{!feedback.correct && feedback.correct_answer && <p className="mt-2 text-sm">Answer: <strong>{feedback.correct_answer}</strong></p>}<button onClick={nextQuestion} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 font-extrabold text-white">Next question <ChevronRight size={17}/></button></div>}
          </div>}
        </div>
      </section>
    </div>
  </main>;
}
