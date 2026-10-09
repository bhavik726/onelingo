import json
from contextlib import asynccontextmanager
from datetime import date, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .database import get_connection, initialize_database

LEARNER_ID = 1
MAX_HEARTS = 5
DAILY_XP_GOAL = 20
DAILY_LESSON_GOAL = 1
DAILY_CORRECT_GOAL = 5

ACHIEVEMENTS = {
    "first_lesson": {
        "title": "First Steps",
        "description": "Complete your first lesson.",
        "icon": "🎯",
    },
    "xp_100": {
        "title": "XP Collector",
        "description": "Reach 100 total XP.",
        "icon": "⭐",
    },
    "streak_3": {
        "title": "On a Roll",
        "description": "Reach a 3-day learning streak.",
        "icon": "🔥",
    },
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Lingo Learning API", version="0.4.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnswerSubmission(BaseModel):
    exercise_id: int
    answer: str = Field(max_length=2000)


def get_learner(connection):
    learner = connection.execute(
        "SELECT * FROM learners WHERE id = ?", (LEARNER_ID,)
    ).fetchone()
    if learner is None:
        raise HTTPException(status_code=404, detail="Demo learner not found")
    return learner


def normalize_answer(value: str) -> str:
    return " ".join(value.casefold().strip().split())


def parse_json(value, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def answer_is_correct(exercise_type: str, submitted: str, expected: str) -> bool:
    if exercise_type == "match_pairs":
        try:
            submitted_pairs = json.loads(submitted)
            expected_pairs = json.loads(expected)
            normalize_pairs = lambda pairs: sorted(
                (normalize_answer(str(pair["left"])), normalize_answer(str(pair["right"])))
                for pair in pairs
            )
            return normalize_pairs(submitted_pairs) == normalize_pairs(expected_pairs)
        except (json.JSONDecodeError, TypeError, KeyError):
            return False
    return normalize_answer(submitted) == normalize_answer(expected)


def get_daily_stats(connection, today: str | None = None):
    activity_date = today or date.today().isoformat()
    row = connection.execute(
        """
        SELECT xp_earned, lessons_completed, correct_answers
        FROM learner_daily_stats
        WHERE learner_id = ? AND activity_date = ?
        """,
        (LEARNER_ID, activity_date),
    ).fetchone()
    stats = dict(row) if row else {
        "xp_earned": 0,
        "lessons_completed": 0,
        "correct_answers": 0,
    }
    stats["activity_date"] = activity_date
    stats["quests"] = [
        {
            "id": "daily_xp",
            "title": "Earn 20 XP",
            "description": "Build your momentum one lesson at a time.",
            "progress": min(stats["xp_earned"], DAILY_XP_GOAL),
            "target": DAILY_XP_GOAL,
            "completed": stats["xp_earned"] >= DAILY_XP_GOAL,
        },
        {
            "id": "daily_lesson",
            "title": "Complete a lesson",
            "description": "Finish one lesson on your learning path.",
            "progress": min(stats["lessons_completed"], DAILY_LESSON_GOAL),
            "target": DAILY_LESSON_GOAL,
            "completed": stats["lessons_completed"] >= DAILY_LESSON_GOAL,
        },
        {
            "id": "daily_correct",
            "title": "Get 5 answers right",
            "description": "Practice carefully and build accuracy.",
            "progress": min(stats["correct_answers"], DAILY_CORRECT_GOAL),
            "target": DAILY_CORRECT_GOAL,
            "completed": stats["correct_answers"] >= DAILY_CORRECT_GOAL,
        },
    ]
    stats["completed_quests"] = sum(1 for quest in stats["quests"] if quest["completed"])
    stats["quest_count"] = len(stats["quests"])
    return stats


def get_achievements(connection):
    rows = connection.execute(
        """
        SELECT achievement_key, unlocked_at
        FROM learner_achievements
        WHERE learner_id = ?
        ORDER BY unlocked_at, achievement_key
        """,
        (LEARNER_ID,),
    ).fetchall()
    unlocked = {row["achievement_key"]: row["unlocked_at"] for row in rows}
    return [
        {
            "id": key,
            **metadata,
            "unlocked": key in unlocked,
            "unlocked_at": unlocked.get(key),
        }
        for key, metadata in ACHIEVEMENTS.items()
    ]


def award_achievements(connection):
    learner = get_learner(connection)
    stats = connection.execute(
        "SELECT * FROM learner_stats WHERE learner_id = ?", (LEARNER_ID,)
    ).fetchone()
    if stats is None:
        return

    conditions = {
        "first_lesson": stats["lessons_completed"] >= 1,
        "xp_100": learner["total_xp"] >= 100,
        "streak_3": learner["streak_days"] >= 3,
    }
    today = date.today().isoformat()
    for key, unlocked in conditions.items():
        if unlocked:
            connection.execute(
                """
                INSERT OR IGNORE INTO learner_achievements
                    (learner_id, achievement_key, unlocked_at)
                VALUES (?, ?, ?)
                """,
                (LEARNER_ID, key, today),
            )


def mark_learning_activity(connection, today: str):
    """Advance a streak once per calendar day for any successful learning activity."""
    learner = get_learner(connection)
    last_date = learner["last_activity_date"]
    if last_date == today:
        return
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    streak = learner["streak_days"] + 1 if last_date == yesterday else 1
    connection.execute("UPDATE learners SET streak_days=?, last_activity_date=? WHERE id=?", (streak, today, LEARNER_ID))


def record_correct_answer(connection, exercise_id: int, today: str):
    """Count a correct exercise only once for lifetime and daily quest progress."""
    inserted = connection.execute(
        """
        INSERT OR IGNORE INTO learner_exercise_completions
            (learner_id, exercise_id, completed_at)
        VALUES (?, ?, ?)
        """,
        (LEARNER_ID, exercise_id, today),
    ).rowcount
    if not inserted:
        return

    connection.execute(
        """
        INSERT INTO learner_stats (learner_id, correct_answers, lessons_completed)
        VALUES (?, 1, 0)
        ON CONFLICT(learner_id) DO UPDATE
        SET correct_answers = correct_answers + 1
        """,
        (LEARNER_ID,),
    )
    connection.execute(
        """
        INSERT INTO learner_daily_stats
            (learner_id, activity_date, xp_earned, lessons_completed, correct_answers)
        VALUES (?, ?, 0, 0, 1)
        ON CONFLICT(learner_id, activity_date) DO UPDATE
        SET correct_answers = correct_answers + 1
        """,
        (LEARNER_ID, today),
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "lingo-api"}


@app.get("/api/course")
def get_course():
    with get_connection() as connection:
        learner = get_learner(connection)
        # Evaluate milestones on dashboard load too, including progress from Phase 1–3.
        award_achievements(connection)
        course = connection.execute(
            "SELECT * FROM courses ORDER BY id LIMIT 1"
        ).fetchone()
        if course is None:
            raise HTTPException(status_code=404, detail="No seeded course found")

        # Reconcile unlocks from persisted completions. This also repairs older demo DBs
        # where the last skill of a unit was completed before cross-unit unlock logic existed.
        ordered_units = connection.execute(
            "SELECT id, position FROM units WHERE course_id = ? ORDER BY position", (course["id"],)
        ).fetchall()
        for unit_index, unit_row in enumerate(ordered_units):
            unit_skills = connection.execute(
                "SELECT id FROM skills WHERE unit_id = ? ORDER BY position", (unit_row["id"],)
            ).fetchall()
            if not unit_skills:
                continue
            if unit_index == 0:
                connection.execute(
                    "INSERT INTO learner_skill_progress (learner_id, skill_id, is_unlocked) VALUES (?, ?, 1) "
                    "ON CONFLICT(learner_id, skill_id) DO UPDATE SET is_unlocked=1",
                    (LEARNER_ID, unit_skills[0]["id"]),
                )
            prior_unit_complete = True
            if unit_index > 0:
                prior = ordered_units[unit_index - 1]
                prior_total = connection.execute("SELECT COUNT(*) n FROM skills WHERE unit_id=?", (prior["id"],)).fetchone()["n"]
                prior_done = connection.execute(
                    "SELECT COUNT(*) n FROM learner_skill_progress p JOIN skills s ON s.id=p.skill_id WHERE p.learner_id=? AND s.unit_id=? AND p.completed_lessons>0",
                    (LEARNER_ID, prior["id"]),
                ).fetchone()["n"]
                prior_unit_complete = prior_total > 0 and prior_done >= prior_total
            if unit_index > 0 and prior_unit_complete:
                connection.execute(
                    "INSERT INTO learner_skill_progress (learner_id, skill_id, is_unlocked) VALUES (?, ?, 1) "
                    "ON CONFLICT(learner_id, skill_id) DO UPDATE SET is_unlocked=1",
                    (LEARNER_ID, unit_skills[0]["id"]),
                )
        connection.commit()
        units = connection.execute(
            "SELECT id, title, position FROM units WHERE course_id = ? ORDER BY position",
            (course["id"],),
        ).fetchall()
        result_units = []
        for unit in units:
            skills = connection.execute(
                """
                SELECT s.id, s.title, s.position,
                       COALESCE(p.completed_lessons, 0) AS completed_lessons,
                       COALESCE(p.crowns, 0) AS crowns,
                       COALESCE(p.is_unlocked, 0) AS is_unlocked,
                       (SELECT id FROM lessons WHERE skill_id = s.id ORDER BY position LIMIT 1) AS lesson_id
                FROM skills s
                LEFT JOIN learner_skill_progress p
                  ON p.skill_id = s.id AND p.learner_id = ?
                WHERE s.unit_id = ?
                ORDER BY s.position
                """,
                (LEARNER_ID, unit["id"]),
            ).fetchall()
            result_units.append({
                "id": unit["id"],
                "title": unit["title"],
                "position": unit["position"],
                "skills": [dict(skill) for skill in skills],
            })

        return {
            "learner": dict(learner),
            "course": dict(course),
            "units": result_units,
            "daily_stats": get_daily_stats(connection),
            "achievements": get_achievements(connection),
        }


@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: int):
    with get_connection() as connection:
        lesson = connection.execute(
            """
            SELECT l.*, s.title AS skill_title
            FROM lessons l JOIN skills s ON s.id = l.skill_id
            WHERE l.id = ?
            """,
            (lesson_id,),
        ).fetchone()
        if lesson is None:
            raise HTTPException(status_code=404, detail="Lesson not found")

        exercises = connection.execute(
            """
            SELECT id, exercise_type, prompt, options_json, position
            FROM exercises WHERE lesson_id = ? ORDER BY position
            """,
            (lesson_id,),
        ).fetchall()
        exercise_results = []
        for row in exercises:
            item = dict(row)
            item["options"] = parse_json(item.pop("options_json"), [])
            exercise_results.append(item)

        return {
            "lesson": dict(lesson),
            "exercises": exercise_results,
            "learner": dict(get_learner(connection)),
        }


@app.post("/api/lessons/{lesson_id}/answer")
def submit_answer(lesson_id: int, submission: AnswerSubmission):
    with get_connection() as connection:
        exercise = connection.execute(
            """
            SELECT id, exercise_type, answer FROM exercises
            WHERE id = ? AND lesson_id = ?
            """,
            (submission.exercise_id, lesson_id),
        ).fetchone()
        if exercise is None:
            raise HTTPException(status_code=404, detail="Exercise not found for this lesson")

        learner = get_learner(connection)
        correct = answer_is_correct(
            exercise["exercise_type"], submission.answer, exercise["answer"]
        )
        hearts = learner["hearts"]
        if not correct and hearts > 0:
            hearts -= 1
            connection.execute(
                "UPDATE learners SET hearts = ? WHERE id = ?", (hearts, LEARNER_ID)
            )

        today = date.today().isoformat()
        if correct:
            record_correct_answer(connection, exercise["id"], today)
            connection.execute(
                "UPDATE learner_mistakes SET resolved_at = ? WHERE learner_id = ? AND exercise_id = ?",
                (today, LEARNER_ID, exercise["id"]),
            )
            award_achievements(connection)
        else:
            connection.execute(
                """
                INSERT INTO learner_mistakes
                    (learner_id, exercise_id, wrong_count, last_wrong_answer, last_attempted_at, resolved_at)
                VALUES (?, ?, 1, ?, ?, NULL)
                ON CONFLICT(learner_id, exercise_id) DO UPDATE SET
                    wrong_count = learner_mistakes.wrong_count + 1,
                    last_wrong_answer = excluded.last_wrong_answer,
                    last_attempted_at = excluded.last_attempted_at,
                    resolved_at = NULL
                """,
                (LEARNER_ID, exercise["id"], submission.answer[:500], today),
            )

        connection.commit()
        correct_answer = exercise["answer"]
        if exercise["exercise_type"] == "match_pairs":
            correct_answer = json.dumps(
                parse_json(correct_answer, []), ensure_ascii=False
            )

        return {
            "correct": correct,
            "correct_answer": correct_answer,
            "hearts": hearts,
            "out_of_hearts": hearts == 0,
        }


@app.post("/api/lessons/{lesson_id}/complete")
def complete_lesson(lesson_id: int):
    with get_connection() as connection:
        lesson = connection.execute(
            "SELECT * FROM lessons WHERE id = ?", (lesson_id,)
        ).fetchone()
        if lesson is None:
            raise HTTPException(status_code=404, detail="Lesson not found")

        learner = get_learner(connection)
        if learner["hearts"] <= 0:
            raise HTTPException(status_code=400, detail="No hearts remaining. Refill hearts first.")

        exercise_count = connection.execute(
            "SELECT COUNT(*) AS count FROM exercises WHERE lesson_id = ?", (lesson_id,)
        ).fetchone()["count"]
        if exercise_count == 0:
            raise HTTPException(status_code=400, detail="This lesson has no exercises yet.")

        skill_id = lesson["skill_id"]
        progress = connection.execute(
            """
            SELECT * FROM learner_skill_progress
            WHERE learner_id = ? AND skill_id = ?
            """,
            (LEARNER_ID, skill_id),
        ).fetchone()
        already_completed = bool(progress and progress["completed_lessons"] >= 1)
        reward = 0 if already_completed else lesson["xp_reward"]
        today = date.today().isoformat()

        if progress:
            connection.execute(
                """
                UPDATE learner_skill_progress
                SET completed_lessons = MAX(completed_lessons, 1),
                    crowns = MAX(crowns, 1), is_unlocked = 1, completed_at = ?
                WHERE learner_id = ? AND skill_id = ?
                """,
                (today, LEARNER_ID, skill_id),
            )
        else:
            connection.execute(
                """
                INSERT INTO learner_skill_progress
                    (learner_id, skill_id, completed_lessons, crowns, is_unlocked, completed_at)
                VALUES (?, ?, 1, 1, 1, ?)
                """,
                (LEARNER_ID, skill_id, today),
            )

        next_skill = connection.execute(
            """
            SELECT id FROM skills
            WHERE unit_id = (SELECT unit_id FROM skills WHERE id = ?)
              AND position > (SELECT position FROM skills WHERE id = ?)
            ORDER BY position LIMIT 1
            """,
            (skill_id, skill_id),
        ).fetchone()
        if next_skill:
            connection.execute(
                """
                INSERT INTO learner_skill_progress (learner_id, skill_id, is_unlocked)
                VALUES (?, ?, 1)
                ON CONFLICT(learner_id, skill_id) DO UPDATE SET is_unlocked = 1
                """,
                (LEARNER_ID, next_skill["id"]),
            )

        if next_skill is None:
            next_unit_skill = connection.execute(
                """SELECT s.id FROM skills s JOIN units u ON u.id = s.unit_id
                   WHERE u.course_id = (SELECT course_id FROM units WHERE id = (SELECT unit_id FROM skills WHERE id = ?))
                     AND u.position > (SELECT position FROM units WHERE id = (SELECT unit_id FROM skills WHERE id = ?))
                   ORDER BY u.position, s.position LIMIT 1""",
                (skill_id, skill_id),
            ).fetchone()
            if next_unit_skill:
                connection.execute(
                    """INSERT INTO learner_skill_progress (learner_id, skill_id, is_unlocked)
                       VALUES (?, ?, 1) ON CONFLICT(learner_id, skill_id) DO UPDATE SET is_unlocked = 1""",
                    (LEARNER_ID, next_unit_skill["id"]),
                )
                next_skill = next_unit_skill

        # A streak advances at most once per calendar day.
        last_date = learner["last_activity_date"]
        if last_date != today:
            yesterday = (date.today() - timedelta(days=1)).isoformat()
            new_streak = learner["streak_days"] + 1 if last_date == yesterday else 1
        else:
            new_streak = learner["streak_days"]

        connection.execute(
            """
            UPDATE learners
            SET total_xp = total_xp + ?, last_activity_date = ?, streak_days = ?
            WHERE id = ?
            """,
            (reward, today, new_streak, LEARNER_ID),
        )

        if not already_completed:
            connection.execute(
                """
                INSERT INTO learner_stats (learner_id, correct_answers, lessons_completed)
                VALUES (?, 0, 1)
                ON CONFLICT(learner_id) DO UPDATE
                SET lessons_completed = lessons_completed + 1
                """,
                (LEARNER_ID,),
            )
            connection.execute(
                """
                INSERT INTO learner_daily_stats
                    (learner_id, activity_date, xp_earned, lessons_completed, correct_answers)
                VALUES (?, ?, ?, 1, 0)
                ON CONFLICT(learner_id, activity_date) DO UPDATE
                SET xp_earned = xp_earned + excluded.xp_earned,
                    lessons_completed = lessons_completed + 1
                """,
                (LEARNER_ID, today, reward),
            )

        award_achievements(connection)
        updated = dict(get_learner(connection))
        connection.commit()
        return {
            "success": True,
            "xp_earned": reward,
            "learner": updated,
            "next_skill_unlocked": next_skill["id"] if next_skill else None,
        }


@app.get("/api/practice/questions")
def get_practice_questions(mode: str = "sprint", limit: int = 10):
    """Return safe-to-display questions for the sprint or the learner's mistake queue."""
    if mode not in {"sprint", "mcq", "typing", "mixed", "review"}:
        raise HTTPException(status_code=400, detail="Mode must be mcq, typing, mixed, or review")
    limit = max(1, min(limit, 20))
    with get_connection() as connection:
        if mode == "review":
            rows = connection.execute(
                """
                SELECT e.id, e.lesson_id, e.exercise_type, e.prompt, e.options_json,
                       l.title AS lesson_title, m.wrong_count, m.last_wrong_answer
                FROM learner_mistakes m
                JOIN exercises e ON e.id = m.exercise_id
                JOIN lessons l ON l.id = e.lesson_id
                WHERE m.learner_id = ? AND m.resolved_at IS NULL
                ORDER BY m.wrong_count DESC, m.last_attempted_at DESC
                LIMIT ?
                """, (LEARNER_ID, limit)
            ).fetchall()
        else:
            type_filter = {
                "mcq": "e.exercise_type IN ('multiple_choice', 'fill_blank')",
                "typing": "e.exercise_type = 'type_answer'",
                "mixed": "e.exercise_type != 'match_pairs'",
                "sprint": "e.exercise_type != 'match_pairs'",
            }[mode]
            rows = connection.execute(
                f"""
                SELECT e.id, e.lesson_id, e.exercise_type, e.prompt, e.options_json,
                       l.title AS lesson_title, NULL AS wrong_count, NULL AS last_wrong_answer
                FROM exercises e JOIN lessons l ON l.id = e.lesson_id
                WHERE {type_filter}
                ORDER BY RANDOM() LIMIT ?
                """, (limit,)
            ).fetchall()
        questions = []
        for row in rows:
            item = dict(row)
            item["options"] = parse_json(item.pop("options_json"), [])
            questions.append(item)
        return {"mode": mode, "questions": questions, "count": len(questions)}


class PracticeAnswerSubmission(BaseModel):
    exercise_id: int
    answer: str = Field(max_length=2000)
    mode: str = Field(default="mixed", pattern="^(sprint|mcq|typing|mixed|review)$")


@app.post("/api/practice/answer")
def submit_practice_answer(submission: PracticeAnswerSubmission):
    """Practice is heart-free. Correct answers earn at most 2 XP per exercise/mode/day."""
    with get_connection() as connection:
        exercise = connection.execute(
            "SELECT id, lesson_id, exercise_type, answer FROM exercises WHERE id = ?",
            (submission.exercise_id,),
        ).fetchone()
        if exercise is None:
            raise HTTPException(status_code=404, detail="Practice question not found")
        correct = answer_is_correct(exercise["exercise_type"], submission.answer, exercise["answer"])
        today = date.today().isoformat()
        xp_earned = 0
        if correct:
            mark_learning_activity(connection, today)
            connection.execute(
                "UPDATE learner_mistakes SET resolved_at = ? WHERE learner_id = ? AND exercise_id = ?",
                (today, LEARNER_ID, exercise["id"]),
            )
            awarded = connection.execute(
                """
                INSERT OR IGNORE INTO learner_practice_rewards
                    (learner_id, exercise_id, activity_date, mode, xp_awarded)
                VALUES (?, ?, ?, ?, 2)
                """, (LEARNER_ID, exercise["id"], today, submission.mode)
            ).rowcount
            if awarded:
                xp_earned = 2
                connection.execute("UPDATE learners SET total_xp = total_xp + ? WHERE id = ?", (xp_earned, LEARNER_ID))
                connection.execute(
                    """
                    INSERT INTO learner_daily_stats
                        (learner_id, activity_date, xp_earned, lessons_completed, correct_answers)
                    VALUES (?, ?, ?, 0, 0)
                    ON CONFLICT(learner_id, activity_date) DO UPDATE
                    SET xp_earned = xp_earned + excluded.xp_earned
                    """, (LEARNER_ID, today, xp_earned)
                )
        else:
            connection.execute(
                """
                INSERT INTO learner_mistakes
                    (learner_id, exercise_id, wrong_count, last_wrong_answer, last_attempted_at, resolved_at)
                VALUES (?, ?, 1, ?, ?, NULL)
                ON CONFLICT(learner_id, exercise_id) DO UPDATE SET
                    wrong_count = learner_mistakes.wrong_count + 1,
                    last_wrong_answer = excluded.last_wrong_answer,
                    last_attempted_at = excluded.last_attempted_at,
                    resolved_at = NULL
                """, (LEARNER_ID, exercise["id"], submission.answer[:500], today)
            )
        award_achievements(connection)
        connection.commit()
        correct_answer = exercise["answer"]
        if exercise["exercise_type"] == "match_pairs":
            correct_answer = json.dumps(parse_json(correct_answer, []), ensure_ascii=False)
        unresolved = connection.execute(
            "SELECT COUNT(*) AS count FROM learner_mistakes WHERE learner_id = ? AND resolved_at IS NULL",
            (LEARNER_ID,),
        ).fetchone()["count"]
        learner = dict(get_learner(connection))
        return {
            "correct": correct,
            "correct_answer": correct_answer,
            "xp_earned": xp_earned,
            "total_xp": learner["total_xp"],
            "mistakes_remaining": unresolved,
            "message": "Nice recall!" if correct and xp_earned else ("Correct — this question's practice XP was already claimed today." if correct else "Not quite. We saved it for another round."),
        }


@app.get("/api/practice/summary")
def practice_summary():
    with get_connection() as connection:
        mistakes = connection.execute(
            "SELECT COUNT(*) AS count FROM learner_mistakes WHERE learner_id = ? AND resolved_at IS NULL",
            (LEARNER_ID,),
        ).fetchone()["count"]
        practiced = connection.execute(
            "SELECT COUNT(*) AS count FROM learner_practice_rewards WHERE learner_id = ? AND activity_date = ?",
            (LEARNER_ID, date.today().isoformat()),
        ).fetchone()["count"]
        return {"mistakes_to_review": mistakes, "questions_practiced_today": practiced}


class BossAnswer(BaseModel):
    exercise_id: int
    answer: str = Field(max_length=2000)


class BossSubmission(BaseModel):
    answers: list[BossAnswer] = Field(min_length=1, max_length=30)


@app.get("/api/bosses")
def get_bosses():
    """List every unit's boss and expose attempts only when the unit is fully completed."""
    with get_connection() as connection:
        units = connection.execute(
            "SELECT id, title, position FROM units WHERE course_id=(SELECT id FROM courses ORDER BY id LIMIT 1) ORDER BY position"
        ).fetchall()
        result = []
        for unit in units:
            total = connection.execute(
                "SELECT COUNT(*) n FROM skills WHERE unit_id=?", (unit["id"],)
            ).fetchone()["n"]
            completed = connection.execute(
                """SELECT COUNT(*) n FROM learner_skill_progress p
                   JOIN skills s ON s.id=p.skill_id
                   WHERE p.learner_id=? AND s.unit_id=? AND p.completed_lessons>0""",
                (LEARNER_ID, unit["id"]),
            ).fetchone()["n"]
            first = connection.execute(
                "SELECT is_unlocked FROM learner_skill_progress WHERE learner_id=? AND skill_id=(SELECT id FROM skills WHERE unit_id=? ORDER BY position LIMIT 1)",
                (LEARNER_ID, unit["id"]),
            ).fetchone()
            battle = connection.execute(
                "SELECT best_score, attempts, completed_at FROM learner_boss_battles WHERE learner_id=? AND unit_id=?",
                (LEARNER_ID, unit["id"]),
            ).fetchone()
            available = bool(total > 0 and completed >= total and first and first["is_unlocked"])
            result.append({
                "unit": dict(unit),
                "completed_skills": completed,
                "total_skills": total,
                "available": available,
                "best_score": battle["best_score"] if battle else 0,
                "attempts": battle["attempts"] if battle else 0,
                "completed": bool(battle and battle["completed_at"]),
            })
        return {"units": result}


@app.get("/api/progress-quiz/questions")
def get_progress_quiz_questions(limit: int = 20):
    """Return mixed questions only from fully completed units, with answers kept server-side."""
    limit = max(1, min(limit, 30))
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT e.id, e.lesson_id, e.exercise_type, e.prompt, e.options_json,
                   l.title AS lesson_title, u.title AS unit_title
            FROM exercises e
            JOIN lessons l ON l.id=e.lesson_id
            JOIN skills s ON s.id=l.skill_id
            JOIN units u ON u.id=s.unit_id
            WHERE e.exercise_type != 'match_pairs'
              AND u.id IN (
                  SELECT s2.unit_id
                  FROM skills s2
                  LEFT JOIN learner_skill_progress p
                    ON p.skill_id=s2.id AND p.learner_id=?
                  GROUP BY s2.unit_id
                  HAVING COUNT(*) > 0 AND SUM(CASE WHEN COALESCE(p.completed_lessons, 0)>0 THEN 1 ELSE 0 END)=COUNT(*)
              )
            ORDER BY RANDOM()
            LIMIT ?
            """,
            (LEARNER_ID, limit),
        ).fetchall()
        questions = []
        for row in rows:
            item = dict(row)
            item["options"] = parse_json(item.pop("options_json"), [])
            questions.append(item)
        return {"questions": questions, "count": len(questions), "limit": limit}


@app.get("/api/boss/{unit_id}")
def get_boss(unit_id: int):
    """Return a unit's boss-round questions without exposing expected answers."""
    with get_connection() as connection:
        unit = connection.execute("SELECT id, title, position FROM units WHERE id = ?", (unit_id,)).fetchone()
        if unit is None:
            raise HTTPException(status_code=404, detail="Unit not found")
        skills = connection.execute("SELECT id FROM skills WHERE unit_id = ?", (unit_id,)).fetchall()
        if not skills:
            raise HTTPException(status_code=404, detail="This unit has no lessons yet")
        first_skill = connection.execute(
            "SELECT is_unlocked FROM learner_skill_progress WHERE learner_id = ? AND skill_id = ?",
            (LEARNER_ID, skills[0]["id"]),
        ).fetchone()
        completed = connection.execute(
            "SELECT COUNT(*) AS n FROM learner_skill_progress WHERE learner_id = ? AND skill_id IN (SELECT id FROM skills WHERE unit_id = ?) AND completed_lessons > 0",
            (LEARNER_ID, unit_id),
        ).fetchone()["n"]
        question_rows = connection.execute(
            """SELECT e.id, e.lesson_id, e.exercise_type, e.prompt, e.options_json, l.title AS lesson_title
               FROM exercises e JOIN lessons l ON l.id = e.lesson_id JOIN skills s ON s.id = l.skill_id
               WHERE s.unit_id = ? AND e.exercise_type != 'match_pairs' ORDER BY RANDOM() LIMIT 5""",
            (unit_id,),
        ).fetchall()
        battle = connection.execute("SELECT best_score, attempts, completed_at, xp_awarded FROM learner_boss_battles WHERE learner_id = ? AND unit_id = ?", (LEARNER_ID, unit_id)).fetchone()
        previous_unit = connection.execute("SELECT id FROM units WHERE course_id=(SELECT course_id FROM units WHERE id=?) AND position < (SELECT position FROM units WHERE id=?) ORDER BY position DESC LIMIT 1", (unit_id, unit_id)).fetchone()
        previous_unlocked = False
        if previous_unit:
            prev_total = connection.execute("SELECT COUNT(*) n FROM skills WHERE unit_id=?", (previous_unit["id"],)).fetchone()["n"]
            prev_done = connection.execute("SELECT COUNT(*) n FROM learner_skill_progress p JOIN skills s ON s.id=p.skill_id WHERE p.learner_id=? AND s.unit_id=? AND p.completed_lessons>0", (LEARNER_ID, previous_unit["id"])).fetchone()["n"]
            previous_unlocked = prev_total > 0 and prev_done >= prev_total
        # Boss rounds are unit finals: require every skill in that unit to be completed.
        total_skills = len(skills)
        unlocked = total_skills > 0 and completed >= total_skills
        return {"unit": dict(unit), "questions": [{**dict(r), "options": parse_json(r["options_json"], [])} for r in question_rows],
                "completed_skills": completed, "total_skills": len(skills), "unlocked": unlocked,
                "best_score": battle["best_score"] if battle else 0, "attempts": battle["attempts"] if battle else 0,
                "completed": bool(battle and battle["completed_at"]), "xp_awarded": battle["xp_awarded"] if battle else 0}


@app.post("/api/boss/{unit_id}/submit")
def submit_boss(unit_id: int, submission: BossSubmission):
    """Grade a boss round server-side; first clear awards 25 XP, replay improves best score."""
    today = date.today().isoformat()
    with get_connection() as connection:
        unit = connection.execute("SELECT id FROM units WHERE id = ?", (unit_id,)).fetchone()
        if unit is None:
            raise HTTPException(status_code=404, detail="Unit not found")
        total_skills = connection.execute(
            "SELECT COUNT(*) n FROM skills WHERE unit_id=?", (unit_id,)
        ).fetchone()["n"]
        completed_skills = connection.execute(
            """SELECT COUNT(*) n FROM learner_skill_progress p
               JOIN skills s ON s.id=p.skill_id
               WHERE p.learner_id=? AND s.unit_id=? AND p.completed_lessons>0""",
            (LEARNER_ID, unit_id),
        ).fetchone()["n"]
        if total_skills == 0 or completed_skills < total_skills:
            raise HTTPException(status_code=403, detail="Complete every skill in this unit before attempting its boss battle")
        ids = [item.exercise_id for item in submission.answers]
        if len(set(ids)) != len(ids):
            raise HTTPException(status_code=400, detail="Each boss question can only be submitted once")
        correct = 0
        details = []
        for item in submission.answers:
            row = connection.execute(
                "SELECT e.id, e.answer, e.exercise_type, s.unit_id FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN skills s ON s.id=l.skill_id WHERE e.id=?",
                (item.exercise_id,),
            ).fetchone()
            if row is None or row["unit_id"] != unit_id:
                raise HTTPException(status_code=400, detail="A question does not belong to this unit")
            is_correct = answer_is_correct(row["exercise_type"], item.answer, row["answer"])
            correct += int(is_correct)
            details.append({"exercise_id": item.exercise_id, "correct": is_correct, "correct_answer": row["answer"]})
        total = len(details)
        passed = total >= 3 and correct / total >= 0.7
        prior = connection.execute("SELECT * FROM learner_boss_battles WHERE learner_id=? AND unit_id=?", (LEARNER_ID, unit_id)).fetchone()
        old_best = prior["best_score"] if prior else 0
        already_cleared = bool(prior and prior["completed_at"])
        reward = 25 if passed and not already_cleared else 0
        if prior:
            connection.execute("""UPDATE learner_boss_battles SET best_score=MAX(best_score, ?), attempts=attempts+1,
                completed_at=CASE WHEN ? THEN COALESCE(completed_at, ?) ELSE completed_at END,
                xp_awarded=xp_awarded+? WHERE learner_id=? AND unit_id=?""",
                (correct, int(passed), today, reward, LEARNER_ID, unit_id))
        else:
            connection.execute("INSERT INTO learner_boss_battles (learner_id, unit_id, best_score, attempts, completed_at, xp_awarded) VALUES (?, ?, ?, 1, ?, ?)",
                (LEARNER_ID, unit_id, correct, today if passed else None, reward))
        if reward:
            mark_learning_activity(connection, today)
            connection.execute("UPDATE learners SET total_xp=total_xp+? WHERE id=?", (reward, LEARNER_ID))
            connection.execute("""INSERT INTO learner_daily_stats (learner_id, activity_date, xp_earned, lessons_completed, correct_answers)
                VALUES (?, ?, ?, 0, 0) ON CONFLICT(learner_id, activity_date) DO UPDATE SET xp_earned=xp_earned+excluded.xp_earned""", (LEARNER_ID, today, reward))
        connection.commit()
        return {"passed": passed, "correct": correct, "total": total, "percentage": round(correct / total * 100),
                "xp_earned": reward, "already_cleared": already_cleared, "best_score": max(old_best, correct), "details": details,
                "message": "Boss defeated! +25 XP" if reward else ("Boss cleared — replay for a better score." if passed else "Almost! Review your lessons and try again.")}


@app.get("/api/profile")
def get_profile():
    with get_connection() as connection:
        learner = dict(get_learner(connection))
        stats = connection.execute("SELECT correct_answers, lessons_completed FROM learner_stats WHERE learner_id=?", (LEARNER_ID,)).fetchone()
        skills_done = connection.execute("SELECT COUNT(*) n FROM learner_skill_progress WHERE learner_id=? AND completed_lessons>0", (LEARNER_ID,)).fetchone()["n"]
        skills_total = connection.execute("SELECT COUNT(*) n FROM skills").fetchone()["n"]
        exercise_count = connection.execute("SELECT COUNT(*) n FROM learner_exercise_completions WHERE learner_id=?", (LEARNER_ID,)).fetchone()["n"]
        bosses = connection.execute("SELECT COUNT(*) n FROM learner_boss_battles WHERE learner_id=? AND completed_at IS NOT NULL", (LEARNER_ID,)).fetchone()["n"]
        history = connection.execute("SELECT id, mode, answered, correct, xp_earned, duration_seconds, completed_at FROM learner_sprint_records WHERE learner_id=? ORDER BY completed_at DESC, id DESC LIMIT 8", (LEARNER_ID,)).fetchall()
        daily = connection.execute("SELECT activity_date, xp_earned, lessons_completed, correct_answers FROM learner_daily_stats WHERE learner_id=? ORDER BY activity_date DESC LIMIT 7", (LEARNER_ID,)).fetchall()
        return {"learner": learner, "stats": {"lessons_completed": stats["lessons_completed"] if stats else 0, "correct_answers": stats["correct_answers"] if stats else 0, "unique_exercises_mastered": exercise_count, "skills_completed": skills_done, "skills_total": skills_total, "bosses_cleared": bosses}, "sprint_records": [dict(r) for r in history], "recent_days": [dict(r) for r in daily]}


class ResetRequest(BaseModel):
    scope: str = Field(default="progress", pattern="^(progress|demo|unit)$")
    unit_id: int | None = None


@app.post("/api/reset")
def reset_demo(request: ResetRequest):
    """Controlled demo reset. The server owns the allowed scopes and baseline values."""
    with get_connection() as connection:
        if request.scope == "unit":
            if request.unit_id is None:
                raise HTTPException(status_code=400, detail="Choose a unit to reset")
            unit = connection.execute("SELECT id FROM units WHERE id=?", (request.unit_id,)).fetchone()
            if not unit:
                raise HTTPException(status_code=404, detail="Unit not found")
            # Reset this unit and all later units so the learning path stays sequential.
            unit_ids = [r["id"] for r in connection.execute("SELECT id FROM units WHERE course_id=(SELECT course_id FROM units WHERE id=?) AND position >= (SELECT position FROM units WHERE id=?)", (request.unit_id, request.unit_id)).fetchall()]
            skill_ids = [r["id"] for r in connection.execute(f"SELECT id FROM skills WHERE unit_id IN ({','.join('?' for _ in unit_ids)})", unit_ids).fetchall()] if unit_ids else []
            lesson_ids = [r["id"] for r in connection.execute(f"SELECT id FROM lessons WHERE skill_id IN ({','.join('?' for _ in skill_ids)})", skill_ids).fetchall()] if skill_ids else []
            exercise_ids = [r["id"] for r in connection.execute(f"SELECT id FROM exercises WHERE lesson_id IN ({','.join('?' for _ in lesson_ids)})", lesson_ids).fetchall()] if lesson_ids else []
            if exercise_ids:
                marks=','.join('?' for _ in exercise_ids)
                for table in ("learner_exercise_completions", "learner_mistakes", "learner_practice_rewards"):
                    connection.execute(f"DELETE FROM {table} WHERE learner_id=? AND exercise_id IN ({marks})", [LEARNER_ID, *exercise_ids])
            if skill_ids:
                marks=','.join('?' for _ in skill_ids)
                connection.execute(f"DELETE FROM learner_skill_progress WHERE learner_id=? AND skill_id IN ({marks})", [LEARNER_ID, *skill_ids])
            if unit_ids:
                marks=','.join('?' for _ in unit_ids)
                connection.execute(f"DELETE FROM learner_boss_battles WHERE learner_id=? AND unit_id IN ({marks})", [LEARNER_ID, *unit_ids])
            first_skill = connection.execute("SELECT id FROM skills WHERE unit_id=(SELECT id FROM units WHERE position=1 ORDER BY id LIMIT 1) ORDER BY position LIMIT 1").fetchone()
            if first_skill:
                connection.execute("INSERT INTO learner_skill_progress (learner_id, skill_id, is_unlocked) VALUES (?, ?, 1) ON CONFLICT(learner_id, skill_id) DO UPDATE SET is_unlocked=1", (LEARNER_ID, first_skill["id"]))
            message = "This unit and later units have been reset. Earlier progress was kept."
        else:
            for table in ("learner_skill_progress", "learner_daily_stats", "learner_exercise_completions", "learner_achievements", "learner_mistakes", "learner_practice_rewards", "learner_boss_battles", "learner_sprint_records"):
                connection.execute(f"DELETE FROM {table} WHERE learner_id=?", (LEARNER_ID,))
            connection.execute("INSERT INTO learner_skill_progress (learner_id, skill_id, completed_lessons, crowns, is_unlocked) SELECT ?, id, 0, 0, CASE WHEN position=1 AND unit_id=(SELECT id FROM units ORDER BY position LIMIT 1) THEN 1 ELSE 0 END FROM skills", (LEARNER_ID,))
            connection.execute("INSERT INTO learner_stats (learner_id, correct_answers, lessons_completed) VALUES (?,0,0) ON CONFLICT(learner_id) DO UPDATE SET correct_answers=0, lessons_completed=0", (LEARNER_ID,))
            if request.scope == "demo":
                connection.execute("UPDATE learners SET display_name='Alex Rivera', total_xp=0, streak_days=0, hearts=5, gems=500, last_activity_date=NULL WHERE id=?", (LEARNER_ID,))
                message = "Demo reset complete. XP, streak, hearts, gems, course progress, practice history, and boss records are back to the demo baseline."
            else:
                connection.execute("UPDATE learners SET hearts=5 WHERE id=?", (LEARNER_ID,))
                message = "Course progress reset. XP and gems were kept; hearts were refilled."
        connection.commit()
        return {"success": True, "scope": request.scope, "message": message, "learner": dict(get_learner(connection))}


class SprintRecordRequest(BaseModel):
    mode: str = Field(pattern="^(mcq|typing|mixed)$")
    answered: int = Field(ge=0, le=100)
    correct: int = Field(ge=0, le=100)
    xp_earned: int = Field(ge=0, le=1000)
    duration_seconds: int = Field(default=60, ge=1, le=3600)


@app.post("/api/practice/sprint-record")
def save_sprint_record(request: SprintRecordRequest):
    if request.correct > request.answered:
        raise HTTPException(status_code=400, detail="Correct answers cannot exceed answered questions")
    with get_connection() as connection:
        connection.execute("INSERT INTO learner_sprint_records (learner_id, mode, answered, correct, xp_earned, duration_seconds, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (LEARNER_ID, request.mode, request.answered, request.correct, request.xp_earned, request.duration_seconds, date.today().isoformat()))
        best = connection.execute("SELECT MAX(correct) best FROM learner_sprint_records WHERE learner_id=? AND mode=?", (LEARNER_ID, request.mode)).fetchone()["best"] or 0
        connection.commit()
        return {"success": True, "best_correct": best}


@app.post("/api/hearts/refill")
def refill_hearts():
    with get_connection() as connection:
        learner = get_learner(connection)
        if learner["hearts"] >= MAX_HEARTS:
            return {"success": True, "hearts": learner["hearts"], "gems": learner["gems"]}
        if learner["gems"] < 100:
            raise HTTPException(status_code=400, detail="Not enough gems to refill hearts.")

        connection.execute(
            "UPDATE learners SET hearts = ?, gems = gems - 100 WHERE id = ?",
            (MAX_HEARTS, LEARNER_ID),
        )
        updated = get_learner(connection)
        connection.commit()
        return {
            "success": True,
            "hearts": updated["hearts"],
            "gems": updated["gems"],
        }
