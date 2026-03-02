export class Input {
  constructor() {
    this.keys = new Set();
    this.init();
  }

  init() {
    window.addEventListener('keydown', e => this.keys.add(e.code));
    window.addEventListener('keyup', e => this.keys.delete(e.code));
  }

  isDown(code) {
    return this.keys.has(code);
  }

  getControl() {
    let move = 0;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) move = 1;
    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) move = -1;
    
    return {
      move,
      fire: this.isDown('Space') || this.isDown('Enter')
    };
  }
}
