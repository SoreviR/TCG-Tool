from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from core import process_cards, get_progress
import threading

app = FastAPI(title="TCG Image Tool")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")

@app.post("/process")
def process(clear_input: bool = False):
    thread = threading.Thread(
        target=process_cards,
        args=(clear_input,),
        daemon=True
    )
    thread.start()
    return {"status": "started"}

@app.get("/progress")
def progress():
    return JSONResponse(get_progress())
