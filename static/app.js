// const { version } = require("react");

document.addEventListener("DOMContentLoaded", () => {
  let files = [];
  let sessionId = null;

  const dict = {
    es: {
      title: "Crea imágenes de cartas TCG listas para el marketplace",
      desc: "Combina imágenes de cartas (frontal y reverso) en una sola imagen limpia para listar.",
      drop: "Arrastra y suelta imágenes (frontal y reverso) en pares, o haz clic para seleccionar archivos",
      order:
        "Sube las imágenes en pares: frontal + reverso. El orden no importa.",
      process: "Procesar",
      download: "Descargar",
      reset: "Reiniciar",
      roadmapTitle: "Hoja de ruta",
      roadmapIntro:
        "Este proyecto está en evolución activa. Esto es lo que está planeado.",
      roadmapNow: "Ahora",
      roadmapNow1: "Procesamiento por lotes",
      roadmapNow2: "Detección automática de frontal/reverso",
      roadmapNow3: "Recorte y alineación consistentes",
      roadmapNext: "Próximamente",
      roadmapNext1: "Preajustes de salida para marketplaces específicos",
      roadmapNext2: "Rotación manual y correcciones rápidas",
      roadmapNext3: "Mejor experiencia móvil",
      roadmapLater: "Más adelante",
      roadmapLater1: "Cuentas de usuario y preferencias guardadas",
      roadmapLater2: "Subida masiva en ZIP",
      roadmapLater3: "Normalización avanzada de imágenes",
      roadmapFeedback:
        "¿Tienes una idea? Usa el botón de feedback para ayudar a dar forma a la hoja de ruta.",
      sideTitle: "¿Por qué esta herramienta?",
      sideIntro:
        "La mayoría de los marketplaces permiten solo una imagen por carta. Esta herramienta te ayuda a mostrar ambos lados en una sola imagen limpia.",
      sideStep1: "Sube imágenes de las cartas (frontal y reverso).",
      sideStep2:
        "Las imágenes se recortan y alinean automáticamente de manera consistente.",
      sideStep3: "Descarga imágenes listas para subir.",
      sideNote:
        "Creada por un vendedor, para vendedores. Enfocada en la velocidad y la consistencia.",
      feedback: "Feedback",
      feedbackTitle: "Tu feedback ayuda a mejorar la herramienta",
      feedbackSend: "Enviar",
      beta: "Beta · En desarrollo",
      footerText:
        "Si esta herramienta te ahorra tiempo, considera apoyar su desarrollo.",
      supProject: "Apoya el proyecto",
    },
    en: {
      title: "Create marketplace-ready TCG card images",
      desc: "Combine front and back card images into a single clean listing image.",
      drop: "Drag & drop front & back images (pairs), or click to select files",
      order: "Upload images in pairs: front + back. Order doesn’t matter.",
      process: "Process",
      reset: "Reset",
      download: "Download",
      roadmapTitle: "Roadmap",
      roadmapIntro: "This project is actively evolving. Here’s what’s planned.",
      roadmapNow: "Now",
      roadmapNow1: "Batch image processing",
      roadmapNow2: "Automatic front/back detection",
      roadmapNow3: "Consistent crop and alignment",
      roadmapNext: "Next",
      roadmapNext1: "Output presets for specific marketplaces",
      roadmapNext2: "Manual rotation and quick fixes",
      roadmapNext3: "Better mobile experience",
      roadmapLater: "Later",
      roadmapLater1: "User accounts and saved preferences",
      roadmapLater2: "Bulk ZIP upload",
      roadmapLater3: "Advanced image normalization",
      roadmapFeedback:
        "Have an idea? Use the feedback button to help shape the roadmap.",
      sideTitle: "Why this tool?",
      sideIntro:
        "Most marketplaces allow only one image per card. This tool helps you show both sides in a single, clean image.",
      sideStep1: "Upload front and back card images (order doesn’t matter)",
      sideStep2: "Images are auto-cropped and aligned consistently",
      sideStep3: "Download ready-to-upload listing images",
      sideNote:
        "Built by a seller, for sellers. Focused on speed and consistency.",
      feedback: "Feedback",
      feedbackTitle: "Your feedback helps improve the tool",
      feedbackCategory: "Select category",
      category1: "Bug",
      category2: "Idea / Feature",
      category3: "General",
      feedbackSend: "Send",
      beta: "Beta · In development",
      footerText:
        "If this tool saves you time, consider supporting its development.",
      supProject: "Support the project",
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
