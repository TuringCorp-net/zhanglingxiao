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

    let aim = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) aim = -1;  // 仰角（抬头）
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) aim = 1;  // 俯角（低头）

    return {
      move,
      aim,        // 新增：仰角控制
      fire: this.isDown('Space') || this.isDown('Enter')
    };
  }
}
