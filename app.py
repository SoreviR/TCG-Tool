from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import shutil
import uuid
import zipfile
import cv2
import numpy as np

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

BASE_SESSIONS = "sessions"
os.makedirs(BASE_SESSIONS, exist_ok=True)

progress_state = {}


@app.get("/", response_class=HTMLResponse)
def index():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()


# ---------- IMAGE UTILITIES ----------

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
    print(f"[Front Detection] img1={s1:.1f} | img2={s2:.1f}")
    return (img1, img2) if s1 >= s2 else (img2, img1)


def find_card_bbox(img):
    """
    Detects the card contour and returns bounding box
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)
    return x, y, w, h


def crop_with_margin(img, bbox):
    x, y, w, h = bbox
    h_img, w_img = img.shape[:2]

    margin = int(min(w, h) * 0.03)  # ≈5mm visual

    x1 = max(x - margin, 0)
    y1 = max(y - margin, 0)
    x2 = min(x + w + margin, w_img)
    y2 = min(y + h + margin, h_img)

    return img[y1:y2, x1:x2]


def combine_images(front, back):
    h = max(front.shape[0], back.shape[0])

    def pad(img):
        return cv2.copyMakeBorder(
            img, 0, h - img.shape[0], 0, 0,
            cv2.BORDER_CONSTANT, value=[0, 0, 0]
        )

    return np.hstack((pad(front), pad(back)))


# ---------- API ----------

@app.post("/process")
async def process(files: list[UploadFile] = File(...)):
    session_id = str(uuid.uuid4())
    session_dir = os.path.join(BASE_SESSIONS, session_id)
    os.makedirs(session_dir, exist_ok=True)

    total_pairs = len(files) // 2
    progress_state[session_id] = {
        "current": 0,
        "total": total_pairs,
        "done": False
    }

    image_paths = []

    for i, file in enumerate(files):
        path = os.path.join(session_dir, f"{i}.jpg")
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        image_paths.append(path)

    outputs = []

    for i in range(0, len(image_paths), 2):
        img1 = cv2.imread(image_paths[i])
        img2 = cv2.imread(image_paths[i + 1])

        front, back = detect_front_back(img1, img2)

        bbox = find_card_bbox(front)
        if bbox:
            front = crop_with_margin(front, bbox)
            back = crop_with_margin(back, bbox)

        combined = combine_images(front, back)

        out_path = os.path.join(session_dir, f"card_{i // 2 + 1}.jpg")
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
