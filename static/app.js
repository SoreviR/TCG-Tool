document.addEventListener("DOMContentLoaded", () => {
  let files = [];
  let sessionId = null;

  const dict = {
    es: {
      title: "Procesador de Cartas TCG",
      desc: "Sube imágenes en pares (front/back). Se recortará un marco de 5mm.",
      drop: "Arrastra imágenes o haz click aquí",
      process: "Procesar",
      download: "Descargar",
      feedback: "Feedback",
      feedbackTitle: "Tu opinión nos ayuda",
      feedbackSend: "Enviar",
    },
    en: {
      title: "TCG Image Processor",
      desc: "Upload images in pairs (front/back). A 5mm border will be cropped.",
      drop: "Drag & drop images or click here",
      process: "Process",
      download: "Download",
      feedback: "Feedback",
      feedbackTitle: "Your feedback helps us",
      feedbackSend: "Send",
    },
  };

  let lang = localStorage.getItem("lang") || "es";
  let theme = localStorage.getItem("theme") || "dark";

  const navbar = document.getElementById("navbar");
  const langBtn = document.getElementById("langBtn");
  const themeBtn = document.getElementById("themeBtn");

  function applyLang() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = dict[lang][el.dataset.i18n];
    });
    langBtn.textContent = lang.toUpperCase();
  }

  function applyTheme() {
    document.body.classList.toggle("light", theme === "light");
    themeBtn.textContent = theme === "light" ? "🌙" : "☀️";
  }

  applyLang();
  applyTheme();

  // ---------- MENU ----------
  document.getElementById("menuToggle").onclick = () => {
    const isOpen = navbar.classList.toggle("open");
    document.getElementById("menuToggle").classList.toggle("open", isOpen);
  };

  langBtn.onclick = () => {
    lang = lang === "es" ? "en" : "es";
    localStorage.setItem("lang", lang);
    applyLang();
  };

  themeBtn.onclick = () => {
    theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", theme);
    applyTheme();
  };

  // ---------- FILES ----------
  const dropzone = document.getElementById("dropzone");
  const input = document.getElementById("files");
  const preview = document.getElementById("preview");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const download = document.getElementById("download");
  const resetBtn = document.getElementById("resetBtn");

  dropzone.onclick = () => input.click();
  dropzone.ondragover = (e) => e.preventDefault();

  dropzone.ondrop = (e) => {
    e.preventDefault();
    files.push(...e.dataTransfer.files);
    renderPreview();
  };

  input.onchange = () => {
    files.push(...input.files);
    renderPreview();
  };

  function renderPreview() {
    preview.innerHTML = "";
    files.forEach((f) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      preview.appendChild(img);
    });
  }

  document.getElementById("processBtn").onclick = async () => {
    if (files.length === 0) return;

    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));

    const res = await fetch("/process", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    sessionId = data.session_id;
    pollProgress();
  };

  resetBtn.onclick = () => {
    files = [];
    sessionId = null;
    preview.innerHTML = "";
    input.value = "";
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
    download.style.display = "none";
  };

  async function pollProgress() {
    if (!sessionId) return;

    const res = await fetch(`/progress/${sessionId}`);
    const data = await res.json();

    progressBar.style.width = data.progress + "%";
    progressText.textContent = data.progress + "%";

    if (!data.done) {
      setTimeout(pollProgress, 500);
    } else {
      download.href = `/download/${sessionId}`;
      download.style.display = "block";
    }
  }

  // ---------- FEEDBACK ----------

  const feedbackBtn = document.getElementById("feedbackBtn");
  const feedbackModal = document.getElementById("feedbackModal");
  const closeFeedback = document.getElementById("closeFeedback");
  const feedbackForm = document.getElementById("feedbackForm");

  feedbackBtn.onclick = () => {
    feedbackModal.classList.add("open");
  };

  closeFeedback.onclick = () => {
    feedbackModal.classList.remove("open");
  };

  feedbackModal.onclick = (e) => {
    if (e.target === feedbackModal) {
      feedbackModal.classList.remove("open");
    }
  };

  feedbackForm.onsubmit = async (e) => {
    e.preventDefault();

    const payload = {
      category: feedbackForm.category.value,
      name: feedbackForm.name.value || null,
      email: feedbackForm.email.value || null,
      message: feedbackForm.message.value,
    };

    const res = await fetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert("Feedback enviado. ¡Gracias!");
      feedbackForm.reset();
      feedbackModal.classList.remove("open");
    } else {
      alert("Error al enviar feedback");
    }
  };
});
