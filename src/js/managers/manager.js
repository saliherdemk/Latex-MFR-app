class Manager {
  constructor() {
    this.canvasContainer = document.getElementById("canvas-container");
    this.imgContainer = document.getElementById("img-container");
    this.resultContainer = document.getElementById("result-container");
    this.latexInput = document.getElementById("latex-input");
    this.latexPreview = document.getElementById("latex-preview");
    this.convertSpinner = document.getElementById("convert-spinner");
    this.convertBtn = document.getElementById("convert-btn");
    this.copyBtn = document.getElementById("copy-btn");
    this.copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(this.latexInput.value);
    });

    this.showCanvas();
  }

  showCanvas() {
    if (typeof loop === "function") loop();
    this.canvasContainer.style.display = "block";
    this.imgContainer.style.display = "none";
    if (typeof windowResized === "function") windowResized();
  }

  showImage() {
    if (typeof noLoop === "function") noLoop();
    this.canvasContainer.style.display = "none";
    this.imgContainer.style.display = "flex";
  }

  showResult(latex) {
    this.latexInput.value = latex;
    this.resultContainer.classList.add("visible");
    try {
      katex.render(latex, this.latexPreview, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (e) {
      this.latexPreview.textContent = latex;
    }
  }

  async convert() {
    let base64;
    if (this.canvasContainer.style.display !== "none") {
      base64 = canvasManager.getImageBase64();
    } else {
      base64 = await imageManager.getImageBase64();
    }
    if (!base64) return;

    this.convertSpinner.classList.add("active");
    this.convertBtn.disabled = true;

    try {
      const modelId = modelManager.getSelectedId();

      if (modelId === "gemini") {
        const apiKey = modelManager.getGeminiApiKey();
        if (!apiKey) {
          alert("Please set a Gemini API key first.");
          return;
        }
        const result = await invoke("convert_gemini", { base64, apiKey });
        this.showResult(result);
        return;
      }

      const imagePath = await invoke("save_temp_image", { base64Data: base64 });
      const result = await invoke("convert", { imagePath });
      this.showResult(result);
    } finally {
      this.convertSpinner.classList.remove("active");
      this.convertBtn.disabled = false;
    }
  }
}
