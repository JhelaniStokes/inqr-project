import json
import os
import secrets
import sqlite3
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException
from openai import OpenAI
from pydantic import BaseModel

DB_PATH = os.environ.get("DB_PATH", "app.db")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-5-mini")

app = FastAPI(title="CWE Feedback Tracker")


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                paper_text TEXT NOT NULL,
                feedback_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reports (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                strengths_json TEXT NOT NULL,
                weaknesses_json TEXT NOT NULL,
                checklist_json TEXT NOT NULL,
                generated_at TEXT NOT NULL
            );
            """
        )


init_db()


def now():
    return datetime.now(timezone.utc).isoformat()


def current_user(authorization: str = Header(default="")) -> int:
    token = authorization.removeprefix("Bearer ").strip()
    with db() as conn:
        row = conn.execute("SELECT user_id FROM sessions WHERE token = ?", (token,)).fetchone()
    if not row:
        raise HTTPException(401, "Not logged in")
    return row["user_id"]


# ---------- auth ----------

class Creds(BaseModel):
    username: str
    password: str


def new_session(conn, user_id: int) -> str:
    token = secrets.token_hex(16)
    conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    return token


@app.post("/api/signup")
def signup(c: Creds):
    if not c.username.strip() or not c.password:
        raise HTTPException(400, "Username and password required")
    with db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)", (c.username.strip(), c.password)
            )
        except sqlite3.IntegrityError:
            raise HTTPException(400, "Username taken")
        return {"token": new_session(conn, cur.lastrowid), "username": c.username.strip()}


@app.post("/api/login")
def login(c: Creds):
    with db() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE username = ? AND password = ?", (c.username.strip(), c.password)
        ).fetchone()
        if not row:
            raise HTTPException(401, "Wrong username or password")
        return {"token": new_session(conn, row["id"]), "username": c.username.strip()}


@app.post("/api/logout")
def logout(authorization: str = Header(default="")):
    with db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (authorization.removeprefix("Bearer ").strip(),))
    return {"ok": True}


@app.get("/api/me")
def me(user_id: int = Depends(current_user)):
    with db() as conn:
        row = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"username": row["username"]}


# ---------- submissions ----------

class SubmissionIn(BaseModel):
    title: str = ""
    paper_text: str
    feedback: list[str]


def submission_out(row, full=False):
    out = {
        "id": row["id"],
        "title": row["title"],
        "feedback": json.loads(row["feedback_json"]),
        "created_at": row["created_at"],
    }
    if full:
        out["paper_text"] = row["paper_text"]
    return out


@app.post("/api/submissions")
def create_submission(s: SubmissionIn, user_id: int = Depends(current_user)):
    feedback = [f.strip() for f in s.feedback if f.strip()]
    if not s.paper_text.strip():
        raise HTTPException(400, "Paper text required")
    if not feedback:
        raise HTTPException(400, "Add at least one feedback note")
    title = s.title.strip() or s.paper_text.strip().splitlines()[0][:60]
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO submissions (user_id, title, paper_text, feedback_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, title, s.paper_text, json.dumps(feedback), now()),
        )
    return {"id": cur.lastrowid}


@app.get("/api/submissions")
def list_submissions(user_id: int = Depends(current_user)):
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM submissions WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    return [submission_out(r) for r in rows]


@app.get("/api/submissions/{sid}")
def get_submission(sid: int, user_id: int = Depends(current_user)):
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM submissions WHERE id = ? AND user_id = ?", (sid, user_id)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    return submission_out(row, full=True)


@app.delete("/api/submissions/{sid}")
def delete_submission(sid: int, user_id: int = Depends(current_user)):
    with db() as conn:
        conn.execute("DELETE FROM submissions WHERE id = ? AND user_id = ?", (sid, user_id))
    return {"ok": True}


# ---------- report ----------

REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "strengths": {"type": "array", "items": {"type": "string"}},
        "weaknesses": {"type": "array", "items": {"type": "string"}},
        "checklist": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item": {"type": "string"},
                    "seen_on": {"type": "integer"},
                    "why": {"type": "string"},
                },
                "required": ["item", "seen_on", "why"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["strengths", "weaknesses", "checklist"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You are a writing coach at a university writing center.
You will receive the feedback a student has received on their past papers, from professors and writing center tutors.
Find the recurring patterns across ALL submissions.

Return:
- strengths: 2-5 things the student consistently does well (only if the feedback supports it).
- weaknesses: 3-6 recurring problems, most frequent first.
- checklist: 5-10 concrete, actionable self-check items the student can run through while writing or revising.
  Each item should be phrased as a check ("Does every paragraph start with a claim that supports the thesis?").
  "seen_on" is the number of distinct papers whose feedback flagged this issue.
  "why" is ONE short sentence (under 15 words) naming the feedback that motivated it.
Order the checklist by seen_on, highest first. Be specific, not generic."""


def report_out(row, submission_count):
    if not row:
        return {"report": None, "submission_count": submission_count, "stale": submission_count > 0}
    return {
        "report": {
            "strengths": json.loads(row["strengths_json"]),
            "weaknesses": json.loads(row["weaknesses_json"]),
            "checklist": json.loads(row["checklist_json"]),
            "generated_at": row["generated_at"],
        },
        "submission_count": submission_count,
        "stale": row["stale"] > 0,
    }


def load_report(conn, user_id):
    count = conn.execute("SELECT COUNT(*) FROM submissions WHERE user_id = ?", (user_id,)).fetchone()[0]
    row = conn.execute(
        """SELECT r.*, (SELECT COUNT(*) FROM submissions s
                        WHERE s.user_id = r.user_id AND s.created_at > r.generated_at) AS stale
           FROM reports r WHERE r.user_id = ?""",
        (user_id,),
    ).fetchone()
    return report_out(row, count)


@app.get("/api/report")
def get_report(user_id: int = Depends(current_user)):
    with db() as conn:
        return load_report(conn, user_id)


@app.post("/api/report/generate")
def generate_report(user_id: int = Depends(current_user)):
    with db() as conn:
        rows = conn.execute(
            "SELECT title, feedback_json, created_at FROM submissions WHERE user_id = ? ORDER BY created_at",
            (user_id,),
        ).fetchall()
    if not rows:
        raise HTTPException(400, "Add a submission first")

    feedback_dump = "\n\n".join(
        f"## Paper {i}: {r['title']} ({r['created_at'][:10]})\n"
        + "\n".join(f"- {f}" for f in json.loads(r["feedback_json"]))
        for i, r in enumerate(rows, 1)
    )

    try:
        resp = OpenAI().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": feedback_dump},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "report", "strict": True, "schema": REPORT_SCHEMA},
            },
        )
        data = json.loads(resp.choices[0].message.content)
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {e}")

    with db() as conn:
        conn.execute(
            """INSERT INTO reports (user_id, strengths_json, weaknesses_json, checklist_json, generated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 strengths_json = excluded.strengths_json,
                 weaknesses_json = excluded.weaknesses_json,
                 checklist_json = excluded.checklist_json,
                 generated_at = excluded.generated_at""",
            (user_id, json.dumps(data["strengths"]), json.dumps(data["weaknesses"]),
             json.dumps(data["checklist"]), now()),
        )
        return load_report(conn, user_id)
