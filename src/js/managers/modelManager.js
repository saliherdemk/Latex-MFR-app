class ModelManager {
  constructor() {
    this.select = document.getElementById("model-select");
    this.apiKeyBtn = document.getElementById("api-key-btn");
    this.modal = document.getElementById("api-key-modal");
    this.apiKeyInput = document.getElementById("api-key-input");
    this._init();
  }

  _init() {
    const options = [
      { value: "pix2text-mfr-1.5", label: "Pix2Text MFR 1.5" },
      { value: "gemini", label: "Gemini 2.5 Flash" },
    ];

    for (const { value, label } of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      this.select.appendChild(option);
    }

    this.select.addEventListener("change", () => this._onSelectChange());
    this._onSelectChange();

    this.apiKeyBtn.addEventListener("click", () => this._openModal());

    document
      .getElementById("api-key-save-btn")
      .addEventListener("click", () => this._saveApiKey());
    document
      .getElementById("api-key-close-btn")
      .addEventListener("click", () => this._closeModal());
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this._closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modal.style.display !== "none")
        this._closeModal();
    });
  }

  _onSelectChange() {
    this.apiKeyBtn.style.display =
      this.select.value === "gemini" ? "" : "none";
  }

  _openModal() {
    this.apiKeyInput.value = localStorage.getItem("gemini_api_key") || "";
    this.modal.style.display = "flex";
    this.apiKeyInput.focus();
  }

  _closeModal() {
    this.modal.style.display = "none";
  }

  _saveApiKey() {
    const key = this.apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem("gemini_api_key", key);
    } else {
      localStorage.removeItem("gemini_api_key");
    }
    this._closeModal();
  }

  getSelectedId() {
    return this.select.value;
  }

  getGeminiApiKey() {
    return localStorage.getItem("gemini_api_key");
  }
}
