# 🐣 Onelingo — Tiny Lessons, Big Progress

A small Spanish-learning app built around bite-sized lessons, streaks, and the satisfaction of getting one more answer right.

**Onelingo was built as part of a 24-hour full-stack take-home assignment.** The goal was to turn a simple language-learning idea into a working application, covering the UI, backend APIs, database, and learning-progress flows within a limited timeframe.

Inspired by the learning path and gamification mechanics of apps like Duolingo, Onelingo lets learners practise Spanish through short interactive exercises, earn XP, track their progress, and revisit mistakes along the way.

The app starts with a seeded demo learner, so you can explore the learning experience without going through a sign-up flow.

## ✨ Features

### 🗺️ Learning Path & Progression
- **Structured learning journey:** Progress through three Spanish units, each containing skills and lessons that unlock as you complete earlier content.
- **Interactive lessons:** Practise through MCQs, translation and word-bank exercises, fill-in-the-blanks, matching, and typed answers.
- **Progress tracking:** Earn XP, complete skills, track daily activity, and watch your learning journey advance.
- **Progress reset:** Restart the demo journey whenever you want to replay lessons and experience the progression system from scratch.

### ⚔️ Boss Battles
- **Unit-end challenges:** Take on a final boss fight for a unit after completing its required learning content.
- **Higher-difficulty questions:** Test your understanding with tougher questions based on the unit you've completed.
- **Battle results:** Submit your answers and record your performance as part of your learning progress.

### 🏟️ Practice Arena
- **Practice Sprints:** Jump into timed-style practice sessions with MCQ, typing, and mixed-question modes.
- **Extra XP:** Earn additional XP through practice, giving you a way to keep progressing beyond regular lessons.
- **Sprint records:** Save sprint results and track personal records as you improve.
- **Flexible practice:** Revisit questions and sharpen your skills without having to follow the main learning path.

### 🥋 Mistake Dojo
- **Automatic mistake tracking:** Wrong answers are recorded so you can revisit questions you've struggled with.
- **Targeted revision:** Practise previously missed questions instead of repeatedly working through content you already know.
- **Learn from mistakes:** Use the dedicated review flow to reinforce weak areas and improve your accuracy over time.

### 🧠 Progress Quiz
- **Mixed-question challenge:** Test your overall understanding with questions drawn from units you've already completed.
- **Knowledge check:** Go beyond individual lessons and see how well you remember what you've learned across the course.

### 🔥 Gamification & Rewards
- **XP and levels of progression:** Earn experience points as you learn, practise, and complete challenges.
- **Hearts system:** Manage your available hearts while answering lesson questions.
- **Gems and heart refills:** Use demo gems to refill hearts and continue learning.
- **Streaks and daily activity:** Track your learning consistency and keep your momentum going.
- **Achievements and daily quests:** Work towards milestones and earn recognition for your activity.

### 👤 Learner Profile & Stats
- **Progress overview:** Review your course progress, learner stats, and achievements in one place.
- **Practice history:** Check recorded sprint results and personal records.
- **Persistent demo progress:** Your learning state is stored in SQLite and can survive page refreshes and backend restarts when the database file is retained.



## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, Lucide |
| Backend | Python, FastAPI, Pydantic |
| Database | SQLite |
| Communication | REST APIs with JSON |

## 🧩 How It Works

Onelingo is split into a Next.js frontend and a FastAPI backend.

- The **frontend** handles the learning path, lesson player, practice screens, quizzes, and profile views.
- The **backend** serves course content, validates answers, manages lesson completion, and applies the learning and gamification rules.
- **SQLite** stores the seeded course content, demo learner, progress, activity, and records.

The backend exposes separate endpoints for lessons, practice, boss battles, progress quizzes, learner stats, and demo resets. This keeps the learning flows organised and allows the frontend to interact with them through a shared API client.

## 🚀 Run Locally

### Prerequisites

