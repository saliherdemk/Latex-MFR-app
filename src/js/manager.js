class Manager {
  constructor() {
    this.canvasShown = true;

    this.canvas = null;

    this.canvasContainer = document.getElementById("canvas-container");
    this.imgContainer = document.getElementById("img-container");

    this.strokes = [];
    this.currentStroke = null;
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;

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

  setPan(x, y) {
    this.panX = x;
    this.panY = y;
  }

  setZoom(factor) {
    this.zoom *= factor;
  }

  getPan() {
    return [this.panX, this.panY];
  }

  getZoom() {
    return this.zoom;
  }

  setCurrentStroke(mx, my, pmx, pmy) {
    if (!this.currentStroke) this.currentStroke = [];
    const { x, y, px, py } = this.worldCoords(mx, my, pmx, pmy);
    this.currentStroke.push(new DrawnLine(x, y, px, py));
  }

  addStroke() {
    if (!this.currentStroke) return;
    this.strokes.push(this.currentStroke);
    this.currentStroke = null;
  }

  worldCoords(mx, my, pmx, pmy) {
    return {
      x: (mx - this.panX) / this.zoom,
      y: (my - this.panY) / this.zoom,
      px: (pmx - this.panX) / this.zoom,
      py: (pmy - this.panY) / this.zoom,
    };
  }

  undo() {
    this.strokes.pop();
  }

  getCanvasDimensions() {
    const w = this.canvasContainer.offsetWidth;
    const h = this.canvasContainer.offsetHeight;
    return { w, h };
  }

  draw() {
    for (const stroke of this.strokes) {
      for (const segment of stroke) segment.show();
    }
    if (this.currentStroke) {
      for (const segment of this.currentStroke) segment.show();
    }
  }
}
