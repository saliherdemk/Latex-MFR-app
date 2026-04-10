class Manager {
  constructor() {
    this.canvasContainer = document.getElementById("canvas-container");
    this.imgContainer = document.getElementById("img-container");

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

  async convert() {
    const { invoke } = window.__TAURI__.core;
    let base64;
    if (this.canvasContainer.style.display !== "none") {
      base64 = canvasManager.getImageBase64();
    } else {
      base64 = await imageManager.getImageBase64();
    }
    if (!base64) return null;
    return invoke("save_temp_image", { base64Data: base64 });
  }
}
