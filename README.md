# Lingo — Duolingo-style learning app

## Stack
- `frontend/`: Next.js 14 + TypeScript + Tailwind CSS
- `backend/`: FastAPI
- Database: SQLite

## Run (Windows PowerShell)

Backend terminal:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API docs: http://127.0.0.1:8000/docs

Frontend terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:3000.

Optional `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Implemented
- Dashboard reads learner stats and course skills from SQLite via FastAPI.
- Continue Learning and unlocked nodes open lessons.
- Multiple-choice and typed-answer exercises.
- Backend answer validation and heart deductions.
- Lesson completion awards XP and marks skill progress.
- Completion unlocks the next skill.
- Refill hearts costs 100 seeded gems.
- Progress persists in SQLite.

## Reset demo data
Stop FastAPI, delete `backend/duolingo.db`, then restart the backend. Seed data will be recreated.

## Assumptions
Authentication is mocked with demo learner ID 1 as allowed by the assignment. This is a local assignment prototype, not production-ready auth.
