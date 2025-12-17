from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
import shutil
import uuid
import zipfile
import cv2
import numpy as np
import sqlite3
import httpx

# ================= CONFIG =================


RESEND_API_KEY = os.getenv("RESEND_API_KEY")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
FEEDBACK_EMAIL_TO = os.getenv("FEEDBACK_EMAIL_TO")

if not ADMIN_TOKEN:
    raise RuntimeError("ADMIN_TOKEN environment variable is required")

BASE_SESSIONS = "sessions"
BASE_DB = "feedback.db"


os.makedirs(BASE_SESSIONS, exist_ok=True)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

progress_state = {}

# ================= DB =================

def init_db():
    conn = sqlite3.connect(BASE_DB)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            name TEXT,
            email TEXT,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ================= MODELS =================

class FeedbackIn(BaseModel):
    category: str
    message: str
    name: Optional[str] = None
    email: Optional[str] = None

# ================= ROUTES =================

@app.get("/", response_class=HTMLResponse)
def index():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()

# ================= IMAGE UTILS =================

def visual_score(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    edge_score = np.sum(edges > 0)
    lap_score = cv2.Laplacian(gray, cv2.CV_64F).var()

    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    hist = hist / hist.sum()
    entropy = -np.sum(hist * np.log2(hist + 1e-9))

    return edge_score * 0.5 + lap_score * 10 + entropy * 1000

def detect_front_back(img1, img2):
    s1 = visual_score(img1)
    s2 = visual_score(img2)
    return (img1, img2) if s1 >= s2 else (img2, img1)

def crop_with_margin(img):
    h, w = img.shape[:2]
    margin_mm = 5
    dpi = 300
    px = int((margin_mm / 25.4) * dpi)
    return img[px:h - px, px:w - px]

def combine_images(front, back):
    h = max(front.shape[0], back.shape[0])

    def pad(img):
        return cv2.copyMakeBorder(
            img, 0, h - img.shape[0], 0, 0,
            cv2.BORDER_CONSTANT, value=[0, 0, 0]
        )

    return np.hstack((pad(front), pad(back)))

# ================= PROCESS =================

@app.post("/process")
async def process(files: list[UploadFile] = File(...)):
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(BASE_SESSIONS, session_id)
    os.makedirs(session_dir, exist_ok=True)

    total_pairs = len(files) // 2
    progress_state[session_id] = {"current": 0, "total": total_pairs, "done": False}

    paths = []
    for i, f in enumerate(files):
        path = os.path.join(session_dir, f"{i}.jpg")
        with open(path, "wb") as out:
            shutil.copyfileobj(f.file, out)
        paths.append(path)

    outputs = []

    for i in range(0, len(paths), 2):
        img1 = cv2.imread(paths[i])
        img2 = cv2.imread(paths[i + 1])

        front, back = detect_front_back(img1, img2)
        front = crop_with_margin(front)
        back = crop_with_margin(back)

        combined = combine_images(front, back)
        out_path = os.path.join(session_dir, f"card_{i//2 + 1}.jpg")
        cv2.imwrite(out_path, combined)

        outputs.append(out_path)
        progress_state[session_id]["current"] += 1

    zip_path = os.path.join(session_dir, "cards.zip")
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for img in outputs:
            zipf.write(img, arcname=os.path.basename(img))

    progress_state[session_id]["done"] = True
    return {"session_id": session_id}

@app.get("/progress/{session_id}")
def progress(session_id: str):
    state = progress_state.get(session_id)
    if not state:
        return {"progress": 0, "done": False}

    percent = int((state["current"] / max(state["total"], 1)) * 100)
    return {"progress": percent, "done": state["done"]}

@app.get("/download/{session_id}")
def download(session_id: str):
    zip_path = os.path.join(BASE_SESSIONS, session_id, "cards.zip")
    if not os.path.exists(zip_path):
        return JSONResponse({"detail": "Archivo no disponible"}, status_code=404)
    return FileResponse(zip_path, filename="cards.zip")

# ================= FEEDBACK =================

@app.post("/feedback")
async def submit_feedback(feedback: FeedbackIn):
    created_at = datetime.utcnow().isoformat()

    conn = sqlite3.connect(BASE_DB)
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO feedback (category, name, email, message, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            feedback.category,
            feedback.name,
            feedback.email,
            feedback.message,
            created_at,
        ),
    )
    conn.commit()
    conn.close()

    if RESEND_API_KEY and FEEDBACK_EMAIL_TO:

        async with httpx.AsyncClient() as client:

            
            await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "Resend <onboarding@resend.dev>",
                    "to": [FEEDBACK_EMAIL_TO],
                    "subject": f"Nuevo feedback ({feedback.category})",
                    "html": f"""
                        <h2>Nuevo Feedback</h2>
                        <p><b>Category:</b> {feedback.category}</p>
                        <p><b>Name:</b> {feedback.name or "Anonymous"}</p>
                        <p><b>Email:</b> {feedback.email or "Not provided"}</p>
                        <hr />
                        <p>{feedback.message}</p>
                        <small>{created_at}</small>
                    """,
                },

            )

            

    return {"ok": True}


# ================= ADMIN =================

@app.get("/admin/feedback")
def admin_feedback(token: str):
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")

    conn = sqlite3.connect(BASE_DB)
    c = conn.cursor()
    c.execute(
        "SELECT category, name, email, message, created_at FROM feedback ORDER BY id DESC"
    )
    rows = c.fetchall()
    conn.close()

    html = "<h1>Feedback</h1><ul>"
    for cat, name, email, msg, date in rows:
        html += f"""
        <li>
          <b>{cat}</b> – {name or "Anonymous"} ({email or "no email"})<br/>
          {msg}<br/>
          <small>{date}</small>
        </li>
        <hr>
        """
    html += "</ul>"

    return HTMLResponse(html)
