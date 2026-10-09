"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Flame, Heart, Gem, Trophy, BookOpen, Target, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

type ProfileData = {
  learner: { display_name: string; total_xp: number; streak_days: number; hearts: number; gems: number };
  stats: { lessons_completed: number; correct_answers: number; unique_exercises_mastered: number; skills_completed: number; skills_total: number; bosses_cleared: number };
  sprint_records: { id: number; mode: string; answered: number; correct: number; xp_earned: number; completed_at: string }[];
  recent_days: { activity_date: string; xp_earned: number; lessons_completed: number; correct_answers: number }[];
};

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() { try { setError(""); setData(await api<ProfileData>("/api/profile")); } catch (e) { setError(e instanceof Error ? e.message : "Could not load profile"); } }
  useEffect(() => { void load(); }, []);
  async function reset(scope: "progress" | "demo") {
    const text = scope === "demo" ? "Reset the entire demo? XP, streak, gems, hearts, progress and records will return to the starter state." : "Reset all course progress? XP and gems stay, but completed lessons, boss clears and practice history are cleared.";
    if (!window.confirm(text)) return;
    setBusy(true); setMessage(""); setError("");
    try { const result = await api<{ message: string }>("/api/reset", { method: "POST", body: JSON.stringify({ scope }) }); setMessage(result.message); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Reset failed"); }
    finally { setBusy(false); }
  }
  const statCards = data ? [
    { label: "Lessons completed", value: data.stats.lessons_completed, icon: <BookOpen size={20}/> },
    { label: "Correct answers", value: data.stats.correct_answers, icon: <Target size={20}/> },
    { label: "Skills completed", value: `${data.stats.skills_completed}/${data.stats.skills_total}`, icon: <Trophy size={20}/> },
    { label: "Bosses cleared", value: data.stats.bosses_cleared, icon: <ShieldCheck size={20}/> },
  ] : [];
  return <main className="min-h-screen bg-[#f7f9fc] text-[#202b3c]"><header className="border-b border-[#e4eaf2] bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-500"><ArrowLeft size={18}/> Learning path</Link><Link href="/" className="text-2xl font-black text-duo-green">lingo<span className="text-duo-ink">.</span></Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-8"><section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#183e35] via-[#23634d] to-[#83a94d] p-6 text-white sm:p-9"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/15 text-4xl font-black">{(data?.learner.display_name || "Alex Rivera").slice(0,1).toUpperCase()}</div><div className="flex-1"><p className="text-xs font-black uppercase tracking-[0.18em] text-green-100">Learner profile · Demo account</p><h1 className="mt-1 text-3xl font-black">{data?.learner.display_name || "Alex Rivera"}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-green-50">Your learning snapshot, recent practice, and personal bests. This is a ready-to-explore demo profile—no sign-in required.</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold text-green-100">Total experience</p><p className="mt-1 text-3xl font-black">{data?.learner.total_xp ?? "—"} XP</p></div></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-white/10 p-3"><Flame size={18}/><p className="mt-2 text-xl font-black">{data?.learner.streak_days ?? "—"} days</p><p className="text-xs text-green-100">Streak</p></div><div className="rounded-xl bg-white/10 p-3"><Heart size={18}/><p className="mt-2 text-xl font-black">{data?.learner.hearts ?? "—"}/5</p><p className="text-xs text-green-100">Hearts</p></div><div className="rounded-xl bg-white/10 p-3"><Gem size={18}/><p className="mt-2 text-xl font-black">{data?.learner.gems ?? "—"}</p><p className="text-xs text-green-100">Gems</p></div><div className="rounded-xl bg-white/10 p-3"><Trophy size={18}/><p className="mt-2 text-xl font-black">{data?.stats.unique_exercises_mastered ?? "—"}</p><p className="text-xs text-green-100">Exercises mastered</p></div></div></section>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}{message && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{message}</p>}
      <section className="mt-7"><div className="mb-3"><h2 className="text-xl font-black">Your stats</h2><p className="mt-1 text-sm text-gray-500">Progress is saved by the backend in SQLite on this demo.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{statCards.map((card) => <div key={card.label} className="rounded-2xl border border-[#e4eaf2] bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-duo-green">{card.icon}<span className="text-xs font-black uppercase tracking-wide text-gray-400">{card.label}</span></div><p className="mt-4 text-3xl font-black">{card.value}</p></div>)}</div></section>
      <section className="mt-7 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-[#e4eaf2] bg-white p-5"><h2 className="text-lg font-black">Recent sprint records</h2><p className="mt-1 text-sm text-gray-500">Best scores are tracked separately for MCQ, typing, and mixed rounds.</p><div className="mt-4 space-y-3">{data?.sprint_records.length ? data.sprint_records.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"><div><p className="font-extrabold capitalize">{r.mode} sprint</p><p className="text-xs text-gray-500">{r.completed_at} · {r.answered} answered · {r.xp_earned} XP</p></div><p className="text-lg font-black text-duo-green">{r.correct}/{r.answered}</p></div>) : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No sprint records yet. Play a round in Practice Arcade to set your first personal best.</p>}</div><Link href="/practice" className="mt-4 inline-flex rounded-xl bg-duo-green px-4 py-3 text-sm font-black text-white">Go to practice →</Link></div>
      <div className="rounded-2xl border border-[#e4eaf2] bg-white p-5"><h2 className="text-lg font-black">Demo controls</h2><p className="mt-1 text-sm leading-6 text-gray-500">No accounts or auth are needed for the assignment demo. These actions are validated by the backend and affect the saved SQLite state.</p><div className="mt-5 space-y-3"><button disabled={busy} onClick={() => void reset("progress")} className="flex w-full items-center justify-between rounded-xl border-2 border-gray-200 p-4 text-left font-extrabold hover:bg-gray-50 disabled:opacity-50"><span><span className="block">Reset course progress</span><span className="mt-1 block text-xs font-medium text-gray-500">Keep XP and gems; redo all lessons.</span></span><RotateCcw size={19}/></button><button disabled={busy} onClick={() => void reset("demo")} className="flex w-full items-center justify-between rounded-xl border-2 border-red-100 p-4 text-left font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50"><span><span className="block">Reset entire demo</span><span className="mt-1 block text-xs font-medium text-red-500">Restore starter XP, hearts, gems and all progress.</span></span><RotateCcw size={19}/></button>{busy && <p className="text-xs font-bold text-gray-400">Resetting saved demo data…</p>}</div></div></section>
      <section className="mt-6 rounded-2xl bg-[#eef4ef] p-4 text-sm leading-6 text-[#496454]"><ShieldCheck size={17} className="mr-2 inline"/> Demo mode is intentional: one polished seeded learner, persistent backend progress, and safe reset controls instead of a full authentication system.</section>
    </div></main>;
}
