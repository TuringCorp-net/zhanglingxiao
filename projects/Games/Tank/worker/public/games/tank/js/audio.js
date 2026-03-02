/**
 * audio.js — 基于 Web Audio API 的程序化音效系统
 * 
 * 所有音效通过振荡器/噪声实时合成，无需加载任何外部音频文件。
 * 支持：炮弹发射、爆炸、导弹、火焰、拾取、坦克爆炸/Boss爆炸、引擎声等。
 */

export class Audio {
    constructor() {
        /** @type {AudioContext|null} */
        this.ctx = null;
        this.masterGain = null;
        this.muted = false;
        this._initialized = false;
    }

    /**
     * 延迟初始化 — 必须在用户交互后调用（浏览器自动播放策略）
     */
    init() {
        if (this._initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this._initialized = true;
        } catch (e) {
            console.warn('Web Audio API 不可用:', e);
        }
    }

    /** 切换静音 */
    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 0.3;
        }
        return this.muted;
    }

    /* ========== 内部工具方法 ========== */

    /** 创建连接到 masterGain 的增益节点 */
    _gain(volume = 1) {
        if (!this.ctx) return null;
        const g = this.ctx.createGain();
        g.gain.value = volume;
        g.connect(this.masterGain);
        return g;
    }

    /** 创建白噪声缓冲区 */
    _noiseBuffer(duration = 0.5) {
        const sr = this.ctx.sampleRate;
        const len = sr * duration;
        const buf = this.ctx.createBuffer(1, len, sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    /* ========== 音效方法 ========== */

    /** 炮弹发射 — 短促低频"咚" */
    playShellFire() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const g = this._gain(0.5);

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.2);

        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    }

    /** 爆炸 — 白噪声 + 低频震荡 */
    playExplosion(big = false) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const dur = big ? 0.6 : 0.35;
        const vol = big ? 0.7 : 0.4;

        // 噪声
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = this._noiseBuffer(dur);
        const noiseG = this._gain(vol);
        noiseG.gain.exponentialRampToValueAtTime(0.01, t + dur);
        noiseSrc.connect(noiseG);
        noiseSrc.start(t);

        // 低频震荡
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(big ? 60 : 80, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + dur);
        const oscG = this._gain(vol * 0.6);
        oscG.gain.exponentialRampToValueAtTime(0.01, t + dur);
        osc.connect(oscG);
        osc.start(t);
        osc.stop(t + dur);
    }

    /** 导弹发射 — 上升音调嘶嘶声 */
    playMissileLaunch() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const g = this._gain(0.3);

        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.4);

        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    }

    /** 火焰喷射 — 持续噪声（需要手动停止） */
    playFlameLoop() {
        if (!this.ctx || this.muted) return null;
        const g = this._gain(0.15);

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = this._noiseBuffer(2);
        noiseSrc.loop = true;

        // 带通滤波，模拟火焰嘶嘶
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        noiseSrc.connect(filter);
        filter.connect(g);
        noiseSrc.start();

        return {
            source: noiseSrc, gain: g, stop: () => {
                try { noiseSrc.stop(); } catch (_) { /* 已停 */ }
            }
        };
    }

    /** 拾取医疗箱 — 清脆上升音 */
    playPickup() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const g = this._gain(0.3);

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.2);

        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    }

    /** 受伤 — 嗡嗡低频 */
    playHurt() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        const g = this._gain(0.25);

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.25);

        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    }

    /** Boss 警报 — 双音交替 */
    playWarning() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;

        for (let i = 0; i < 4; i++) {
            const offset = i * 0.3;
            const freq = i % 2 === 0 ? 600 : 400;
            const g = this._gain(0.2);
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            osc.connect(g);
            osc.start(t + offset);
            osc.stop(t + offset + 0.15);
            g.gain.setValueAtTime(0.2, t + offset);
            g.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.15);
        }
    }
}
