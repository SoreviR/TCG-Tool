let sessionId = null;
let interval = null;

document.getElementById("startBtn").onclick = async () => {
  const filesInput = document.getElementById("files");
  const files = filesInput.files;
  const log = document.getElementById("log");

  if (files.length === 0) {
    alert("Selecciona imágenes primero");
    return;
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  log.textContent = "Subiendo imágenes...\n";

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  sessionId = data.session_id;

  log.textContent += "Procesando...\n";

  interval = setInterval(updateProgress, 500);
};

async function updateProgress() {
  const res = await fetch(`/progress/${sessionId}`);
  const data = await res.json();

  if (data.total > 0) {
    const pct = Math.round((data.current / data.total) * 100);
    document.getElementById("progress").value = pct;
    document.getElementById("percent").textContent = pct + "%";
  }

  if (!data.running && data.total > 0) {
    clearInterval(interval);
    document.getElementById("progress").value = 100;
    document.getElementById("percent").textContent = "100%";

    const link = document.getElementById("download");
    link.href = `/download/${sessionId}`;
    link.style.display = "block";
    link.textContent = "Descargar resultados (ZIP)";
  }
}
