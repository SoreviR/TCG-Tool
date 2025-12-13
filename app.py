import os
import uuid
import zipfile
import shutil
from typing import List

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# ==============================
# CONFIGURACIÓN
# ==============================

MAX_IMAGES = 20  # 10 cartas (front + back)
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
# PROGRESO POR SESIÓN
# ==============================

progress = {}  # session_id -> {"current": int, "total": int, "running": bool}


# ==============================
# UTILIDADES DE IMAGEN
# ==============================

def crop_5mm(img: np.ndarray) -> np.ndarray:
    """
    Recorta ~5mm desde cada borde de la imagen.
    Asumimos foto estándar de móvil (~300 DPI).
    """
    h, w = img.shape[:2]
    mm_to_px = int(5 * 300 / 25.4)  # ≈ 59px

    y1 = mm_to_px
    y2 = h - mm_to_px
    x1 = mm_to_px
    x2 = w - mm_to_px

    return img[y1:y2, x1:x2]


def join_front_back(front: np.ndarray, back: np.ndarray) -> np.ndarray:
    """
    Une front (izquierda) y back (derecha)
    """
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
# PROCESAMIENTO PRINCIPAL
# ==============================

def process_images(session_id: str, filepaths: List[str]):
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    output_dir = os.path.join(session_dir, "output")
    os.makedirs(output_dir, exist_ok=True)

    total_cards = len(filepaths) // 2
    progress[session_id]["total"] = total_cards

    for i in range(0, len(filepaths), 2):
        front_path = filepaths[i]
        back_path = filepaths[i + 1]

        img_front = cv2.imread(front_path)
        img_back = cv2.imread(back_path)

        img_front = crop_5mm(img_front)
        img_back = crop_5mm(img_back)

        combined = join_front_back(img_front, img_back)

        out_name = f"card_{i//2 + 1}.jpg"
        out_path = os.path.join(output_dir, out_name)
        cv2.imwrite(out_path, combined)

        progress[session_id]["current"] += 1

    # Crear ZIP
    zip_path = os.path.join(session_dir, "result.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in os.listdir(output_dir):
            zipf.write(
                os.path.join(output_dir, file),
                arcname=file
            )

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
            f"Máximo permitido: {MAX_IMAGES} imágenes ({MAX_IMAGES // 2} cartas)"
        )

    if len(files) % 2 != 0:
        raise HTTPException(
            400,
            "Debes subir un número par de imágenes (front/back)"
        )

    session_id = str(uuid.uuid4())
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    saved_files = []

    for idx, file in enumerate(files):
        path = os.path.join(session_dir, f"{idx}.jpg")
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        saved_files.append(path)

    progress[session_id] = {
        "current": 0,
        "total": 0,
        "running": True
    }

    background.add_task(process_images, session_id, saved_files)

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
