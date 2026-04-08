class DrawnLine {
  constructor(x, y, px, py) {
    this.px = px;
    this.py = py;
    this.x = x;
    this.y = y;
    this.color = "#000000";
    this.weight = 3;
  }

  show() {
    stroke(this.color);
    strokeWeight(this.weight);
    line(this.px, this.py, this.x, this.y);
  }
}
