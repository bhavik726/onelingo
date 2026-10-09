import os
import sqlite3
from pathlib import Path

DB_PATH = Path(
    os.getenv("DATABASE_PATH", Path(__file__).resolve().parent.parent / "duolingo.db")
)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS learners (
                id INTEGER PRIMARY KEY,
                display_name TEXT NOT NULL,
                total_xp INTEGER NOT NULL DEFAULT 0 CHECK(total_xp >= 0),
                streak_days INTEGER NOT NULL DEFAULT 0 CHECK(streak_days >= 0),
                hearts INTEGER NOT NULL DEFAULT 5 CHECK(hearts BETWEEN 0 AND 5),
                gems INTEGER NOT NULL DEFAULT 500 CHECK(gems >= 0),
                last_activity_date TEXT
            );

            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                language_code TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS units (
                id INTEGER PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL,
                UNIQUE(course_id, position)
            );

            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY,
                unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL,
                UNIQUE(unit_id, position)
            );

            CREATE TABLE IF NOT EXISTS lessons (
                id INTEGER PRIMARY KEY,
                skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL,
                xp_reward INTEGER NOT NULL DEFAULT 10 CHECK(xp_reward >= 0),
                UNIQUE(skill_id, position)
            );

            CREATE TABLE IF NOT EXISTS exercises (
                id INTEGER PRIMARY KEY,
                lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                exercise_type TEXT NOT NULL CHECK(exercise_type IN (
                    'multiple_choice', 'translate', 'match_pairs', 'fill_blank', 'type_answer'
                )),
                prompt TEXT NOT NULL,
                answer TEXT NOT NULL,
                options_json TEXT,
                position INTEGER NOT NULL,
                UNIQUE(lesson_id, position)
            );

            CREATE TABLE IF NOT EXISTS learner_skill_progress (
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
                completed_lessons INTEGER NOT NULL DEFAULT 0,
                crowns INTEGER NOT NULL DEFAULT 0,
                is_unlocked INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                PRIMARY KEY (learner_id, skill_id)
            );

            -- Additive Phase 4 tables. Existing Phase 1–3 data is preserved.
            CREATE TABLE IF NOT EXISTS learner_stats (
                learner_id INTEGER PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
                correct_answers INTEGER NOT NULL DEFAULT 0,
                lessons_completed INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS learner_daily_stats (
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                activity_date TEXT NOT NULL,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                lessons_completed INTEGER NOT NULL DEFAULT 0,
                correct_answers INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (learner_id, activity_date)
            );

            CREATE TABLE IF NOT EXISTS learner_exercise_completions (
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                completed_at TEXT NOT NULL,
                PRIMARY KEY (learner_id, exercise_id)
            );

            CREATE TABLE IF NOT EXISTS learner_achievements (
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                achievement_key TEXT NOT NULL,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY (learner_id, achievement_key)
            );

            -- Phase 5: keep a personal queue of missed exercises and cap practice XP per day.
            CREATE TABLE IF NOT EXISTS learner_mistakes (
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                wrong_count INTEGER NOT NULL DEFAULT 1,
                last_wrong_answer TEXT,
                last_attempted_at TEXT NOT NULL,
                resolved_at TEXT,
                PRIMARY KEY (learner_id, exercise_id)
            );

            CREATE TABLE IF NOT EXISTS learner_practice_rewards (
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                activity_date TEXT NOT NULL,
                mode TEXT NOT NULL,
                xp_awarded INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (learner_id, exercise_id, activity_date, mode)
            );

            -- Phase 6: one-time unit boss rewards and best results.
            CREATE TABLE IF NOT EXISTS learner_boss_battles (
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
                best_score INTEGER NOT NULL DEFAULT 0,
                attempts INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                xp_awarded INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (learner_id, unit_id)
            );

            CREATE TABLE IF NOT EXISTS learner_sprint_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                mode TEXT NOT NULL CHECK(mode IN ('mcq', 'typing', 'mixed')),
                answered INTEGER NOT NULL DEFAULT 0,
                correct INTEGER NOT NULL DEFAULT 0,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                duration_seconds INTEGER NOT NULL DEFAULT 60,
                completed_at TEXT NOT NULL
            );
            """
        )
        seed_database(connection)


def seed_database(connection: sqlite3.Connection) -> None:
    """Idempotent seed: add missing content but never reset existing learner progress."""
    connection.execute(
        """
        INSERT OR IGNORE INTO learners
            (id, display_name, total_xp, streak_days, hearts, gems)
        VALUES (1, 'Alex Rivera', 0, 0, 5, 500)
        """
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO courses (id, title, language_code, description)
        VALUES (1, 'Spanish', 'es', 'Learn the basics of Spanish.')
        """
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO units (id, course_id, title, position)
        VALUES (1, 1, 'Getting started', 1)
        """
    )
    connection.executemany(
        "INSERT OR IGNORE INTO skills (id, unit_id, title, position) VALUES (?, 1, ?, ?)",
        [(1, "Basics", 1), (2, "Greetings", 2), (3, "Introductions", 3)],
    )
    connection.executemany(
        """
        INSERT OR IGNORE INTO lessons (id, skill_id, title, position, xp_reward)
        VALUES (?, ?, ?, 1, 10)
        """,
        [(1, 1, "Basics 1"), (2, 2, "Greetings 1"), (3, 3, "Introductions 1")],
    )
    # Phase 6 adds two more learning units and six short lessons. Existing rows stay untouched.
    connection.executemany(
        "INSERT OR IGNORE INTO units (id, course_id, title, position) VALUES (?, 1, ?, ?)",
        [(2, "Everyday conversations", 2), (3, "Food & travel", 3)],
    )
    connection.executemany(
        "INSERT OR IGNORE INTO skills (id, unit_id, title, position) VALUES (?, ?, ?, ?)",
        [(4, 2, "Polite phrases", 1), (5, 2, "People & places", 2), (6, 2, "Quick questions", 3),
         (7, 3, "At the café", 1), (8, 3, "Getting around", 2), (9, 3, "Travel essentials", 3)],
    )
    connection.executemany(
        "INSERT OR IGNORE INTO lessons (id, skill_id, title, position, xp_reward) VALUES (?, ?, ?, 1, 10)",
        [(4, 4, "Polite phrases 1"), (5, 5, "People & places 1"), (6, 6, "Quick questions 1"),
         (7, 7, "At the café 1"), (8, 8, "Getting around 1"), (9, 9, "Travel essentials 1")],
    )

    exercises = [
        (1, "multiple_choice", "What does “hola” mean?", "hello",
         ["hello", "goodbye", "please"], 1),
        (1, "type_answer", "Translate “thank you” into Spanish.", "gracias", None, 2),
        (1, "translate", "Build the Spanish phrase for “good morning”.",
         "buenos días", ["días", "buenas", "buenos", "adiós"], 3),
        (1, "fill_blank", "Complete the greeting: buenos ___.",
         "días", ["días", "hola", "gracias", "adiós"], 4),
        (1, "match_pairs", "Match each Spanish word with its English meaning.",
         '[{"left":"hola","right":"hello"},{"left":"adiós","right":"goodbye"},{"left":"gracias","right":"thank you"}]',
         [
             {"left": "hola", "right": "hello"},
             {"left": "adiós", "right": "goodbye"},
             {"left": "gracias", "right": "thank you"},
         ], 5),
        (2, "multiple_choice", "How do you say “good morning” in Spanish?",
         "buenos días", ["buenas noches", "buenos días", "adiós"], 1),
        (2, "translate", "Build the Spanish phrase for “hello, Ana”.",
         "hola ana", ["ana", "adiós", "hola", "gracias"], 2),
        (2, "fill_blank", "Complete: ___ tardes. (Good afternoon.)",
         "buenas", ["hola", "buenas", "gracias", "días"], 3),
        (2, "type_answer", "Type “goodbye” in Spanish.", "adiós", None, 4),
        (2, "match_pairs", "Match each greeting with its meaning.",
         '[{"left":"buenos días","right":"good morning"},{"left":"buenas noches","right":"good evening"},{"left":"por favor","right":"please"}]',
         [
             {"left": "buenos días", "right": "good morning"},
             {"left": "buenas noches", "right": "good evening"},
             {"left": "por favor", "right": "please"},
         ], 5),
        (3, "multiple_choice", "What does “me llamo Ana” mean?",
         "my name is Ana", ["I am hungry", "my name is Ana", "good night"], 1),
        (3, "fill_blank", "Me ___ Carlos. (My name is Carlos.)",
         "llamo", ["hola", "llamo", "adiós", "días"], 2),
        (3, "translate", "Build the Spanish phrase for “thank you”.",
         "gracias", ["por", "gracias", "favor", "hola"], 3),
        (3, "type_answer", "Type “please” in Spanish.", "por favor", None, 4),
        (4, "multiple_choice", "How do you say “excuse me” in Spanish?", "perdón", ["perdón", "gracias", "hasta luego"], 1),
        (4, "type_answer", "Type “you’re welcome” in Spanish.", "de nada", None, 2),
        (4, "fill_blank", "Complete: por ___. (please)", "favor", ["favor", "noche", "día"], 3),
        (5, "multiple_choice", "What does “amigo” mean?", "friend", ["friend", "street", "water"], 1),
        (5, "type_answer", "Type “the house” in Spanish.", "la casa", None, 2),
        (5, "translate", "Build the Spanish phrase for “good afternoon”.", "buenas tardes", ["tardes", "buenas", "hola", "adiós"], 3),
        (6, "multiple_choice", "What does “¿dónde?” mean?", "where", ["where", "when", "why"], 1),
        (6, "type_answer", "Type “how much?” in Spanish.", "cuánto cuesta", None, 2),
        (6, "fill_blank", "Complete: ¿Cómo te ___? (What is your name?)", "llamas", ["llamas", "gracias", "buenas"], 3),
        (7, "multiple_choice", "How do you say “water” in Spanish?", "agua", ["agua", "pan", "leche"], 1),
        (7, "type_answer", "Type “the bill, please” in Spanish.", "la cuenta por favor", None, 2),
        (7, "fill_blank", "Un café, por ___.", "favor", ["favor", "días", "hola"], 3),
        (8, "multiple_choice", "What does “izquierda” mean?", "left", ["left", "right", "straight"], 1),
        (8, "type_answer", "Type “the station” in Spanish.", "la estación", None, 2),
        (8, "translate", "Build “go straight ahead”.", "sigue recto", ["sigue", "recto", "gracias", "calle"], 3),
        (9, "multiple_choice", "What does “el pasaporte” mean?", "the passport", ["the passport", "the suitcase", "the ticket"], 1),
        (9, "type_answer", "Type “I need help” in Spanish.", "necesito ayuda", None, 2),
        (9, "fill_blank", "Tengo una ___. (I have a reservation.)", "reserva", ["reserva", "calle", "cuenta"], 3),
    ]
    import json
    for lesson_id, exercise_type, prompt, answer, options, position in exercises:
        options_json = json.dumps(options, ensure_ascii=False) if options is not None else None
        connection.execute(
            """
            INSERT OR IGNORE INTO exercises
                (lesson_id, exercise_type, prompt, answer, options_json, position)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (lesson_id, exercise_type, prompt, answer, options_json, position),
        )

    # Extra varied prompts reduce repetition in the timed practice arcade.
    extra_exercises = [
        (1, "multiple_choice", "Which word means ‘please’?", "por favor", ["por favor", "adiós", "agua"], 6),
        (1, "type_answer", "Type ‘good night’ in Spanish.", "buenas noches", None, 7),
        (1, "fill_blank", "Complete: Muchas ___. (Thank you very much.)", "gracias", ["gracias", "hola", "casa"], 8),
        (2, "multiple_choice", "What does ‘hasta luego’ mean?", "see you later", ["see you later", "good morning", "please"], 6),
        (2, "type_answer", "Type ‘good evening’ in Spanish.", "buenas noches", None, 7),
        (2, "fill_blank", "Complete: ¿Cómo ___? (How are you?)", "estás", ["estás", "gracias", "amigo"], 8),
        (3, "multiple_choice", "What does ‘soy’ mean in ‘soy Carlos’?", "I am", ["I am", "you are", "goodbye"], 6),
        (3, "type_answer", "Type ‘my name is Ana’ in Spanish.", "me llamo ana", None, 7),
        (3, "fill_blank", "Me llamo ___. (My name is...)", "ana", ["ana", "agua", "adiós"], 8),
        (4, "multiple_choice", "What does ‘de nada’ mean?", "you're welcome", ["you're welcome", "excuse me", "goodbye"], 4),
        (4, "type_answer", "Type ‘please’ in Spanish.", "por favor", None, 5),
        (5, "multiple_choice", "What does ‘la escuela’ mean?", "the school", ["the school", "the street", "the café"], 4),
        (5, "type_answer", "Type ‘the friend’ in Spanish.", "el amigo", None, 5),
        (6, "multiple_choice", "What does ‘cuándo’ mean?", "when", ["when", "where", "how much"], 4),
        (6, "type_answer", "Type ‘where is the station?’ in Spanish.", "dónde está la estación", None, 5),
        (7, "multiple_choice", "What does ‘leche’ mean?", "milk", ["milk", "bread", "water"], 4),
        (7, "type_answer", "Type ‘a coffee, please’ in Spanish.", "un café por favor", None, 5),
        (8, "multiple_choice", "What does ‘derecha’ mean?", "right", ["right", "left", "straight"], 4),
        (8, "type_answer", "Type ‘the street’ in Spanish.", "la calle", None, 5),
        (9, "multiple_choice", "What does ‘el billete’ mean?", "the ticket", ["the ticket", "the passport", "the hotel"], 4),
        (9, "type_answer", "Type ‘I have a reservation’ in Spanish.", "tengo una reserva", None, 5),
    ]
    for lesson_id, exercise_type, prompt, answer, options, position in extra_exercises:
        connection.execute(
            "INSERT OR IGNORE INTO exercises (lesson_id, exercise_type, prompt, answer, options_json, position) VALUES (?, ?, ?, ?, ?, ?)",
            (lesson_id, exercise_type, prompt, answer, json.dumps(options, ensure_ascii=False) if options is not None else None, position),
        )

    connection.executemany(
        """
        INSERT OR IGNORE INTO learner_skill_progress
            (learner_id, skill_id, completed_lessons, crowns, is_unlocked)
        VALUES (1, ?, 0, 0, ?)
        """,
        [(1, 1), (2, 1), (3, 0), (4, 0), (5, 0), (6, 0), (7, 0), (8, 0), (9, 0)],
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO learner_stats (learner_id, correct_answers, lessons_completed)
        VALUES (1, 0, 0)
        """
    )
    # Backfill existing completed skills only when the new lifetime counter is zero.
    connection.execute(
        """
        UPDATE learner_stats
        SET lessons_completed = (
            SELECT COUNT(*) FROM learner_skill_progress
            WHERE learner_id = 1 AND completed_lessons > 0
        )
        WHERE learner_id = 1 AND lessons_completed = 0
        """
    )
    connection.commit()
