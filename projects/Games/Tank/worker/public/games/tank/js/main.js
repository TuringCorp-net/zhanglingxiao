import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Game } from './game.js';

function start() {
    try {
        const canvas = document.getElementById('game');
        if (!canvas) throw new Error('Canvas not found');
        
        const renderer = new Renderer(canvas);
        const input = new Input();
        const game = new Game(renderer, input);

        window.addEventListener('resize', () => renderer.resize());
        renderer.resize();

        game.init();
        game.startLoop();
        console.log('Game started successfully');
    } catch (e) {
        console.error('Game initialization failed:', e);
        document.body.innerHTML += `<div style="color:red; position:absolute; top:0; z-index:999; background:black; padding:20px;">Game Error: ${e.message}</div>`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}
