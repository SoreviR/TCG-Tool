import os
import uuid
import zipfile
import shutil
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# ==============================
# CONFIGURACIÓN
# ==============================

MAX_IMAGES = 20  # 10 cartas
SESSIONS_DIR = "sessions"

os.makedirs(SESSIONS_DIR, exist_ok=True)

app = FastAPI(title="TCG Image Tool")

# ==============================
# SERVIR UI
# ==============================

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")

# ==============================
# PROGRESO
# ==============================

progress = {}

# ==============================
# UTILIDADES DE IMAGEN
# ==============================

def crop_5mm(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    mm_to_px = int(5 * 300 / 25.4)  # ~59px
    return img[mm_to_px:h-mm_to_px, mm_to_px:w-mm_to_px]

def visual_complexity_score(img: np.ndarray) -> float:
    """
    Calcula un score de complejidad visual.
    Más alto = más probable que sea el FRONT.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 80, 160)
    return np.sum(edges > 0)

def order_front_back(img1: np.ndarray, img2: np.ndarray):
    score1 = visual_complexity_score(img1)
    score2 = visual_complexity_score(img2)

    if score1 >= score2:
        return img1, img2
    else:
        return img2, img1

def join_front_back(front: np.ndarray, back: np.ndarray) -> np.ndarray:
    h = max(front.shape[0], back.shape[0])

    def resize(img):
        if img.shape[0] != h:
            scale = h / img.shape[0]
            return cv2.resize(
                img,
                (int(img.shape[1] * scale), h),
                interpolation=cv2.INTER_AREA
            )
        return img

    front = resize(front)
    back = resize(back)

    return np.hstack([front, back])

# ==============================
# PROCESAMIENTO
# ==============================

def process_images(session_id: str, filepaths: List[str]):
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    output_dir = os.path.join(session_dir, "output")
    os.makedirs(output_dir, exist_ok=True)

    total_cards = len(filepaths) // 2
    progress[session_id]["total"] = total_cards

    for i in range(0, len(filepaths), 2):
        img_a = cv2.imread(filepaths[i])
        img_b = cv2.imread(filepaths[i + 1])

        img_a = crop_5mm(img_a)
        img_b = crop_5mm(img_b)

        front, back = order_front_back(img_a, img_b)
        combined = join_front_back(front, back)

        out_path = os.path.join(output_dir, f"card_{i//2 + 1}.jpg")
        cv2.imwrite(out_path, combined)

        progress[session_id]["current"] += 1

    zip_path = os.path.join(session_dir, "result.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for f in os.listdir(output_dir):
            zipf.write(os.path.join(output_dir, f), arcname=f)

    progress[session_id]["running"] = False

# ==============================
# ENDPOINTS
# ==============================

@app.post("/upload")
async def upload(files: List[UploadFile], background: BackgroundTasks):
    if not files:
        raise HTTPException(400, "No se subieron archivos")

    if len(files) > MAX_IMAGES:
        raise HTTPException(
            400,
            f"Máximo permitido: {MAX_IMAGES} imágenes ({MAX_IMAGES//2} cartas)"
        )

    if len(files) % 2 != 0:
        raise HTTPException(
            400,
            "Debes subir un número par de imágenes (front/back)"
        )

    session_id = str(uuid.uuid4())
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    saved = []
    for i, file in enumerate(files):
        path = os.path.join(session_dir, f"{i}.jpg")
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved.append(path)

    progress[session_id] = {
        "current": 0,
        "total": 0,
        "running": True
    }

    background.add_task(process_images, session_id, saved)
    return {"session_id": session_id}

@app.get("/progress/{session_id}")
def get_progress(session_id: str):
    if session_id not in progress:
        raise HTTPException(404, "Sesión no encontrada")
    return progress[session_id]

@app.get("/download/{session_id}")
def download(session_id: str):
    zip_path = os.path.join(SESSIONS_DIR, session_id, "result.zip")
    if not os.path.exists(zip_path):
        raise HTTPException(404, "Archivo no disponible")

    return FileResponse(
        zip_path,
        filename="tcg_images.zip",
        media_type="application/zip"
    )
