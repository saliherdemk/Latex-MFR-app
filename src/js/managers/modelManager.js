class ModelManager {
  constructor() {
    this.select = getElementById("model-select");
    this.apiKeyBtn = getElementById("api-key-btn");
    this.pix2textModelBtn = getElementById("pix2text-model-btn");
    this.convertBtn = getElementById("convert-btn");

    this.modal = getElementById("api-key-modal");
    this.apiKeyInput = getElementById("api-key-input");

    this.downloadModal = getElementById("download-modal");
    this.downloadModalDesc = getElementById("download-modal-desc");
    this.downloadModalBtn = getElementById("download-modal-btn");
    this.downloadModalCancel = getElementById("download-modal-cancel");
    this.downloadModalProgress = getElementById("download-modal-progress");
    this.downloadModalBar = getElementById("download-modal-bar");
    this.downloadModalText = getElementById("download-modal-text");

    this.apiKeySaveBtn = getElementById("api-key-save-btn");
    this.apiKeyCloseBtn = getElementById("api-key-close-btn");

    this.pix2textStatus = "unknown";

    this._init();
  }

  async _init() {
    const options = [
      { value: "pix2text-mfr-1.5", label: "Pix2Text MFR 1.5" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
      { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
      {
        value: "gemini-3.1-flash-lite-preview",
        label: "Gemini 3.1 Flash Lite Preview",
      },
    ];

    for (const { value, label } of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      this.select.appendChild(option);
    }

    this.select.addEventListener("change", () => this._onSelectChange());

    this.apiKeyBtn.addEventListener("click", () => this._openModal());
    this.apiKeySaveBtn.addEventListener("click", () => this._saveApiKey());
    this.apiKeyCloseBtn.addEventListener("click", () => this._closeModal());
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this._closeModal();
    });

    this.pix2textModelBtn.addEventListener("click", () => {
      if (
        this.pix2textStatus === "downloaded" ||
        this.pix2textStatus === "ready"
      ) {
        this._deleteModel();
      } else {
        this._startDownload();
      }
    });

    this.downloadModalBtn.addEventListener("click", () =>
      this._startDownload(),
    );
    this.downloadModalCancel.addEventListener("click", () =>
      this._closeDownloadModal(),
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.modal.style.display !== "none") this._closeModal();
        if (this.downloadModal.style.display !== "none")
          this._closeDownloadModal();
      }
    });

    window.__TAURI__.event.listen("download-progress", (event) => {
      this._onDownloadProgress(event.payload);
    });

    if (localStorage.getItem("gemini_api_key")) {
      this.select.value = "gemini-2.5-flash";
    }

    const downloaded = await invoke("check_pix2text_downloaded");
    this.pix2textStatus = downloaded ? "downloaded" : "not-downloaded";

    this._onSelectChange();
  }

  _onSelectChange() {
    const isPix2Text = this.select.value === "pix2text-mfr-1.5";
    this.apiKeyBtn.style.display = this.select.value.startsWith("gemini")
      ? ""
      : "none";
    this.pix2textModelBtn.style.display = isPix2Text ? "" : "none";
    this._updatePix2TextUI();
  }

  _updatePix2TextUI() {
    if (this.select.value !== "pix2text-mfr-1.5") return;

    const hasModel =
      this.pix2textStatus === "downloaded" || this.pix2textStatus === "ready";
    this.pix2textModelBtn.textContent = hasModel
      ? "Delete Model"
      : "Download Model";
    this.pix2textModelBtn.classList.toggle("danger", hasModel);
    this.convertBtn.disabled = !hasModel;
  }

  async _startDownload() {
    this.downloadModalDesc.textContent = "Downloading...";
    this.downloadModalBtn.style.display = "none";
    this.downloadModalCancel.style.display = "none";
    this.downloadModalProgress.style.display = "flex";
    this.downloadModalBar.style.width = "0%";
    this.downloadModalText.textContent = "";
    this.downloadModal.style.display = "flex";

    try {
      await invoke("download_pix2text");
      this.pix2textStatus = "downloaded";
      this._closeDownloadModal();
      this._updatePix2TextUI();
    } catch (e) {
      this.downloadModalDesc.textContent = "Failed: " + e;
      this.downloadModalBtn.style.display = "";
      this.downloadModalBtn.textContent = "Retry";
      this.downloadModalCancel.style.display = "";
      this.downloadModalProgress.style.display = "none";
      this.pix2textStatus = "not-downloaded";
    }
  }

  async _deleteModel() {
    try {
      await invoke("delete_pix2text_model");
      this.pix2textStatus = "not-downloaded";
      this._updatePix2TextUI();
    } catch (e) {
      console.error("Failed to delete model:", e);
    }
  }

  _onDownloadProgress({ file, progress, downloaded, total, status }) {
    const label = file.includes("encoder")
      ? "encoder"
      : file.includes("decoder")
        ? "decoder"
        : "tokenizer";
    if (status === "connecting") {
      this.downloadModalText.textContent = `${label}: connecting...`;
      return;
    }
    if (total > 0) {
      this.downloadModalBar.style.width = progress + "%";
      const mb = (downloaded / 1024 / 1024).toFixed(1);
      const totalMb = (total / 1024 / 1024).toFixed(1);
      this.downloadModalText.textContent = `${label}: ${mb} / ${totalMb} MB`;
    } else {
      const mb = (downloaded / 1024 / 1024).toFixed(1);
      this.downloadModalText.textContent = `${label}: ${mb} MB`;
    }
  }

  _closeDownloadModal() {
    this.downloadModal.style.display = "none";
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

  isPix2TextReady() {
    return (
      this.pix2textStatus === "downloaded" || this.pix2textStatus === "ready"
    );
  }

  async ensureLoaded() {
    if (this.pix2textStatus === "ready") return;
    await invoke("load_pix2text_model");
    this.pix2textStatus = "ready";
  }
}
