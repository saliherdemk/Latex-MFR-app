function setup() {
  const { w, h } = canvasManager.getCanvasDimensions();
  const cnv = createCanvas(w, h);
  cnv.parent("canvas-container");
  canvasManager.canvas = cnv;
  background(255);

  const canvas = document.querySelector("canvas");
  canvas.addEventListener("wheel", function (e) {
    mouseWheelCanvas(e);
    e.preventDefault();
  });
}

function mousePressed() {
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    canvasManager.drawingActive = true;
  }
}

function mouseReleased() {
  canvasManager.drawingActive = false;
}

function draw() {
  background(255);

  if (mouseIsPressed && mouseButton === LEFT && canvasManager.drawingActive) {
    canvasManager.setCurrentStroke(mouseX, mouseY, pmouseX, pmouseY);
  } else {
    canvasManager.addStroke();
  }

  push();
  translate(...canvasManager.getPan());
  scale(canvasManager.getZoom());
  canvasManager.draw();
  pop();
}

function mouseDragged() {
  if (mouseButton === CENTER) {
    const [px, py] = canvasManager.getPan();
    canvasManager.setPan(px + mouseX - pmouseX, py + mouseY - pmouseY);
  }
}

function mouseWheelCanvas(event) {
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  const [px, py] = canvasManager.getPan();

  const mx = event.offsetX;
  const my = event.offsetY;

  canvasManager.setPan(mx - (mx - px) * factor, my - (my - py) * factor);
  canvasManager.setZoom(factor);
}

function windowResized() {
  const { w, h } = canvasManager.getCanvasDimensions();
  resizeCanvas(w, h);
}
