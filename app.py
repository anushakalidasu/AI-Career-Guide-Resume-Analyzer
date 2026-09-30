import os
import json
import re
from io import BytesIO

from dotenv import load_dotenv

# Load .env before using Gemini
load_dotenv()

from flask import Flask, jsonify, render_template, request
from google import genai
from google.genai import types
from pypdf import PdfReader
from docx import Document


app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")


# =========================================================
# GEMINI CONFIGURATION
# =========================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

PRIMARY_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.5-flash"
).strip()

FALLBACK_MODEL = os.getenv(
    "GEMINI_FALLBACK_MODEL",
    "gemini-3.5-flash-lite"
).strip()


def call_gemini(prompt):
    """Call Gemini safely without crashing the application."""

    if not GEMINI_API_KEY:
        print("[Gemini] API key not found.")
        return None

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as error:
        print("[Gemini] Client error:", error)
        return None

    models = [PRIMARY_MODEL]

    if FALLBACK_MODEL and FALLBACK_MODEL != PRIMARY_MODEL:
        models.append(FALLBACK_MODEL)

    for model in models:
        try:
            print(f"[Gemini] Trying: {model}")

            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            if response and response.text:
                print(f"[Gemini] Success: {model}")
                return response.text

        except Exception as error:
            print(
                f"[Gemini] {model} failed: "
                f"{type(error).__name__}: {error}"
            )

    print("[Gemini] AI unavailable. Using fallback result.")
    return None


