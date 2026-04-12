class Manager {
  constructor() {
    this.canvasContainer = getElementById("canvas-container");
    this.imgContainer = getElementById("img-container");
    this.resultContainer = getElementById("result-container");
    this.errorMessage = getElementById("error-message");
    this.latexInput = getElementById("latex-input");
    this.latexPreview = getElementById("latex-preview");
    this.convertSpinner = getElementById("convert-spinner");
    this.convertBtn = getElementById("convert-btn");
    this.copyBtn = getElementById("copy-btn");

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

  showError(msg) {
    this.errorMessage.textContent = msg;
    this.errorMessage.style.display = "block";
    this.resultContainer.classList.remove("visible");
  }

  showResult(latex) {
    this.errorMessage.style.display = "none";
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
    await new Promise((r) => setTimeout(r, 0));

    try {
      const modelId = modelManager.getSelectedId();

      if (modelId.startsWith("gemini")) {
        const apiKey = modelManager.getGeminiApiKey();
        if (!apiKey) {
          this.showError("Please set a Gemini API key first.");
          return;
        }
        try {
          const result = await invoke("convert_gemini", {
            base64,
            apiKey,
            model: modelId,
          });
          this.showResult(result);
        } catch (e) {
          this.showError(String(e));
        }
        return;
      }

      await modelManager.ensureLoaded();
      const imagePath = await invoke("save_temp_image", { base64Data: base64 });
      const result = await invoke("convert", { imagePath });
      this.showResult(result);
    } finally {
      this.convertSpinner.classList.remove("active");
      this.convertBtn.disabled = false;
    }
  }
}
