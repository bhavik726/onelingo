# 🐣 Onelingo — tiny lessons, big progress

**A playful Spanish-learning app built around short lessons, streaks, and just-one-more-try energy.**

Onelingo is a Duolingo-inspired full-stack learning experience built as a 24-hour full-stack assignment. Open the app, pick up where the demo learner left off, and practise Spanish through bite-sized interactive exercises.

> **Demo mode:** The app starts with a seeded learner, so you can explore it without creating an account.

## ✨ What you can do

- **Follow a learning path** — work through three seeded Spanish units with skills that unlock as you progress.
- **Play interactive lessons** — answer multiple-choice, translation/word-bank, fill-in-the-blank, matching, and typed-answer exercises.
- **Earn XP and keep your streak alive** — see your progress, hearts, gems, daily activity, and achievements.
- **Take on Boss Battles** — attempt tougher unit-specific challenges after completing the relevant unit.
- **Check your progress** — take a mixed Progress Quiz based on completed units.
- **Practise smart** — use the practice area and Mistake Dojo to revisit tricky questions; sprint modes include MCQ, typing, and mixed practice.
- **See your learner stats** — review your profile, course progress, achievements, and sprint records.
- **Reset the demo journey** — restart progress using the app's reset controls when you want a clean run.

## 🚀 Run locally

### Requirements

- Node.js and npm
- Python 3.10+ recommended

### 1. Start the backend

From the repository root, open a terminal:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive API documentation is available at [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs).

### 2. Start the frontend

Open a second terminal from the repository root:

```powershell
npm install
npm run dev
```

Open [`http://localhost:3000`](http://localhost:3000).

The frontend uses `NEXT_PUBLIC_API_URL` to locate the API. For local development, its default is `http://127.0.0.1:8000`. If you need to override it, create `.env.local` in the frontend project root:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

> **Repository note:** Keep the existing `package.json`, lockfile, and Next.js configuration from your working project. They were not included in this source snapshot, so install commands assume those files are present in your complete repository.

## 🧭 Project structure

```text
.
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Learning path / dashboard
│   │   ├── lesson/[lessonId]/       # Lesson player
│   │   ├── boss/                    # Boss list and unit challenge
│   │   ├── progress-quiz/            # Overall progress quiz
│   │   ├── practice/                 # Practice, sprints, mistake review
│   │   ├── profile/                  # Learner profile and stats
│   │   ├── layout.tsx                # App metadata and root layout
│   │   └── globals.css               # Global styles
│   └── lib/api.ts                    # Shared API client and TypeScript types
├── main.py                           # FastAPI routes and learning logic
├── database.py                       # SQLite schema and seed data
├── requirements.txt                  # Python dependencies
├── duolingo.db                       # Local demo database (if present)
└── README.md
```

## 🛠️ Tech stack

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, Lucide icons
- **Backend:** Python, FastAPI, Pydantic
- **Database:** SQLite, with seeded course content and learner progress
- **API style:** JSON REST endpoints

## 🔌 API overview

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/course` | Course path, learner stats, daily stats, achievements |
| `GET /api/lessons/{lesson_id}` | Fetch lesson exercises |
| `POST /api/lessons/{lesson_id}/answer` | Validate an answer and apply heart/mistake logic |
| `POST /api/lessons/{lesson_id}/complete` | Complete a lesson and award progress/XP |
| `GET /api/practice/questions` | Fetch practice or sprint questions |
| `POST /api/practice/answer` | Submit a practice answer |
| `GET /api/practice/summary` | Practice and mistake-review summary |
| `GET /api/bosses` | List unit boss battles |
| `GET /api/boss/{unit_id}` | Fetch a unit boss challenge and status |
| `POST /api/boss/{unit_id}/submit` | Submit boss answers and record result |
| `GET /api/progress-quiz/questions` | Fetch mixed questions from completed units |
| `GET /api/profile` | Learner profile and progress details |
| `POST /api/reset` | Reset demo progress using the requested reset scope |
| `POST /api/practice/sprint-record` | Save a sprint result / personal record |
| `POST /api/hearts/refill` | Refill hearts using demo gems |

## 🗃️ Database overview

SQLite keeps the seeded course and demo learner available across refreshes and backend restarts (as long as the database file is stored on a persistent filesystem). The schema covers:

- **Course content:** courses, units, skills, lessons, exercises
- **Learner state:** learner totals and daily activity
- **Learning progress:** lesson/skill completion and exercise outcomes
- **Gamification:** achievements, daily quests, practice rewards, boss-battle records, sprint records, and mistake-review state

The app uses a default demo learner instead of full authentication, which is permitted by the assignment brief. This is an assignment/demo project, not a production account system.

## 🎯 Design notes

The interface takes inspiration from Duolingo's approachable learning path and gamified feedback patterns, while using the original **Onelingo** name and project branding. Language content is seeded Spanish; audio and real authentication are intentionally not required for this assignment scope.

## 📌 Before deployment

- Set `NEXT_PUBLIC_API_URL` to the publicly reachable backend URL in the hosting provider's frontend environment settings.
- Configure backend CORS for the deployed frontend origin.
- Ensure SQLite is stored on a persistent disk/volume if the host uses ephemeral filesystems.
- Run the frontend production build and test lesson completion, hearts, XP, reset, boss battles, and progress quiz on the hosted app.
- Do not commit secrets or local environment files containing credentials.

## 🙌 Built for learning

Made as a full-stack assignment to practise frontend interaction design, REST API development, SQLite data modelling, and persistent gamification flows.