- Node.js and npm
- Python 3.10 or newer

### 1. Start the backend

From the repository root, open a terminal:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

You can explore and test the endpoints through the FastAPI docs at [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs).

### 2. Start the frontend

Open a second terminal in the repository root:

```powershell
npm install
npm run dev
```

Open [`http://localhost:3000`](http://localhost:3000) in your browser.

### Environment configuration

The frontend uses `NEXT_PUBLIC_API_URL` to locate the backend. For local development, it defaults to `http://127.0.0.1:8000`.

If you need to override it, create a `.env.local` file in the frontend project root:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

**Note:** The complete working repository should include the existing `package.json`, lockfile, and Next.js configuration. These files are assumed by the setup instructions.

## 🔌 API Overview

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Check API health |
| `GET /api/course` | Fetch the learning path, learner stats, daily activity, and achievements |
| `GET /api/lessons/{lesson_id}` | Fetch lesson exercises |
| `POST /api/lessons/{lesson_id}/answer` | Validate answers and apply heart/mistake logic |
| `POST /api/lessons/{lesson_id}/complete` | Complete a lesson and award progress and XP |
| `GET /api/practice/questions` | Fetch practice or sprint questions |
| `POST /api/practice/answer` | Submit a practice answer |
| `GET /api/practice/summary` | Fetch practice and mistake-review stats |
| `GET /api/bosses` | List available boss battles |
| `GET /api/boss/{unit_id}` | Fetch a unit-specific boss challenge |
| `POST /api/boss/{unit_id}/submit` | Submit answers and record the result |
| `GET /api/progress-quiz/questions` | Fetch mixed questions from completed units |
| `GET /api/profile` | Fetch learner profile and progress details |
| `POST /api/reset` | Reset demo progress |
| `POST /api/practice/sprint-record` | Save sprint results and personal records |
| `POST /api/hearts/refill` | Refill hearts using demo gems |

## 🗃️ Database & Progress Tracking

SQLite stores both the seeded learning content and the learner's progress.

The database covers:

- **Course structure:** Courses, units, skills, lessons, and exercises.
- **Learner state:** XP totals, hearts, gems, streaks, and daily activity.
- **Learning progress:** Lesson and skill completion, exercise outcomes, and mistake-review state.
- **Gamification:** Achievements, daily quests, practice rewards, boss-battle results, and sprint records.

The app uses a default demo learner instead of a full authentication system. This keeps the project easy to explore while allowing the main learning and progress flows to be demonstrated without account setup.

**Persistence note:** Progress survives refreshes and backend restarts when the SQLite database is retained. On hosting platforms with ephemeral filesystems, a persistent disk or volume is needed to retain database changes across deployments or restarts.

## 🎨 Design Approach

I wanted Onelingo to feel approachable rather than like a traditional quiz application. The learning path provides a clear sense of progression, while XP, hearts, streaks, and small challenges give learners a reason to keep going.

The app takes inspiration from familiar language-learning patterns but uses its own name and branding. Spanish is the seeded course language, and the focus is on the interactive learning experience rather than features like audio lessons or full user authentication.

## ☁️ Deployment Notes

Before deploying the app:

- Set `NEXT_PUBLIC_API_URL` to the publicly accessible backend URL in the frontend hosting settings.
- Configure backend CORS to allow requests from the deployed frontend origin.
- Use persistent storage for SQLite if learner progress needs to survive restarts and redeployments.
- Test the main flows on the hosted app, including lesson completion, XP updates, heart refills, progress resets, boss battles, and the Progress Quiz.
- Keep local environment files and secrets out of version control.

## 🎯 Built in 24 Hours

Onelingo was a chance to bring several parts of full-stack development together in one project: building an interactive frontend, designing REST APIs, modelling data in SQLite, and connecting learning progress with gamification.

The idea was to go beyond a collection of static screens and make the main learning journey work end to end, while keeping the scope realistic for a 24-hour take-home assignment.

