import cv2
import os
import numpy as np
from PIL import Image
import time

INPUT_DIR = "input"
OUTPUT_DIR = "output"

progress_state = {
    "total": 0,
    "current": 0,
    "running": False
}

def is_back_card(image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    avg = np.mean(rgb.reshape(-1, 3), axis=0)
    r, g, b = avg
    return b > r * 1.15 and b > g * 1.15

def fixed_border_crop(image):
    h, w = image.shape[:2]
    border = int(min(h, w) * 0.025)
    return image[border:h-border, border:w-border]

def normalize_size(img, target_height=1000):
    h, w = img.shape[:2]
    scale = target_height / h
    return cv2.resize(img, (int(w * scale), target_height))

def combine_images(front, back):
    h = max(front.height, back.height)
    w = front.width + back.width
    img = Image.new("RGB", (w, h), (255, 255, 255))
    img.paste(front, (0, 0))
    img.paste(back, (front.width, 0))
    return img

def process_cards(clear_input=False):
    os.makedirs(INPUT_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    files = sorted([
        f for f in os.listdir(INPUT_DIR)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])

    if len(files) < 2 or len(files) % 2 != 0:
        progress_state["running"] = False
        return {"error": "La carpeta input debe contener un número par de imágenes."}

    total_cards = len(files) // 2
    progress_state.update({
        "total": total_cards,
        "current": 0,
        "running": True
    })

    results = []
    idx = 1

    for i in range(0, len(files), 2):
        img1 = cv2.imread(os.path.join(INPUT_DIR, files[i]))
        img2 = cv2.imread(os.path.join(INPUT_DIR, files[i+1]))

        if is_back_card(img1):
            back, front = img1, img2
        else:
            front, back = img1, img2

        front = normalize_size(fixed_border_crop(front))
        back  = normalize_size(fixed_border_crop(back))

        front_pil = Image.fromarray(cv2.cvtColor(front, cv2.COLOR_BGR2RGB))
        back_pil  = Image.fromarray(cv2.cvtColor(back, cv2.COLOR_BGR2RGB))

        combined = combine_images(front_pil, back_pil)

        name = f"card_{idx:03d}.png"
        combined.save(os.path.join(OUTPUT_DIR, name))
        results.append(name)

        idx += 1
        progress_state["current"] += 1

        time.sleep(0.1)  # Simula carga real, mejora UX

    if clear_input:
        for f in os.listdir(INPUT_DIR):
            os.remove(os.path.join(INPUT_DIR, f))

    progress_state["running"] = False
    return {"processed": results}

def get_progress():
    return progress_state
