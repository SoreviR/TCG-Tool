from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os, shutil, uuid, zipfile, sqlite3, smtplib
from email.message import EmailMessage
import cv2
import numpy as np

# ===================== CONFIG =====================

FEEDBACK_DB = "feedback.db"

EMAIL_ENABLED = True
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "TU_EMAIL@gmail.com"
SMTP_PASS = "TU_APP_PASSWORD"
EMAIL_TO = "TU_EMAIL@gmail.com"

# ==================================================

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

BASE_SESSIONS = "sessions"
os.makedirs(BASE_SESSIONS, exist_ok=True)

progress_state = {}

# ===================== DB =====================

def init_db():
    with sqlite3.connect(FEEDBACK_DB) as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            email TEXT,
            message TEXT,
            language TEXT,
            theme TEXT
        )
        """)

init_db()

# ===================== PAGES =====================

@app.get("/", response_class=HTMLResponse)
def index():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()

# ===================== IMAGE UTILS =====================

def visual_score(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    lap = cv2.Laplacian(gray, cv2.CV_64F).var()
    return np.sum(edges > 0) * 0.5 + lap * 10

def detect_front_back(img1, img2):
    return (img1, img2) if visual_score(img1) >= visual_score(img2) else (img2, img1)

def crop_with_margin(img):
    h, w = img.shape[:2]
    margin_px = int((5 / 25.4) * 300)
    return img[margin_px:h - margin_px, margin_px:w - margin_px]

def combine_images(front, back):
    h = max(front.shape[0], back.shape[0])

    def pad(img):
        return cv2.copyMakeBorder(img, 0, h - img.shape[0], 0, 0,
                                  cv2.BORDER_CONSTANT, value=[0, 0, 0])
    return np.hstack((pad(front), pad(back)))

# ===================== API =====================

@app.post("/process")
async def process(files: list[UploadFile] = File(...)):
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(BASE_SESSIONS, session_id)
    os.makedirs(session_dir, exist_ok=True)

    progress_state[session_id] = {"current": 0, "total": len(files)//2, "done": False}

    paths = []
    for i, f in enumerate(files):
        path = os.path.join(session_dir, f"{i}.jpg")
        with open(path, "wb") as out:
            shutil.copyfileobj(f.file, out)
        paths.append(path)

    outputs = []

    for i in range(0, len(paths), 2):
        img1 = cv2.imread(paths[i])
        img2 = cv2.imread(paths[i+1])

        front, back = detect_front_back(img1, img2)
        combined = combine_images(crop_with_margin(front), crop_with_margin(back))

        out = os.path.join(session_dir, f"card_{i//2+1}.jpg")
        cv2.imwrite(out, combined)
        outputs.append(out)

        progress_state[session_id]["current"] += 1

    zip_path = os.path.join(session_dir, "cards.zip")
    with zipfile.ZipFile(zip_path, "w") as z:
        for f in outputs:
            z.write(f, os.path.basename(f))

    progress_state[session_id]["done"] = True
    return {"session_id": session_id}

@app.get("/progress/{session_id}")
def progress(session_id: str):
    s = progress_state.get(session_id, {})
    pct = int((s.get("current", 0) / max(s.get("total", 1), 1)) * 100)
    return {"progress": pct, "done": s.get("done", False)}

@app.get("/download/{session_id}")
def download(session_id: str):
    path = os.path.join(BASE_SESSIONS, session_id, "cards.zip")
    if not os.path.exists(path):
        return JSONResponse({"detail": "Archivo no disponible"}, status_code=404)
    return FileResponse(path, filename="cards.zip")

# ===================== FEEDBACK =====================

class Feedback(BaseModel):
    message: str
    email: str | None = None
    language: str
    theme: str

@app.post("/feedback")
def feedback(data: Feedback):
    with sqlite3.connect(FEEDBACK_DB) as conn:
        conn.execute(
            "INSERT INTO feedback (email, message, language, theme) VALUES (?, ?, ?, ?)",
            (data.email, data.message, data.language, data.theme)
        )

    if EMAIL_ENABLED:
        msg = EmailMessage()
        msg["Subject"] = "Nuevo Feedback - TCG Tool"
        msg["From"] = SMTP_USER
        msg["To"] = EMAIL_TO
        msg.set_content(
            f"Mensaje:\n{data.message}\n\nEmail: {data.email}\nIdioma: {data.language}\nTema: {data.theme}"
        )

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)

    return {"status": "ok"}
