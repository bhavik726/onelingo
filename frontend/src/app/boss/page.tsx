"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, Shield, Swords, Trophy } from "lucide-react";
import { api } from "@/lib/api";

type BossUnit = {
  unit: { id: number; title: string; position: number };
  completed_skills: number;
  total_skills: number;
  available: boolean;
  best_score: number;
  attempts: number;
  completed: boolean;
};
type BossesResponse = { units: BossUnit[] };

export default function BossesPage() {
  const [data, setData] = useState<BossesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<BossesResponse>("/api/bosses")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load boss battles."))
      .finally(() => setLoading(false));
  }, []);

  return <main className="min-h-screen bg-[#f7f8f5] px-4 py-7 sm:px-6">
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-500 hover:text-duo-green"><ArrowLeft size={17}/> Back to learning path</Link>
      <header className="mt-5 overflow-hidden rounded-3xl border-2 border-[#ead9b8] bg-gradient-to-r from-[#fff0ce] via-[#fff8e9] to-[#fce6d4] p-6 sm:p-9">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-800">Onelingo arena</span>
            <h1 className="mt-4 text-3xl font-black text-[#372b1b] sm:text-4xl">Boss Battles</h1>
            <p className="mt-2 max-w-2xl leading-7 text-[#7a6242]">Ready for the harder questions? Choose a unit you have fully completed and take its five-question final challenge. Locked units open here when you finish their learning path.</p>
          </div>
          <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white text-4xl shadow-sm sm:flex">🐉</div>
        </div>
      </header>

      {loading && <p className="py-12 text-center font-bold text-gray-400">Preparing the arena…</p>}
      {error && <p className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</p>}
      {!loading && !error && data && <section className="mt-6 grid gap-4">
        {data.units.map((entry, index) => <article key={entry.unit.id} className={`rounded-2xl border-2 bg-white p-5 sm:p-6 ${entry.available ? "border-[#f2d9a7]" : "border-gray-200"}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${entry.available ? "bg-amber-100" : "bg-gray-100"}`}>{entry.available ? "⚔️" : "🔒"}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Unit {entry.unit.position || index + 1} · Boss {index + 1}</p>
              <h2 className="mt-1 text-xl font-black text-gray-900">{entry.unit.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{entry.available ? "Five challenging questions drawn from this unit." : `Complete all ${entry.total_skills} skills to unlock this boss (${entry.completed_skills}/${entry.total_skills} complete).`}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold text-gray-500">
                <span className="rounded-lg bg-gray-50 px-3 py-2"><Shield size={14} className="mr-1 inline"/> {entry.completed_skills}/{entry.total_skills} skills</span>
                <span className="rounded-lg bg-gray-50 px-3 py-2"><Trophy size={14} className="mr-1 inline"/> Best: {entry.best_score}/5</span>
                <span className="rounded-lg bg-gray-50 px-3 py-2">{entry.attempts} {entry.attempts === 1 ? "attempt" : "attempts"}</span>
                {entry.completed && <span className="rounded-lg bg-green-50 px-3 py-2 text-green-700">Boss defeated</span>}
              </div>
            </div>
            {entry.available
              ? <Link href={`/boss/${entry.unit.id}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-extrabold text-white shadow-sm transition hover:bg-amber-600"><Swords size={17}/> {entry.attempts ? "Attempt again" : "Attempt boss"}</Link>
              : <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 py-3 font-extrabold text-gray-400"><LockKeyhole size={16}/> Locked</span>}
          </div>
        </article>)}
        {data.units.length === 0 && <p className="rounded-xl bg-white p-6 text-center font-bold text-gray-500">No course units are available yet.</p>}
      </section>}
    </div>
  </main>;
}
