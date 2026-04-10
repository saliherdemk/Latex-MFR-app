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
}
