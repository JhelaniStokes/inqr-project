"""Creates a demo account (demo / demo) with sample submissions.
Run: docker compose exec backend python seed.py
"""
import json
from datetime import datetime, timedelta, timezone

from main import db

SUBMISSIONS = [
    (
        "ENGL 1101 – Social Media and Teen Identity",
        "Social media has changed the way teenagers see themselves. This paper will discuss social media "
        "and its effects on teens. Platforms like Instagram and TikTok are used by millions of young people "
        "every day...",
        [
            "Thesis announces a topic rather than making an arguable claim.",
            "Paragraph 3 drifts away from your main point; consider cutting or refocusing.",
            "Good use of a vivid opening example to hook the reader.",
            "Several sources are cited without page numbers (MLA requires them for direct quotes).",
            "Watch comma splices, e.g. 'Teens post constantly, they want validation.'",
        ],
    ),
    (
        "HIST 1112 – Causes of World War I",
        "The First World War was caused by many factors. Militarism, alliances, imperialism, and nationalism "
        "all played a role in the outbreak of war in 1914...",
        [
            "Your thesis lists four causes but doesn't argue which mattered most. Take a position.",
            "Strong research — you clearly know the material.",
            "Quotes are dropped in without introduction or analysis afterward.",
            "Topic sentences summarize facts instead of advancing your argument.",
        ],
    ),
    (
        "PSYC 1101 – Sleep and Academic Performance",
        "Sleep is very important for college students. Many students do not get enough sleep, which can "
        "hurt their grades. According to research, students who sleep less than six hours...",
        [
            "CWE tutor: thesis is clearer than past drafts, but still a bit broad.",
            "Evidence is summarized but not analyzed — explain HOW the study supports your point.",
            "APA in-text citations are missing years in two places.",
            "Comma splices in paragraphs 2 and 4.",
            "Conclusion just repeats the introduction; push toward implications.",
        ],
    ),
    (
        "ENGL 1102 – Rhetorical Analysis of a TED Talk",
        "In her TED Talk, Brené Brown uses personal stories to connect with her audience. She appeals to "
        "pathos through humor and vulnerability...",
        [
            "Nice clear organization — each paragraph covers one rhetorical appeal.",
            "You describe what the speaker does but rarely explain why it is effective.",
            "Integrate quotes with signal phrases instead of standalone quote sentences.",
            "Good, varied sentence structure; reads smoothly.",
        ],
    ),
    (
        "COMM 1110 – Persuasive Speech Outline: Campus Recycling",
        "Augusta University should expand its recycling program to every building on campus. Currently, "
        "only a handful of buildings have dedicated recycling bins...",
        [
            "Clear, arguable thesis — big improvement!",
            "Main points need more evidence; two of three rely on personal observation only.",
            "Works cited formatting is inconsistent (hanging indent, alphabetization).",
            "Conclusion restates the points but lacks a call to action.",
        ],
    ),
]


def seed():
    with db() as conn:
        conn.execute("DELETE FROM users WHERE username = 'demo'")
        uid = conn.execute("INSERT INTO users (username, password) VALUES ('demo', 'demo')").lastrowid
        start = datetime.now(timezone.utc) - timedelta(days=7 * len(SUBMISSIONS))
        for i, (title, paper, feedback) in enumerate(SUBMISSIONS):
            conn.execute(
                "INSERT INTO submissions (user_id, title, paper_text, feedback_json, created_at) VALUES (?, ?, ?, ?, ?)",
                (uid, title, paper, json.dumps(feedback), (start + timedelta(days=7 * i)).isoformat()),
            )
    print(f"Seeded user 'demo' (password 'demo') with {len(SUBMISSIONS)} submissions.")


if __name__ == "__main__":
    seed()
