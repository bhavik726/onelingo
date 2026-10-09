"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Flame, Heart, Gem, Trophy, ShieldCheck, RefreshCw,
  CheckCircle2, Circle, Star, Target, Sparkles,
} from "lucide-react";
import { api, CourseResponse, Skill } from "@/lib/api";
import Image from "next/image";

export default function HomePage() {
  const [data, setData] = useState<CourseResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCourse() {
    setLoading(true);
    setError("");
    try {
      setData(await api<CourseResponse>("/api/course"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load course");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCourse(); }, []);

  const skills = data?.units.flatMap((unit) => unit.skills) ?? [];
  const nextSkill = skills.find((s) => s.is_unlocked === 1 && s.completed_lessons === 0);
  const completedCount = skills.filter((s) => s.completed_lessons > 0).length;
  const courseComplete = skills.length > 0 && completedCount === skills.length;
  const unlockedAchievements = (data?.achievements ?? []).filter((a) => a.unlocked).length;

  return <main className="min-h-screen bg-white">
    <header className="sticky top-0 z-10 border-b border-duo-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link
  href="/"
  aria-label="Onelingo home"
  className="flex items-center"
>
  <Image
    src="/onelingo-logo.svg"
    alt="Onelingo"
    width={160}
    height={55}
    priority
    className="h-11 w-auto object-contain"
  />
</Link>
        <nav className="hidden items-center gap-7 text-sm font-extrabold uppercase tracking-wide text-gray-500 md:flex">
          <a className="text-duo-green" href="#learn">Learn</a>
          <a href="#quests">Daily quests</a>
          <a href="#achievements">Achievements</a>
        </nav>
        <div className="flex items-center gap-3 text-sm font-extrabold sm:gap-4">
          <Link href="/profile" className="rounded-xl border-2 border-duo-line px-3 py-2 text-xs font-black text-gray-600 transition hover:bg-gray-50">PROFILE</Link>
          <Stat icon={<Flame size={20} fill="currentColor"/>} value={data?.learner.streak_days ?? "—"} color="text-orange-500"/>
          <Stat icon={<Trophy size={19}/>} value={data?.learner.total_xp ?? "—"} color="text-duo-blue"/>
          <Stat icon={<Heart size={19} fill="currentColor"/>} value={data?.learner.hearts ?? "—"} color="text-red-500"/>
          <Stat icon={<Gem size={19}/>} value={data?.learner.gems ?? "—"} color="text-purple-500"/>
        </div>
      </div>
    </header>

    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section id="learn">
        <div className="mb-7 overflow-hidden rounded-2xl border-2 border-duo-line bg-white shadow-card">
          <div className="flex items-start justify-between gap-4 p-6 sm:p-8">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-duo-green">
                {data ? `${data.course.title} course · Unit 1` : "Language course"}
              </p>
              <h1 className="text-3xl font-black sm:text-4xl">{courseComplete ? "Course complete — ¡felicidades!" : "Let&apos;s get learning!"}</h1>
              <p className="mt-3 max-w-xl leading-7 text-gray-500">{courseComplete ? "You have completed every seeded skill. Keep your Spanish sharp with sprints, mistake reviews, and boss rematches." : "A few minutes a day can make a big difference. Learn a little, earn XP, and keep your streak alive."}</p>
            </div>
            <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 sm:flex">
              <Flame size={34} fill="currentColor"/>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-duo-line bg-[#fbfdfb] px-6 py-4 sm:px-8">
            {courseComplete ? <Link href="/practice" className="rounded-xl bg-duo-green px-6 py-3 font-extrabold text-white shadow-button transition hover:brightness-95">KEEP PRACTICING →</Link> : nextSkill ? <Link href={`/lesson/${nextSkill.lesson_id}`} className="rounded-xl bg-duo-green px-6 py-3 font-extrabold text-white shadow-button transition hover:brightness-95">CONTINUE LEARNING</Link> : <button disabled className="rounded-xl bg-gray-300 px-6 py-3 font-extrabold text-white">CONTINUE LEARNING</button>}
            <span className="text-sm font-bold text-gray-400">{loading ? "Loading progress…" : `${completedCount} of ${skills.length} skills completed`}</span>
            <button onClick={() => void loadCourse()} aria-label="Refresh course" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><RefreshCw size={17}/></button>
          </div>
          {error && <div className="m-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">Could not load course: {error}</div>}
        </div>

        <Link href="/practice" className="mb-7 group flex flex-col gap-4 rounded-2xl border-2 border-[#dce9f7] bg-gradient-to-r from-[#f2f8ff] via-white to-[#fff8e9] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#dcecff] text-2xl">⚡</div>
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">New · Practice arcade</p><h2 className="mt-1 text-xl font-black">Train your brain, not just your streak</h2><p className="mt-1 text-sm leading-6 text-gray-500">Race the clock in Word Sprint or turn old mistakes into new wins.</p></div>
          </div>
          <span className="inline-flex items-center justify-center rounded-xl bg-[#2463eb] px-5 py-3 text-sm font-black text-white transition group-hover:bg-[#1749b8]">PLAY NOW →</span>
        </Link>
        <div className="mb-7 grid gap-4 sm:grid-cols-2">
          <Link href="/boss" className="group rounded-2xl border-2 border-[#f2d9a7] bg-gradient-to-br from-[#fff8e7] to-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-800">Unit finales</span><span className="text-3xl">🐉</span></div>
            <h2 className="mt-3 text-xl font-black">Boss Battles</h2><p className="mt-1 text-sm leading-6 text-gray-500">Take on a tougher five-question challenge for each completed unit. Your best score and clears are tracked.</p>
            <span className="mt-4 inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-extrabold text-white">CHOOSE A BOSS →</span>
          </Link>
          <Link href="/progress-quiz" className="group rounded-2xl border-2 border-[#d8e9df] bg-gradient-to-br from-[#effaf3] to-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between"><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-800">Review checkpoint</span><span className="text-3xl">🗺️</span></div>
            <h2 className="mt-3 text-xl font-black">Progress Quiz</h2><p className="mt-1 text-sm leading-6 text-gray-500">A mixed quiz drawn from every unit you have fully completed so far. See how much has stuck.</p>
            <span className="mt-4 inline-flex rounded-lg bg-duo-green px-4 py-2 text-sm font-extrabold text-white">TEST MY PROGRESS →</span>
          </Link>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="text-xl font-black">Your learning path</h2><p className="mt-1 text-sm text-gray-500">Every lesson gets you one step further.</p></div>
          <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-extrabold uppercase text-gray-500">Section 1</span>
        </div>
        <div className="relative min-h-80 overflow-hidden rounded-2xl border border-duo-line bg-[#fbfbfb] px-5 py-8 sm:px-10">
          {loading && <p className="py-10 text-center font-bold text-gray-400">Loading course…</p>}
          {!loading && !error && data?.units.map((unit) => <div key={unit.id} className="mb-8">
            <div className="mb-7 text-center text-xs font-black uppercase tracking-widest text-gray-400">{unit.title}</div>
            <div className="relative flex flex-col items-center gap-7">
              <div className="absolute bottom-8 top-8 w-2 rounded-full bg-gray-200"/>
              {unit.skills.map((skill) => <PathNode key={skill.id} skill={skill}/>)}
            </div>
          </div>)}
          {!loading && !error && skills.length === 0 && <p className="py-10 text-center font-bold text-gray-400">No lessons are available yet.</p>}
        </div>
      </section>

      <aside className="space-y-5">
        <div id="quests" className="rounded-2xl border-2 border-duo-line p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Target size={21} className="text-duo-green"/><h2 className="text-lg font-black">Daily quests</h2></div>
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-black text-duo-green">{data?.daily_stats?.completed_quests ?? 0}/{data?.daily_stats?.quest_count ?? 3}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Small goals. Real momentum.</p>
          <div className="mt-4 space-y-4">
            {(data?.daily_stats?.quests ?? []).map((quest) => {
              const percentage = Math.min(100, quest.progress / quest.target * 100);
              return <div key={quest.id}>
                <div className="flex items-start gap-2">
                  {quest.completed ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-duo-green"/> : <Circle size={19} className="mt-0.5 shrink-0 text-gray-300"/>}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold">{quest.title}</div>
                    <p className="mt-0.5 text-xs leading-5 text-gray-500">{quest.description}</p>
                  </div>
                </div>
                <div className="ml-7 mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full transition-all ${quest.completed ? "bg-duo-green" : "bg-duo-blue"}`} style={{ width: `${percentage}%` }}/>
                </div>
                <p className="ml-7 mt-1 text-right text-[11px] font-bold text-gray-400">{Math.min(quest.progress, quest.target)} / {quest.target}{quest.id === "daily_xp" ? " XP" : ""}</p>
              </div>;
            })}
            {!data && <p className="text-sm text-gray-400">{loading ? "Loading daily goals…" : "Daily goals unavailable."}</p>}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-duo-line p-5 shadow-card">
          <div className="flex items-center gap-2"><Flame size={21} className="text-orange-500" fill="currentColor"/><h2 className="text-lg font-black">Your streak</h2></div>
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-orange-50 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm"><Flame size={30} fill="currentColor"/></div>
            <div><div className="text-2xl font-black text-orange-600">{data?.learner.streak_days ?? "—"} days</div><p className="text-xs font-bold text-orange-700/70">Practice daily to keep it growing.</p></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">Your streak updates when you complete a lesson. Completing multiple lessons on the same day counts as one streak day.</p>
        </div>

        <div id="achievements" className="rounded-2xl border-2 border-duo-line p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Trophy size={21} className="text-duo-blue"/><h2 className="text-lg font-black">Achievements</h2></div>
            <span className="text-xs font-black text-gray-400">{unlockedAchievements}/{data?.achievements?.length ?? 3}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Milestones worth celebrating.</p>
          <div className="mt-4 space-y-3">
            {(data?.achievements ?? []).map((achievement) => <div key={achievement.id} className={`flex items-center gap-3 rounded-xl border p-3 ${achievement.unlocked ? "border-yellow-200 bg-yellow-50" : "border-gray-100 bg-gray-50 opacity-75"}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{achievement.unlocked ? achievement.icon : "🔒"}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold">{achievement.title}</div>
                <p className="mt-0.5 text-xs leading-4 text-gray-500">{achievement.description}</p>
              </div>
              {achievement.unlocked && <Star size={16} className="shrink-0 text-yellow-500" fill="currentColor"/>}
            </div>)}
            {!data && <p className="text-sm text-gray-400">{loading ? "Loading achievements…" : "Achievements unavailable."}</p>}
          </div>
        </div>

        <div className="rounded-2xl bg-[#f7f7f7] p-5">
          <div className="flex items-center gap-2 font-black"><ShieldCheck size={19} className="text-duo-green"/> Development status</div>
          <p className="mt-2 text-sm text-gray-500">Course progress, daily quests, streaks, and achievements are stored in SQLite.</p>
          <p className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${data ? "bg-green-100 text-green-800" : error ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"}`}>{data ? "API connected · live data" : error ? "API error" : "Connecting…"}</p>
        </div>
      </aside>
    </div>
  </main>;
}

function Stat({ icon, value, color }: { icon: React.ReactNode; value: string | number; color: string }) {
  return <div className={`flex items-center gap-1.5 ${color}`}>{icon}<span>{value}</span></div>;
}

function PathNode({ skill }: { skill: Skill }) {
  const completed = skill.completed_lessons > 0;
  const unlocked = skill.is_unlocked === 1;
  return <div className="z-[1] flex w-full max-w-xs items-center gap-4">
    <div className="flex flex-1 justify-end">{completed ? <span className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-black uppercase text-green-800">Completed</span> : unlocked ? <span className="rounded-lg bg-duo-green px-3 py-1.5 text-xs font-black uppercase text-white">Start here</span> : null}</div>
    {unlocked ? <Link href={`/lesson/${skill.lesson_id}`} aria-label={`${skill.title} skill`} className={`flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-b-[6px] text-xl font-black text-white transition hover:scale-105 ${completed ? "border-duo-darkGreen bg-duo-green" : "border-[#159bd8] bg-duo-blue"}`}>{completed ? "✓" : skill.position}</Link> : <button disabled className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-b-[6px] border-gray-300 bg-gray-200 text-xl text-gray-400">🔒</button>}
    <div className="flex-1"><div className="font-black">{skill.title}</div><div className="mt-1 text-xs font-bold text-gray-400">{completed ? `${skill.crowns} crown · completed` : unlocked ? "Available" : "Locked"}</div></div>
  </div>;
}