def parse_json(text):
    """Safely convert Gemini response into Python JSON."""

    if not text:
        return None

    try:
        return json.loads(text)
    except Exception:
        pass

    cleaned = (
        text
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    try:
        return json.loads(cleaned)
    except Exception:
        return None


# =========================================================
# JOB PORTALS
# =========================================================

def get_job_portals():

    path = os.path.join(
        DATA_DIR,
        "job_portals.json"
    )

    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return []


# =========================================================
# CAREER GUIDE FALLBACK
# =========================================================

def create_fallback_plan(
    name,
    role,
    skills,
    days,
    hours
):

    topics = [
        "Understand the fundamentals of the target role",
        "Strengthen your existing skills",
        "Learn important role-specific tools",
        "Practice practical exercises",
        "Work on a portfolio project",
        "Improve your resume",
        "Practice interview questions",
        "Review and revise"
    ]

    plan = []

    for day in range(1, days + 1):

        topic = topics[(day - 1) % len(topics)]

        plan.append({
            "day": day,
            "topic": topic,
            "tasks": [
                f"Study {topic.lower()}",
                "Practice with a practical exercise",
                "Write down the important concepts learned"
            ],
            "hours": hours,
            "resources": [
                {
                    "title": "Google Learning Search",
                    "url": (
                        "https://www.google.com/search?q="
                        + topic.replace(" ", "+")
                    )
                },
                {
                    "title": "YouTube Tutorials",
                    "url": (
                        "https://www.youtube.com/results?search_query="
                        + topic.replace(" ", "+")
                    )
                }
            ]
        })

    return {
        "success": True,
        "mode": "fallback",
        "name": name,
        "target_role": role,
        "current_skills": skills,
        "summary": (
            f"Your {days}-day learning roadmap for "
            f"{role} is based on your current skills."
        ),
        "skill_gaps": [
            "Role-specific tools",
            "Practical project experience",
            "Interview preparation"
        ],
        "plan": plan
    }


# =========================================================
# CAREER GUIDE API
# =========================================================

@app.post("/api/career")
def career_api():

    data = request.get_json(silent=True) or {}

    name = str(
        data.get("name", "")
    ).strip()

    role = str(
        data.get("target_role", "")
    ).strip()

    skills_text = str(
        data.get("skills", "")
    ).strip()

    try:
        days = max(
            1,
            min(30, int(data.get("days", 30)))
        )

        hours = max(
            0.5,
            min(12, float(data.get("hours", 2)))
        )

    except (TypeError, ValueError):
        days = 30
        hours = 2

    if not name or not role:

        return jsonify({
            "success": False,
            "message": "Please enter your name and target role."
        }), 400

    skills = [
        skill.strip()
        for skill in re.split(
            r"[,;\n]+",
            skills_text
        )
        if skill.strip()
    ]

    prompt = f"""
You are an AI career guidance assistant.

Create a personalized {days}-day career learning plan.

Name:
{name}

Target Role:
{role}

Current Skills:
{skills}

Available time:
{hours} hours per day.

Requirements:

1. Analyze the current skills.
2. Identify skill gaps for the target role.
3. Create exactly {days} days.
4. Respect {hours} hours per day.
5. Give practical learning tasks.
6. Give useful learning resources.
7. Include resource URLs where possible.
8. Do not invent completed skills, experience,
   certifications or education.
9. Keep the plan understandable for a beginner.

Return ONLY valid JSON:

{{
    "summary": "...",
    "skill_gaps": [
        "...",
        "..."
    ],
    "plan": [
        {{
            "day": 1,
            "topic": "...",
            "tasks": [
                "...",
                "..."
            ],
            "hours": {hours},
            "resources": [
                {{
                    "title": "...",
                    "url": "https://..."
                }}
            ]
        }}
    ]
}}
"""

    ai_text = call_gemini(prompt)

    ai_result = parse_json(ai_text)

    if (
        isinstance(ai_result, dict)
        and ai_result.get("plan")
    ):

        ai_result["success"] = True
        ai_result["mode"] = "gemini"
        ai_result["name"] = name
        ai_result["target_role"] = role
        ai_result["current_skills"] = skills

        return jsonify(ai_result)

    # Gemini unavailable → application still works
    return jsonify(
        create_fallback_plan(
            name,
            role,
            skills,
            days,
            hours
        )
    )


# =========================================================
# RESUME TEXT EXTRACTION
# =========================================================

def extract_resume_text(
    file_bytes,
    filename
):

    if filename.lower().endswith(".pdf"):

        reader = PdfReader(
            BytesIO(file_bytes)
        )

        text = ""

        for page in reader.pages:
            text += page.extract_text() or ""

        return text

    if filename.lower().endswith(".docx"):

        document = Document(
            BytesIO(file_bytes)
        )

        return "\n".join(
            paragraph.text
            for paragraph in document.paragraphs
        )

    raise ValueError(
        "Only PDF and DOCX files are supported."
    )


# =========================================================
# ATS SCORE
# =========================================================

def calculate_ats_score(
    resume_text,
    target_role
):

    text = resume_text.lower()

    role_keywords = {

        "data analyst": [
            "sql",
            "excel",
            "python",
            "power bi",
            "tableau",
            "data analysis",
            "statistics"
        ],

        "software developer": [
            "java",
            "python",
            "javascript",
            "sql",
            "git",
            "api",
            "project"
        ],

        "hr": [
            "recruitment",
            "communication",
            "excel",
            "human resources",
            "hr",
            "employee"
        ],

        "business analyst": [
            "sql",
            "excel",
            "requirements",
            "business analysis",
            "communication",
            "documentation"
        ]
    }

    keywords = role_keywords.get(
        target_role.lower(),
        [
            "skills",
            "project",
            "experience",
            "education",
            "communication"
        ]
    )

    matched = [
        keyword
        for keyword in keywords
        if keyword in text
    ]

    missing = [
        keyword
        for keyword in keywords
        if keyword not in text
    ]

    score = int(
        (len(matched) / len(keywords)) * 100
    )

    if len(resume_text) > 1000:
        score = min(100, score + 10)

    return score, matched, missing


# =========================================================
# RESUME ANALYZER API
# =========================================================

@app.post("/api/resume")
def resume_api():

    target_role = str(
        request.form.get("target_role", "")
    ).strip()

    uploaded = request.files.get("resume")

    if not target_role:

        return jsonify({
            "success": False,
            "message": "Please enter your target role."
        }), 400

    if not uploaded or not uploaded.filename:

        return jsonify({
            "success": False,
            "message": "Please upload your resume."
        }), 400

    filename = uploaded.filename.lower()

    if not (
        filename.endswith(".pdf")
        or filename.endswith(".docx")
    ):

        return jsonify({
            "success": False,
            "message": "Please upload a PDF or DOCX file."
        }), 400

    try:

        resume_text = extract_resume_text(
            uploaded.read(),
            filename
        )

    except Exception as error:

        return jsonify({
            "success": False,
            "message": f"Could not read resume: {error}"
        }), 400

    if not resume_text.strip():

        return jsonify({
            "success": False,
            "message": "No readable text found in the resume."
        }), 400

    ats_score, matched, missing = calculate_ats_score(
        resume_text,
        target_role
    )

    prompt = f"""
Analyze this resume for the target role:

Target Role:
{target_role}

Resume:
{resume_text[:15000]}

Provide:

1. Resume improvement suggestions.
2. Skills to strengthen or add.
3. Certifications to consider.
4. A professional summary suggestion.
5. Job search advice.

Do NOT claim that the candidate already has
skills or certifications that are not present.

Return ONLY valid JSON:

{{
    "improvements": [
        "...",
        "..."
    ],
    "recommended_skills": [
        "...",
        "..."
    ],
    "certifications": [
        "...",
        "..."
    ],
    "summary_suggestion": "...",
    "job_search_advice": "..."
}}
"""

    ai_text = call_gemini(prompt)

    ai_result = parse_json(ai_text)

    if not ai_result:

        ai_result = {
            "improvements": [
                "Add measurable achievements to projects.",
                "Use keywords relevant to the target role.",
                "Improve the professional summary.",
                "Keep resume sections clear and consistent."
            ],

            "recommended_skills": missing[:5],

            "certifications": [
                "Consider a certification relevant "
                "to the target role."
            ],

            "summary_suggestion": (
                f"Create a concise professional summary "
                f"focused on {target_role}."
            ),

            "job_search_advice": (
                "Search multiple job portals and compare "
                "job descriptions before applying."
            )
        }

    return jsonify({

        "success": True,

        "mode": (
            "gemini"
            if ai_text
            else "fallback"
        ),

        "target_role": target_role,

        "ats_score": ats_score,

        "matched_skills": matched,

        "missing_skills": missing,

        **ai_result,

        "job_portals": get_job_portals()
    })


# =========================================================
# HOME PAGE
# =========================================================

@app.get("/")
def home():

    return render_template(
        "index.html"
    )


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    print()
    print("=" * 50)
    print("AI CAREER GUIDE & RESUME ANALYZER")
    print("=" * 50)
    print(
        "Gemini key loaded:",
        bool(GEMINI_API_KEY)
    )
    print(
        "Primary model:",
        PRIMARY_MODEL
    )
    print(
        "Fallback model:",
        FALLBACK_MODEL
    )
    print(
        "Open: http://127.0.0.1:5000"
    )
    print("=" * 50)
    print()

    app.run(debug=True)