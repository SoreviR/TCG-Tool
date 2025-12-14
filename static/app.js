let filesList = [];
let sessionId = null;
let currentProgress = 0;
let targetProgress = 0;

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("files");
const preview = document.getElementById("preview");
const log = document.getElementById("log");
const tcgSelect = document.getElementById("tcg");

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
});

function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    filesList.push(file);
  }
  renderPreview();
}

function renderPreview() {
  preview.innerHTML = "";
  filesList.forEach((file, idx) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.title = idx % 2 === 0 ? "Front (detectado)" : "Back (detectado)";
    preview.appendChild(img);
  });

  log.textContent = `${filesList.length} imágenes seleccionadas · Perfil: ${tcgSelect.value}`;
}

document.getElementById("startBtn").onclick = async () => {
  if (filesList.length === 0) {
    alert("Selecciona imágenes primero");
    return;
  }

  const formData = new FormData();
  filesList.forEach((f) => formData.append("files", f));

  // Guardamos perfil elegido (futuro uso backend)
  formData.append("tcg_profile", tcgSelect.value);

  log.textContent = "Subiendo imágenes…";

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    alert(await res.text());
    return;
  }

  const data = await res.json();
  sessionId = data.session_id;

  log.textContent = "Procesando cartas…";
  pollProgress();
  requestAnimationFrame(animateProgress);
};

async function pollProgress() {
  if (!sessionId) return;

  const res = await fetch(`/progress/${sessionId}`);
  const data = await res.json();

  if (data.total > 0) {
    targetProgress = Math.round((data.current / data.total) * 100);
  }

  if (data.running) {
    setTimeout(pollProgress, 500);
  } else {
    targetProgress = 100;
    document.getElementById("download").href = `/download/${sessionId}`;
    document.getElementById("download").style.display = "block";
    log.textContent = "Proceso finalizado.";
  }
}

function animateProgress() {
  if (currentProgress < targetProgress) {
    currentProgress += 1;
    document.getElementById("progressFill").style.width = currentProgress + "%";
    document.getElementById("progressText").textContent = currentProgress + "%";
  }
  requestAnimationFrame(animateProgress);
}
