export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }

  return body as T;
}

export type Learner = {
  id: number;
  display_name: string;
  total_xp: number;
  streak_days: number;
  hearts: number;
  gems: number;
  last_activity_date: string | null;
};

export type Skill = {
  id: number;
  title: string;
  position: number;
  completed_lessons: number;
  crowns: number;
  is_unlocked: number;
  lesson_id: number;
};

export type DailyQuest = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
};

export type DailyStats = {
  activity_date: string;
  xp_earned: number;
  lessons_completed: number;
  correct_answers: number;
  quests: DailyQuest[];
  completed_quests: number;
  quest_count: number;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
};

export type CourseResponse = {
  learner: Learner;
  course: {
    id: number;
    title: string;
    language_code: string;
    description: string;
  };
  units: {
    id: number;
    title: string;
    position: number;
    skills: Skill[];
  }[];
  daily_stats: DailyStats;
  achievements: Achievement[];
};


export type PracticeQuestion = {
  id: number;
  lesson_id: number;
  exercise_type: "multiple_choice" | "translate" | "fill_blank" | "type_answer" | string;
  prompt: string;
  options: string[] | { left: string; right: string }[];
  lesson_title: string;
  wrong_count: number | null;
  last_wrong_answer: string | null;
};

export type PracticeQuestionsResponse = { mode: "sprint" | "review"; questions: PracticeQuestion[]; count: number };
export type PracticeAnswerResponse = { correct: boolean; correct_answer: string; xp_earned: number; total_xp: number; mistakes_remaining: number; message: string };
export type PracticeSummary = { mistakes_to_review: number; questions_practiced_today: number };


export type BossQuestion = {
  id: number; lesson_id: number; exercise_type: string; prompt: string;
  options: string[] | { left: string; right: string }[]; lesson_title: string;
};
export type BossResponse = {
  unit: { id: number; title: string; position: number };
  questions: BossQuestion[]; completed_skills: number; total_skills: number;
  unlocked: boolean; best_score: number; attempts: number; completed: boolean; xp_awarded: number;
};
export type BossResult = {
  passed: boolean; correct: number; total: number; percentage: number; xp_earned: number;
  already_cleared: boolean; best_score: number; details: { exercise_id: number; correct: boolean; correct_answer: string }[]; message: string;
};
