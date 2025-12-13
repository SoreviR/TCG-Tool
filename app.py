from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
import os
import uuid
import shutil
import threading

from core import process_images

BASE_SESSIONS_DIR = "sessions"
os.makedirs(BASE_SESSIONS_DIR, exist_ok=True)

app = FastAPI(title="TCG Web Tool")

# Progreso por sesión
sessions_progress = {}

@app.post("/upload")
def upload_images(files: list[UploadFile] = File(...)):
    session_id = str(uuid.uuid4())

    session_dir = os.path.join(BASE_SESSIONS_DIR, session_id)
    input_dir = os.path.join(session_dir, "input")
    output_dir = os.path.join(session_dir, "output")

    os.makedirs(input_dir)
    os.makedirs(output_dir)

    for i, file in enumerate(files):
        ext = os.path.splitext(file.filename)[1]
        filename = f"{i:03d}{ext}"
        with open(os.path.join(input_dir, filename), "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    sessions_progress[session_id] = {
        "total": 0,
        "current": 0,
        "running": False
    }

    thread = threading.Thread(
        target=process_images,
        args=(input_dir, output_dir, sessions_progress[session_id]),
        daemon=True
    )
    thread.start()

    return {"session_id": session_id}

@app.get("/progress/{session_id}")
def get_progress(session_id: str):
    if session_id not in sessions_progress:
        return JSONResponse({"error": "Sesión no encontrada"}, status_code=404)

    return sessions_progress[session_id]

@app.get("/download/{session_id}")
def download_results(session_id: str):
    output_dir = os.path.join(BASE_SESSIONS_DIR, session_id, "output")

    if not os.path.exists(output_dir):
        return JSONResponse({"error": "Resultados no disponibles"}, status_code=404)

    zip_path = os.path.join(BASE_SESSIONS_DIR, f"{session_id}.zip")

    shutil.make_archive(zip_path.replace(".zip", ""), "zip", output_dir)

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="tcg_cards.zip"
    )

# --------------------------------------------------------------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")

# ---------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000
    )
