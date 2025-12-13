let sessionId = null;
let currentProgress = 0;
let targetProgress = 0;

document.getElementById("startBtn").onclick = async () => {
  const files = document.getElementById("files").files;
  const log = document.getElementById("log");

  if (files.length === 0) {
    alert("Selecciona imágenes primero");
    return;
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  log.textContent = "Subiendo imágenes…";

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    alert(err);
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
    document.getElementById("log").textContent = "Proceso finalizado.";
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
