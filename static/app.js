let progressInterval = null;

async function startProcess() {
  const clear = document.getElementById("clear").checked;
  const log = document.getElementById("log");
  const btn = document.getElementById("startBtn");

  btn.disabled = true;
  log.textContent = "Procesando...\n";

  await fetch(`/process?clear_input=${clear}`, { method: "POST" });

  progressInterval = setInterval(updateProgress, 500);
}

async function updateProgress() {
  const res = await fetch("/progress");
  const data = await res.json();

  if (!data.running && data.total > 0) {
    document.getElementById("progress").value = 100;
    document.getElementById("percent").textContent = "100%";
    clearInterval(progressInterval);
    document.getElementById("startBtn").disabled = false;
    return;
  }

  if (data.total > 0) {
    const pct = Math.round((data.current / data.total) * 100);
    document.getElementById("progress").value = pct;
    document.getElementById("percent").textContent = pct + "%";
  }
}
