"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Heart, X, LoaderCircle, ArrowRight, RotateCcw } from "lucide-react";
import { api, Learner } from "@/lib/api";

type Pair = { left: string; right: string };
type ExerciseOptions = string[] | Pair[] | null;
type Exercise = {
  id: number;
  exercise_type: "multiple_choice" | "translate" | "match_pairs" | "fill_blank" | "type_answer";
  prompt: string;
  options: ExerciseOptions;
  position: number;
};
type LessonData = {
  lesson: { id: number; title: string; skill_title: string; xp_reward: number };
  exercises: Exercise[];
  learner: Learner;
};
type AnswerResult = {
  correct: boolean;
  correct_answer: string;
  hearts: number;
  out_of_hearts: boolean;
};
type CompleteResult = {
  success: boolean;
  xp_earned: number;
  learner: Learner;
  next_skill_unlocked: number | null;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const lessonId = params.lessonId;

  const [data, setData] = useState<LessonData | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [usedWordIndexes, setUsedWordIndexes] = useState<number[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<Pair[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [hearts, setHearts] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState<CompleteResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api<LessonData>(`/api/lessons/${lessonId}`)
      .then((result) => {
        if (active) {
          setData(result);
          setHearts(result.learner.hearts);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load lesson");
      });
    return () => { active = false; };
  }, [lessonId]);

  const exercise = data?.exercises[index];
  const options = exercise?.options ?? [];
  const isChoice = exercise?.exercise_type === "multiple_choice" || exercise?.exercise_type === "fill_blank";
  const isWordBank = exercise?.exercise_type === "translate";
  const isMatching = exercise?.exercise_type === "match_pairs";
  const pairs = useMemo(
    () => isMatching && Array.isArray(options) && options.length > 0 && typeof options[0] === "object"
      ? options as Pair[]
      : [],
    [isMatching, exercise?.id]
  );
  const rightOptions = useMemo(() => shuffle(pairs.map((pair) => pair.right)), [pairs]);
  const progress = data?.exercises.length
    ? ((index + (feedback ? 1 : 0)) / data.exercises.length) * 100
    : 0;
  const canCheck = !feedback && !busy && (
    isMatching ? selectedPairs.length === pairs.length :
    isWordBank ? selectedWords.length > 0 :
    !!answer.trim()
  );

  function resetCurrentAnswer() {
    setAnswer("");
    setSelectedWords([]);
    setUsedWordIndexes([]);
    setSelectedPairs([]);
    setSelectedLeft(null);
    setFeedback(null);
    setError("");
  }

  function addWord(word: string, wordIndex: number) {
    if (feedback || usedWordIndexes.includes(wordIndex)) return;
    setSelectedWords((current) => [...current, word]);
    setUsedWordIndexes((current) => [...current, wordIndex]);
  }

  function removeWord(indexToRemove: number) {
    if (feedback) return;
    setSelectedWords((current) => current.filter((_, i) => i !== indexToRemove));
    // Remove the exact bank chip that was used for this selected token.
    setUsedWordIndexes((current) => current.filter((_, i) => i !== indexToRemove));
  }

  function choosePairRight(right: string) {
    if (feedback || !selectedLeft) return;
    const pair = { left: selectedLeft, right };
    if (selectedPairs.some((item) => item.left === pair.left || item.right === pair.right)) {
      setSelectedLeft(null);
      return;
    }
    setSelectedPairs((current) => [...current, pair]);
    setSelectedLeft(null);
  }

  async function checkAnswer() {
    if (!exercise || !canCheck) return;
    let submitted = answer;
    if (isWordBank) submitted = selectedWords.join(" ");
    if (isMatching) submitted = JSON.stringify(selectedPairs);

    setBusy(true);
    setError("");
    try {
      const result = await api<AnswerResult>(`/api/lessons/${lessonId}/answer`, {
        method: "POST",
        body: JSON.stringify({ exercise_id: exercise.id, answer: submitted }),
      });
      setFeedback(result);
      setHearts(result.hearts);
      if (result.out_of_hearts) setFailed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check answer");
    } finally {
      setBusy(false);
    }
  }

  async function continueLesson() {
    if (failed) {
      router.push("/");
      return;
    }
    if (!data) return;
    if (index < data.exercises.length - 1) {
      setIndex((current) => current + 1);
      resetCurrentAnswer();
      return;
    }
    setBusy(true);
    setError("");
    try {
      setFinished(await api<CompleteResult>(`/api/lessons/${lessonId}/complete`, {
        method: "POST",
        body: JSON.stringify({}),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete lesson");
    } finally {
      setBusy(false);
    }
  }

  async function refill() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ hearts: number; gems?: number }>("/api/hearts/refill", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setHearts(result.hearts);
      setFailed(false);
      resetCurrentAnswer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refill hearts");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return <Centered><h1 className="text-2xl font-black">Could not load lesson</h1><p className="mt-2 text-red-600">{error}</p><Link href="/" className="mt-5 font-bold text-duo-green">Back to learning path</Link></Centered>;
  }
  if (!data) {
    return <Centered><LoaderCircle className="animate-spin text-duo-green" size={32}/><p className="mt-3 font-bold text-gray-500">Loading lesson…</p></Centered>;
  }

  if (finished) {
    return <Centered>
      <div className="text-6xl">🎉</div>
      <h1 className="mt-4 text-3xl font-black">Lesson complete!</h1>
      <p className="mt-3 text-gray-500">You earned <strong className="text-duo-green">+{finished.xp_earned} XP</strong> for {data.lesson.skill_title}.</p>
      <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-50 p-4"><div className="text-xs font-black uppercase text-blue-500">Total XP</div><div className="mt-1 text-2xl font-black text-blue-700">{finished.learner.total_xp}</div></div>
        <div className="rounded-xl bg-red-50 p-4"><div className="text-xs font-black uppercase text-red-500">Hearts left</div><div className="mt-1 text-2xl font-black text-red-600">{finished.learner.hearts} ♥</div></div>
      </div>
      <div className="mt-7 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <Link href="/" className="flex-1 rounded-xl bg-duo-green px-6 py-3 font-extrabold text-white shadow-button">BACK TO COURSE</Link>
        <Link href="/practice" className="flex-1 rounded-xl border-2 border-duo-line px-6 py-3 font-extrabold text-duo-ink">PRACTICE MORE</Link>
      </div>
    </Centered>;
  }

  if (failed || hearts <= 0) {
    return <Centered>
      <div className="text-6xl">💔</div>
      <h1 className="mt-4 text-3xl font-black">Out of hearts!</h1>
      <p className="mt-3 max-w-md text-gray-500">Refill for 100 gems or return to the learning path.</p>
      {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
      <button onClick={() => void refill()} disabled={busy} className="mt-6 rounded-xl bg-duo-green px-7 py-3 font-extrabold text-white disabled:opacity-50">{busy ? "PLEASE WAIT…" : "REFILL 5 HEARTS · 100 GEMS"}</button>
      <Link href="/" className="mt-4 font-bold text-gray-500">Back to learning path</Link>
    </Centered>;
  }

  if (!exercise) {
    return <Centered><p>No exercises in this lesson.</p><Link href="/" className="mt-4 font-bold text-duo-green">Back home</Link></Centered>;
  }

  const wordBank = isWordBank && Array.isArray(options) ? options as string[] : [];
  const choiceOptions = isChoice && Array.isArray(options) ? options as string[] : [];

  return <main className="flex min-h-screen flex-col bg-white">
    <header className="mx-auto flex w-full max-w-4xl items-center gap-4 px-5 py-6">
      <Link href="/" aria-label="Exit lesson" className="text-gray-400"><X size={25}/></Link>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-duo-green transition-all" style={{ width: `${progress}%` }}/></div>
      <div className="flex items-center gap-1 font-black text-red-500"><Heart size={21} fill="currentColor"/>{hearts}</div>
    </header>

    <section className="mx-auto w-full max-w-2xl flex-1 px-5 pb-32 pt-8">
      <p className="text-xs font-black uppercase tracking-widest text-duo-green">{data.lesson.skill_title} · Question {index + 1} of {data.exercises.length}</p>
      <h1 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">{exercise.prompt}</h1>

      <div className="mt-8">
        {isChoice && <div className="grid gap-3">
          {choiceOptions.map((option) => <button key={option} onClick={() => !feedback && setAnswer(option)} disabled={!!feedback} className={`rounded-2xl border-2 p-4 text-left font-bold transition ${answer === option ? "border-duo-blue bg-blue-50 text-blue-800" : "border-gray-200 hover:bg-gray-50"} ${feedback && normalize(option) === normalize(feedback.correct_answer) ? "border-duo-green bg-green-50 text-green-800" : ""}`}>{option}</button>)}
        </div>}

        {isWordBank && <div className="space-y-5">
          <div className="flex min-h-16 flex-wrap gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-3">
            {selectedWords.length === 0 && <span className="self-center text-sm text-gray-400">Tap the words to build your answer</span>}
            {selectedWords.map((word, i) => <button key={`${word}-${i}`} disabled={!!feedback} onClick={() => removeWord(i)} className="rounded-xl border-2 border-blue-200 bg-blue-50 px-3 py-2 font-bold text-blue-800">{word}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {wordBank.map((word, i) => <button key={`${word}-${i}`} disabled={!!feedback || usedWordIndexes.includes(i)} onClick={() => addWord(word, i)} className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 font-bold shadow-sm hover:bg-gray-50 disabled:opacity-30">{word}</button>)}
          </div>
          <button disabled={!!feedback || selectedWords.length === 0} onClick={() => { setSelectedWords([]); setUsedWordIndexes([]); }} className="flex items-center gap-2 text-sm font-bold text-gray-500 disabled:opacity-40"><RotateCcw size={15}/> Clear answer</button>
        </div>}

        {isMatching && <div className="grid grid-cols-2 gap-3">
          <div className="space-y-3">{pairs.map((pair) => {
            const matched = selectedPairs.some((item) => item.left === pair.left);
            return <button key={pair.left} disabled={!!feedback || matched} onClick={() => setSelectedLeft(pair.left)} className={`min-h-14 w-full rounded-xl border-2 p-3 text-sm font-bold ${matched ? "border-duo-green bg-green-50 text-green-800" : selectedLeft === pair.left ? "border-duo-blue bg-blue-50 text-blue-800" : "border-gray-200 hover:bg-gray-50"}`}>{pair.left}</button>;
          })}</div>
          <div className="space-y-3">{rightOptions.map((right) => {
            const matched = selectedPairs.some((item) => item.right === right);
            return <button key={right} disabled={!!feedback || matched} onClick={() => choosePairRight(right)} className={`min-h-14 w-full rounded-xl border-2 p-3 text-sm font-bold ${matched ? "border-duo-green bg-green-50 text-green-800" : "border-gray-200 hover:bg-gray-50"}`}>{right}</button>;
          })}</div>
          {selectedPairs.length > 0 && <div className="col-span-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600"><strong>Selected matches:</strong> {selectedPairs.map((pair) => `${pair.left} → ${pair.right}`).join(" · ")}</div>}
          <button disabled={!!feedback || selectedPairs.length === 0} onClick={() => { setSelectedPairs([]); setSelectedLeft(null); }} className="col-span-2 flex items-center gap-2 text-sm font-bold text-gray-500 disabled:opacity-40"><RotateCcw size={15}/> Reset matches</button>
        </div>}

        {!isChoice && !isWordBank && !isMatching && <div className="space-y-3">
          <label htmlFor="answer" className="text-sm font-bold text-gray-500">Your answer</label>
          <input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && canCheck) void checkAnswer(); }} disabled={!!feedback} placeholder="Type your answer…" autoComplete="off" className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-lg font-bold outline-none focus:border-duo-blue disabled:bg-gray-50"/>
          <p className="text-xs text-gray-400">Capitalization and extra spaces don&apos;t matter.</p>
        </div>}
      </div>

      {feedback && <div className={`mt-6 rounded-xl p-4 ${feedback.correct ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
        <div className="flex items-center gap-2 font-black">{feedback.correct ? <Check size={20}/> : <X size={20}/>} {feedback.correct ? "Correct!" : "Not quite."}</div>
        {!feedback.correct && <p className="mt-1 text-sm">Correct answer: <strong>{feedback.correct_answer}</strong></p>}
      </div>}
      {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
    </section>

    <footer className={`fixed bottom-0 left-0 right-0 border-t-2 ${feedback ? feedback.correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5">
        <span className="hidden text-sm font-bold text-gray-500 sm:block">{feedback ? feedback.correct ? "Great work!" : "Keep practicing!" : "Take your time"}</span>
        {!feedback
          ? <button onClick={() => void checkAnswer()} disabled={!canCheck} className="ml-auto min-w-36 rounded-xl bg-duo-green px-8 py-3 font-extrabold text-white shadow-button disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none">{busy ? "CHECKING…" : "CHECK"}</button>
          : <button onClick={() => void continueLesson()} disabled={busy} className="ml-auto flex min-w-36 items-center justify-center gap-2 rounded-xl bg-duo-green px-8 py-3 font-extrabold text-white shadow-button disabled:opacity-50">{busy ? "SAVING…" : failed ? "FINISH" : index === data.exercises.length - 1 ? "FINISH LESSON" : <>CONTINUE <ArrowRight size={17}/></>}</button>}
      </div>
    </footer>
  </main>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">{children}</main>;
}
