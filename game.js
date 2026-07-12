// 1. 湲곕낯 ?ㅼ젙
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startHint = document.getElementById('startHint');
const jumpButton = document.getElementById('jumpButton');
const attackButton = document.getElementById('attackButton');

const assetPath = (fileName) => `assets/${fileName}`;

function imageReady(image) {
    return image.complete && image.naturalWidth > 0;
}

let audioContext = null;
let ambientNodes = null;

function getAudioContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

function playTone(frequency, duration, options = {}) {
    const audio = getAudioContext();
    if (!audio) return;

    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
}

function playNoise(duration, options = {}) {
    const audio = getAudioContext();
    if (!audio) return;

    const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = buffer;
    filter.type = options.filterType || 'bandpass';
    filter.frequency.value = options.frequency || 800;
    filter.Q.value = options.q || 0.8;
    gain.gain.setValueAtTime(options.volume || 0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    source.start();
}

function startAmbientSound() {
    const audio = getAudioContext();
    if (!audio || ambientNodes) return;

    const master = audio.createGain();
    master.gain.value = 0.055;
    master.connect(audio.destination);

    const drone = audio.createOscillator();
    const droneGain = audio.createGain();
    drone.type = 'triangle';
    drone.frequency.value = 92;
    droneGain.gain.value = 0.16;
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();

    const chirpInterval = setInterval(() => {
        if (!audioContext || gameMode === 'gameOver' || gameMode === 'victory') return;
        const base = 950 + Math.random() * 700;
        playTone(base, 0.08, { endFrequency: base * 1.45, type: 'sine', volume: 0.035 });
        if (Math.random() > 0.55) {
            setTimeout(() => playTone(base * 0.82, 0.07, { endFrequency: base * 1.18, volume: 0.03 }), 90);
        }
    }, 1400);

    const rustleInterval = setInterval(() => {
        if (!audioContext || gameMode === 'gameOver' || gameMode === 'victory') return;
        playNoise(0.24, { frequency: 1200 + Math.random() * 900, q: 0.5, volume: 0.025 });
    }, 2200);

    const beatInterval = setInterval(() => {
        if (!audioContext || gameMode === 'gameOver' || gameMode === 'victory') return;
        playNoise(0.08, { frequency: gameMode === 'boss' ? 150 : 95, filterType: 'lowpass', volume: gameMode === 'boss' ? 0.12 : 0.075 });
        setTimeout(() => playTone(gameMode === 'boss' ? 220 : 180, 0.06, { endFrequency: 120, type: 'triangle', volume: 0.035 }), 180);
    }, 520);

    ambientNodes = { master, drone, chirpInterval, rustleInterval, beatInterval };
}

function stopAmbientSound() {
    if (!ambientNodes) return;
    clearInterval(ambientNodes.chirpInterval);
    clearInterval(ambientNodes.rustleInterval);
    clearInterval(ambientNodes.beatInterval);
    ambientNodes.drone.stop();
    ambientNodes.master.disconnect();
    ambientNodes = null;
}

const soundEffects = {
    jump() {
        playTone(260, 0.16, { endFrequency: 620, type: 'triangle', volume: 0.14 });
        playNoise(0.08, { frequency: 1800, volume: 0.025 });
    },
    hit() {
        playNoise(0.22, { frequency: 180, filterType: 'lowpass', q: 1.2, volume: 0.22 });
        playTone(140, 0.18, { endFrequency: 72, type: 'sawtooth', volume: 0.12 });
    },
    bossHit() {
        playTone(180, 0.1, { endFrequency: 90, type: 'square', volume: 0.12 });
        playTone(320, 0.08, { endFrequency: 150, type: 'sawtooth', volume: 0.08 });
    },
    playerHit() {
        playNoise(0.16, { frequency: 340, filterType: 'lowpass', volume: 0.18 });
        playTone(220, 0.2, { endFrequency: 80, type: 'triangle', volume: 0.12 });
    },
    shoot() {
        playTone(520, 0.09, { endFrequency: 740, type: 'square', volume: 0.055 });
    },
    collect() {
        playTone(740, 0.08, { endFrequency: 980, type: 'triangle', volume: 0.09 });
        setTimeout(() => playTone(1175, 0.09, { type: 'sine', volume: 0.07 }), 70);
    },
    powerup() {
        [392, 523, 659].forEach((note, index) => {
            setTimeout(() => playTone(note, 0.15, { endFrequency: note * 1.08, type: 'triangle', volume: 0.09 }), index * 80);
        });
    },
    victory() {
        [0, 120, 240, 380].forEach((delay, index) => {
            setTimeout(() => playTone([392, 523, 659, 784][index], 0.24, { type: 'triangle', volume: 0.12 }), delay);
        });
    }
};

function playSound(soundName) {
    if (soundEffects[soundName]) {
        soundEffects[soundName]();
        return;
    }

    try {
        soundName.currentTime = 0;
        const result = soundName.play();
        if (result && typeof result.catch === 'function') {
            result.catch(() => {
                // Missing files or browser autoplay rules should not stop gameplay.
            });
        }
    } catch (error) {
        // Some mobile browsers throw synchronously for unsupported or missing audio.
    }
}

// 罹붾쾭???ш린瑜??붾㈃??留욊쾶 議곗젅
function resizeCanvas() {
    const controlsHeight = window.matchMedia('(pointer: coarse)').matches ? 96 : 0;
    const titleHeight = 96;
    canvas.width = Math.floor(Math.min(window.innerWidth - 24, 800));
    canvas.height = Math.floor(Math.min(window.innerHeight - titleHeight - controlsHeight, 400));
    canvas.height = Math.max(canvas.height, 260);
}

resizeCanvas();

// Game assets.
const bananaImage = new Image();
bananaImage.src = assetPath('banana_run.svg');
const rockImage = new Image();
rockImage.src = assetPath('rock.svg');
const birdImage = new Image();
birdImage.src = assetPath('bird.svg');
const bossImage = new Image();
bossImage.src = assetPath('boss.svg');
const peelImage = new Image();
peelImage.src = assetPath('banana_peel.svg');
const bossProjectileImage = new Image();
bossProjectileImage.src = assetPath('boss_projectile.svg');

const backgroundMusic = new Audio(assetPath('background_music.mp3'));
const jumpSound = new Audio(assetPath('jump.wav'));
const hitSound = new Audio(assetPath('hit.wav'));
const bossHitSound = new Audio(assetPath('boss_hit.wav'));
const victoryMusic = new Audio(assetPath('victory.mp3'));
const playerHitSound = new Audio(assetPath('player_hit.wav'));
backgroundMusic.loop = true;

// 2. Game variables.

// 2. 寃뚯엫 蹂???뺤쓽
const gravity = 0.5;
const baseGameSpeed = 3.4;
const maxGameSpeed = 9;
let gameSpeed = baseGameSpeed;
let score = 0;
let gameMode = 'running'; // 'running', 'boss'
let boss = null; // 蹂댁뒪 媛앹껜
const BOSS_SPAWN_SCORE = 500; // 蹂댁뒪 ?깆옣 ?먯닔
let combo = 0;
let comboTimer = 0;
let weaponEnergy = 0;
let rapidFireTimer = 0;
let shieldTimer = 0;

function drawJungleBackground() {
    const scroll = isGameStarted ? score * 1.8 : 0;
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#2d6a4f');
    sky.addColorStop(0.58, '#1b4332');
    sky.addColorStop(1, '#081c15');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 214, 102, 0.16)';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.82, 58, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(9, 43, 28, 0.78)';
    const canopyOffset = -(scroll * 0.18) % 96;
    for (let x = canopyOffset - 96; x < canvas.width + 80; x += 96) {
        ctx.beginPath();
        ctx.ellipse(x + 20, canvas.height - 112, 74, 42, -0.25, 0, Math.PI * 2);
        ctx.ellipse(x + 72, canvas.height - 126, 86, 50, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(6, 31, 21, 0.7)';
    const treeOffset = -(scroll * 0.36) % 142;
    for (let x = treeOffset; x < canvas.width + 142; x += 142) {
        ctx.fillRect(x, canvas.height - 165, 18, 120);
        ctx.beginPath();
        ctx.ellipse(x + 8, canvas.height - 170, 54, 34, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#5b3a1e';
    ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
    ctx.fillStyle = '#2d6a32';
    ctx.fillRect(0, canvas.height - 48, canvas.width, 16);

    ctx.fillStyle = 'rgba(255, 224, 138, 0.16)';
    const groundOffset = -(scroll * 0.8) % 118;
    for (let x = groundOffset; x < canvas.width + 118; x += 118) {
        ctx.fillRect(x, canvas.height - 48, 28, 4);
    }
}


// 3. ?뚮젅?댁뼱 ?대옒??
class Player {
    constructor(x, y, width, height) {
        this.x = x;
        this.startX = x;
        this.targetX = Math.min(140, Math.max(92, canvas.width * 0.18));
        this.y = y;
        this.width = width;
        this.height = height;

        this.velocityY = 0;
        this.isJumping = false;

        // --- 異붽?: ?좊땲硫붿씠?섏쓣 ?꾪븳 ?ㅼ젙 ---
        this.image = bananaImage;
        // banana_run.png ?뚯씪??4媛쒖쓽 ?꾨젅?꾩씠 ?덈떎怨?媛??
        this.spriteWidth = 250; // ?대?吏 ?뚯씪??珥?媛濡쒓만??/ ?꾨젅????(?? 1000 / 4)
        this.spriteHeight = 250; // ?대?吏 ?뚯씪???몃줈湲몄씠
        this.frameX = 0; // ?꾩옱 蹂댁뿬以??꾨젅???몃뜳??
        this.maxFrame = 3; // 留덉?留??꾨젅???몃뜳??(0, 1, 2, 3)
        this.frameTimer = 0;
        this.fps = 15; // ?좊땲硫붿씠???띾룄
        this.frameInterval = 1000 / this.fps;
        this.runTime = 0;
        this.runLean = 0;
        this.drawX = x;
        this.drawY = y;
        this.legPhase = 0;

        this.hp = 100;
        this.maxHp = 100;
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 1500; // 1.5珥?臾댁쟻
    }

    // 洹몃━湲?
    draw() {
        // --- ?섏젙: ?ш컖??????대?吏 洹몃━湲?---
        // drawImage(?대?吏, ?뚯뒪x, ?뚯뒪y, ?뚯뒪w, ?뚯뒪h, ?寃웯, ?寃웱, ?寃웮, ?寃웘)
        if (shieldTimer > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 224, 138, 0.75)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(this.drawX + this.width / 2, this.drawY + this.height / 2, this.width * 0.72, this.height * 0.65, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (imageReady(this.image) && this.image.src.endsWith('.svg')) {
            ctx.save();
            ctx.translate(this.drawX + this.width / 2, this.drawY + this.height / 2);
            ctx.rotate(this.runLean);
            ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
            this.drawRunEffects();
            return;
        }

        if (imageReady(this.image)) {
            ctx.drawImage(this.image, this.frameX * this.spriteWidth, 0, this.spriteWidth, this.spriteHeight, 
                this.x, this.y, this.width, this.height);
            return;
        }

        ctx.fillStyle = '#ffd43b';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#5c3b14';
        ctx.fillRect(this.x + this.width * 0.7, this.y + 6, 8, 10);
        this.drawRunEffects();
    }

    drawRunEffects() {
        if (!isGameStarted) return;
        const footY = this.drawY + this.height - 3;
        const centerX = this.drawX + this.width * 0.48;
        const step = Math.sin(this.legPhase);
        ctx.save();
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.moveTo(centerX - 5, footY - 6);
        ctx.lineTo(centerX - 18 * step, footY + 12);
        ctx.moveTo(centerX + 7, footY - 6);
        ctx.lineTo(centerX + 18 * step, footY + 12);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 224, 138, 0.28)';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(this.drawX - 8 - i * 11, footY + 8 + i, 8 - i, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // --- 異붽?: ?쇨꺽 硫붿냼??---
    takeDamage(amount) {
        if (shieldTimer > 0) {
            shieldTimer = 0;
            playSound('powerup');
            return;
        }
        if (this.isInvincible) return;
        this.hp -= amount;
        this.isInvincible = true;
        if (this.hp <= 0) endGame(true);
    }

    // ?먰봽
    jump() {
        if (!this.isJumping) {
            playSound('jump');
            this.velocityY = -12; // ?먰봽 ?믪씠
            this.isJumping = true;
        }
    }

    // --- 異붽?: 怨듦꺽 硫붿냼??---
    shoot() {
        const shotCost = rapidFireTimer > 0 ? 4 : 8;
        if (weaponEnergy < shotCost) return;
        weaponEnergy = Math.max(0, weaponEnergy - shotCost);
        projectiles.push(new Projectile(this.drawX + this.width, this.drawY + this.height / 2));
        playSound('shoot');
    }

    // ?낅뜲?댄듃 (以묐젰 ?곸슜 ??
    update(deltaTime) {
        this.runTime += deltaTime * (isGameStarted ? gameSpeed : 1);
        this.legPhase += deltaTime * (isGameStarted ? 0.034 + gameSpeed * 0.002 : 0);
        if (isGameStarted && this.x < this.targetX) {
            this.x = Math.min(this.targetX, this.x + (0.16 * deltaTime));
        }
        const stride = Math.sin(this.runTime * 0.018);
        const bob = Math.abs(stride) * (this.isJumping ? 1.2 : 4);
        this.drawX = this.x + stride * 4;
        this.drawY = this.y - bob;
        this.runLean = isGameStarted ? stride * 0.08 + 0.08 : 0;

        this.y += this.velocityY;

        // --- 異붽?: ?щ━湲??좊땲硫붿씠???꾨젅??蹂寃?---
        // ?낆뿉 ?덉쓣 ?뚮쭔 ?ㅻ━媛 ?吏곸씠?꾨줉
        if (!this.isJumping) {
            if (this.frameTimer > this.frameInterval) {
                this.frameX < this.maxFrame ? this.frameX++ : this.frameX = 0;
                this.frameTimer = 0;
            } else {
                this.frameTimer += deltaTime;
            }
        }

        // 臾댁쟻 ?곹깭 ?낅뜲?댄듃 諛?源쒕묀???④낵
        if (this.isInvincible) {
            this.invincibilityTimer += deltaTime;
            // 1500ms ?숈븞 100ms 媛꾧꺽?쇰줈 源쒕묀??
            ctx.globalAlpha = (this.invincibilityTimer / 100) % 2 < 1 ? 0.5 : 1;
            if (this.invincibilityTimer > this.invincibilityDuration) {
                this.isInvincible = false;
                this.invincibilityTimer = 0;
            }
        }
        // 諛붾떏???우븯?붿? ?뺤씤
        const groundPosition = canvas.height - this.height;
        if (this.y < groundPosition) {
            this.velocityY += gravity;
            this.isJumping = true;
        } else {
            this.velocityY = 0;
            this.isJumping = false;
            this.y = groundPosition;
        }
        
        this.draw();
        ctx.globalAlpha = 1.0; // ?щ챸??珥덇린??
    }
}

// 4. ?μ븷臾??대옒??
class Obstacle {
    constructor(x, y, width, height, image) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = image;
    }

    draw() {
        if (imageReady(this.image)) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            return;
        }

        ctx.fillStyle = this.height < 50 ? '#8ecae6' : '#8d99ae';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() { // update 濡쒖쭅? ?숈씪
        this.x -= gameSpeed;
        this.draw();
    }
}

class Collectible {
    constructor(x, y, type = 'banana') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = type === 'power' ? 36 : 28;
        this.height = type === 'power' ? 36 : 28;
        this.phase = Math.random() * Math.PI * 2;
    }

    update(deltaTime) {
        this.x -= gameSpeed * 0.82;
        this.phase += deltaTime * 0.006;
        this.draw();
    }

    draw() {
        const bob = Math.sin(this.phase) * 4;
        const x = this.x;
        const y = this.y + bob;
        ctx.save();
        ctx.translate(x + this.width / 2, y + this.height / 2);
        if (this.type === 'power') {
            ctx.rotate(this.phase * 0.6);
            ctx.fillStyle = '#ffe08a';
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const radius = i % 2 === 0 ? this.width / 2 : this.width / 4;
                const angle = -Math.PI / 2 + i * Math.PI / 5;
                ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff8dd';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.rotate(-0.25);
            ctx.fillStyle = '#ffd43b';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width / 2, this.height / 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#8a5a12';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = '#5c3b14';
            ctx.fillRect(this.width * 0.22, -3, 5, 9);
        }
        ctx.restore();
    }
}

// --- 異붽?: 諛쒖궗泥??대옒??---
class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = 7;
        this.image = peelImage;
    }

    update() {
        this.x += this.speed;
        this.draw();
    }

    draw() {
        if (imageReady(this.image)) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            return;
        }

        ctx.fillStyle = '#ffe066';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// --- 異붽?: 蹂댁뒪 諛쒖궗泥??대옒??---
class BossProjectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 20;
        this.speed = -5; // ?쇱そ?쇰줈 ?대룞
        this.image = bossProjectileImage;
    }

    update() {
        this.x += this.speed;
        this.draw();
    }

    draw() {
        if (imageReady(this.image)) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            return;
        }

        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}


// --- 異붽?: 蹂댁뒪 ?대옒??---
class Boss {
    constructor(width, height, image) {
        this.width = width;
        this.height = height;
        this.image = image;
        this.x = canvas.width; // ?붾㈃ ?ㅻⅨ履?諛뽰뿉???쒖옉
        this.y = canvas.height / 2 - this.height / 2; // ?붾㈃ 以묒븰 ?믪씠
        this.hp = 100;
        this.maxHp = 100;
        this.speedX = 1; // ?깆옣 ???섑룊 ?대룞 ?띾룄
        this.speedY = 2; // ?곹븯 ?대룞 ?띾룄
        this.projectiles = []; // 蹂댁뒪??諛쒖궗泥?諛곗뿴
        this.shootTimer = 0;
        this.shootInterval = 2000; // 2珥덈쭏??諛쒖궗
    }

    draw() {
        // 蹂댁뒪 ?대?吏 洹몃━湲?
        if (imageReady(this.image)) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#c1121f';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#fdf0d5';
            ctx.fillRect(this.x + 25, this.y + 35, 25, 25);
            ctx.fillRect(this.x + 95, this.y + 35, 25, 25);
        }

        // HP 諛?洹몃━湲?
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y - 20, this.width, 10);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x, this.y - 20, this.width * (this.hp / this.maxHp), 10);
    }

    update(deltaTime) {
        // ?붾㈃ ?덉쑝濡??쇱젙 ?꾩튂源뚯? ?ㅼ뼱??
        if (this.x > canvas.width - this.width - 50) {
            this.x -= this.speedX;
        }

        // ?꾩븘?섎줈 ?吏곸씠???⑦꽩
        this.y += this.speedY;
        if (this.y <= 0 || this.y + this.height >= canvas.height) {
            this.speedY *= -1; // ?붾㈃ ?앹뿉 ?우쑝硫?諛⑺뼢 ?꾪솚
        }

        // 蹂댁뒪 怨듦꺽 ?⑦꽩
        this.shootTimer += deltaTime;
        if (this.shootTimer > this.shootInterval && this.x <= canvas.width - this.width - 50) {
            this.shoot();
            this.shootTimer = 0;
        }

        // 蹂댁뒪 諛쒖궗泥??낅뜲?댄듃
        this.projectiles.forEach((projectile, index) => {
            projectile.update();
            if (projectile.x + projectile.width < 0) this.projectiles.splice(index, 1);
        });

        this.draw();
    }

    // --- 異붽?: ?쇨꺽 硫붿냼??---
    takeDamage(amount) {
        this.hp -= amount;
        playSound('bossHit');
    }

    // 蹂댁뒪 怨듦꺽 硫붿냼??
    shoot() {
        this.projectiles.push(new BossProjectile(this.x, this.y + this.height / 2));
    }
}

// 5. 寃뚯엫 媛앹껜 ?앹꽦
const player = new Player(50, canvas.height - 50, 50, 50);
let projectiles = []; // 諛쒖궗泥?諛곗뿴
let obstacles = [];
let collectibles = [];
let collectibleTimer = 0;
let powerupTimer = 0;
let animationFrameId; // --- 異붽?: 寃뚯엫 猷⑦봽 ?쒖뼱??---
let lastTime = 0; // --- 異붽?: ?쒓컙 媛꾧꺽 怨꾩궛??---
let isGameStarted = false; // --- 異붽?: 寃뚯엫 ?쒖옉 ?щ? ?뺤씤 ---

function keepPlayerOnGround() {
    player.targetX = Math.min(140, Math.max(92, canvas.width * 0.18));
    player.x = Math.min(player.x, player.targetX);
    player.y = Math.min(player.y, canvas.height - player.height);
}

window.addEventListener('resize', () => {
    resizeCanvas();
    keepPlayerOnGround();
});

// 6. 寃뚯엫 猷⑦봽
function animate(timestamp) {
    const deltaTime = timestamp - lastTime; // ?꾨젅??媛??쒓컙 媛꾧꺽
    lastTime = timestamp;

    animationFrameId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawJungleBackground();

    // --- 異붽?: ?먯닔 怨꾩궛 諛??쒖떆 ---
    // 寃뚯엫???쒖옉?섏뿀???뚮쭔 ?먯닔 利앷?
    if (isGameStarted) {
        score += deltaTime * 0.01 * (gameSpeed / baseGameSpeed);
        const difficultySpeed = baseGameSpeed + Math.floor(score / 80) * 0.45 + score * 0.0012;
        gameSpeed = Math.min(maxGameSpeed, difficultySpeed);
        comboTimer = Math.max(0, comboTimer - deltaTime);
        rapidFireTimer = Math.max(0, rapidFireTimer - deltaTime);
        shieldTimer = Math.max(0, shieldTimer - deltaTime);
        if (comboTimer === 0) combo = 0;
    }
    ctx.fillStyle = 'white';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${Math.floor(score)}`, 20, 30);

    // --- 異붽?: ?뚮젅?댁뼱 HP 諛??쒖떆 ---
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 45, 150, 15);
    ctx.fillStyle = 'green';
    ctx.fillRect(20, 45, 150 * (player.hp / player.maxHp), 15);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(20, 45, 150, 15);

    ctx.fillStyle = '#1b4332';
    ctx.fillRect(20, 68, 150, 12);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(20, 68, 150 * Math.min(1, weaponEnergy / 100), 12);
    ctx.strokeStyle = '#fff8dd';
    ctx.strokeRect(20, 68, 150, 12);
    ctx.fillStyle = '#fff8dd';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Weapon ${Math.floor(weaponEnergy)}%`, 178, 79);
    if (combo > 1) {
        ctx.fillStyle = '#ffe08a';
        ctx.font = '18px sans-serif';
        ctx.fillText(`Combo x${combo}`, 20, 104);
    }
    if (shieldTimer > 0 || rapidFireTimer > 0) {
        ctx.fillStyle = '#fff8dd';
        ctx.font = '14px sans-serif';
        const powerText = shieldTimer > 0 ? 'Shield!' : 'Rapid fire!';
        ctx.fillText(powerText, 20, 124);
    }

    player.update(deltaTime);

    if (isGameStarted && gameMode === 'running') {
        collectibleTimer += deltaTime;
        powerupTimer += deltaTime;
        if (collectibleTimer > Math.max(520, 1050 - gameSpeed * 45)) {
            const lane = Math.random();
            const itemY = lane < 0.34 ? canvas.height - 92 : lane < 0.68 ? canvas.height - 145 : canvas.height - 205;
            collectibles.push(new Collectible(canvas.width + 20, Math.max(86, itemY), 'banana'));
            collectibleTimer = 0;
        }
        if (powerupTimer > 7200) {
            collectibles.push(new Collectible(canvas.width + 40, canvas.height - 165, 'power'));
            powerupTimer = 0;
        }
    }

    collectibles.forEach((item, index) => {
        item.update(deltaTime);
        if (isColliding(player, item)) {
            const comboBonus = Math.min(combo, 5);
            if (item.type === 'power') {
                score += 35;
                weaponEnergy = Math.min(100, weaponEnergy + 45);
                rapidFireTimer = 4200;
                shieldTimer = 5000;
                playSound('powerup');
            } else {
                combo += 1;
                comboTimer = 2200;
                score += 10 + comboBonus * 3;
                weaponEnergy = Math.min(100, weaponEnergy + 12);
                playSound('collect');
            }
            collectibles.splice(index, 1);
        }
        if (item.x + item.width < 0) collectibles.splice(index, 1);
    });

    // --- ?섏젙: 寃뚯엫 紐⑤뱶???곕Ⅸ 濡쒖쭅 遺꾧린 ---
    if (gameMode === 'running') {
        // ?쇰컲 ?μ븷臾??앹꽦 諛??낅뜲?댄듃
        const obstacleSpawnInterval = Math.max(430, 1200 - gameSpeed * 70);
        if (isGameStarted && (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - obstacleSpawnInterval)) {
            if (Math.random() < 0.5) {
                obstacles.push(new Obstacle(canvas.width, canvas.height - 50, 50, 50, rockImage));
            } else {
                const birdY = Math.random() < 0.5 ? canvas.height - 90 : canvas.height - 130;
                obstacles.push(new Obstacle(canvas.width, birdY, 60, 40, birdImage));
            }
        }
        obstacles.forEach((obstacle, index) => {
            obstacle.update();
            if (isColliding(player, obstacle)) {
                player.takeDamage(25); // ?μ븷臾?異⑸룎 ??25 ?곕?吏
                obstacles.splice(index, 1); // 異⑸룎???μ븷臾??쒓굅
            }
            if (obstacle.x + obstacle.width < 0) obstacles.splice(index, 1);
        });

        // 蹂댁뒪 ?깆옣 議곌굔 ?뺤씤
        if (score >= BOSS_SPAWN_SCORE) {
            gameMode = 'boss';
            obstacles = []; // 紐⑤뱺 ?쇰컲 ?μ븷臾??쒓굅
            collectibles = [];
            weaponEnergy = Math.max(weaponEnergy, 65);
            rapidFireTimer = Math.max(rapidFireTimer, 2500);
            playSound('powerup');
            boss = new Boss(150, 150, bossImage); // 蹂댁뒪 ?앹꽦
        }
    } else if (gameMode === 'boss') {
        if (isGameStarted) {
            weaponEnergy = Math.min(100, weaponEnergy + deltaTime * 0.006);
        }
        // 蹂댁뒪??濡쒖쭅
        if (boss) {
            boss.update(deltaTime);
            if (isColliding(player, boss)) {
                player.takeDamage(50); // 蹂댁뒪 紐몄껜 異⑸룎 ??50 ?곕?吏
            }

            // 蹂댁뒪 諛쒖궗泥댁? ?뚮젅?댁뼱 異⑸룎 媛먯?
            boss.projectiles.forEach((projectile, index) => {
                if (isColliding(player, projectile)) {
                    boss.projectiles.splice(index, 1);
                    player.takeDamage(10); // 蹂댁뒪 諛쒖궗泥??쇨꺽 ??10 ?곕?吏
                }
            });

            // 諛쒖궗泥댁? 蹂댁뒪 異⑸룎 媛먯?
            projectiles.forEach((projectile, projIndex) => {
                if (isColliding(projectile, boss)) {
                    boss.takeDamage(rapidFireTimer > 0 ? 14 : 10); // 10 ?곕?吏
                    projectiles.splice(projIndex, 1); // 諛쒖궗泥??쒓굅

                    if (boss.hp <= 0) {
                        winGame();
                    }
                }
            });
        }
    }

    // 諛쒖궗泥??낅뜲?댄듃
    projectiles.forEach((projectile, index) => {
        projectile.update();
        if (projectile.x > canvas.width) {
            projectiles.splice(index, 1); // ?붾㈃ 諛뽰쑝濡??섍?硫??쒓굅
        }
    });
}

// --- 異붽?: 異⑸룎 媛먯? ?⑥닔 ---
function isColliding(rect1, rect2) {
    const rect1X = rect1.drawX ?? rect1.x;
    const rect1Y = rect1.drawY ?? rect1.y;
    return rect1X < rect2.x + rect2.width &&
           rect1X + rect1.width > rect2.x &&
           rect1Y < rect2.y + rect2.height &&
           rect1Y + rect1.height > rect2.y;
}

// --- 異붽?: 寃뚯엫 ?ㅻ쾭 泥섎━ ?⑥닔 ---
function endGame(playerWasHit = false) {
    if (gameMode === 'gameOver') return; // 以묐났 ?ㅽ뻾 諛⑹?
    gameMode = 'gameOver';
    cancelAnimationFrame(animationFrameId);
    stopAmbientSound();
    if (playerWasHit) {
        playSound('playerHit');
    } else {
        playSound('hit');
    }
    document.getElementById('finalScore').innerText = Math.floor(score);
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// --- 異붽?: 寃뚯엫 ?밸━ 泥섎━ ?⑥닔 ---
function winGame() {
    if (gameMode === 'victory') return; // 以묐났 ?ㅽ뻾 諛⑹?
    gameMode = 'victory';
    cancelAnimationFrame(animationFrameId);
    stopAmbientSound();
    playSound('victory');
    document.getElementById('victoryScore').innerText = Math.floor(score);
    document.getElementById('victoryScreen').classList.remove('hidden');
}

// 7. ?낅젰 泥섎━
function startGame() {
    if (!isGameStarted) {
        startAmbientSound();
        isGameStarted = true;
        startHint.classList.add('hidden');
    }
}

function handleInput(e) {
    startGame();

    // ?ㅽ럹?댁뒪諛??먮뒗 ?곗튂濡??먰봽
    if (e.code === 'Space' || e.type === 'touchstart' || e.type === 'pointerdown') {
        e.preventDefault(); // ?곗튂 ???붾㈃ ?ㅽ겕濡?諛⑹?
        player.jump();
    }

    // --- 異붽?: 'x' ?ㅻ줈 怨듦꺽 ---
    if (e.code === 'KeyX' && gameMode === 'boss') {
        player.shoot();
    }
}

window.addEventListener('keydown', handleInput);
canvas.addEventListener('pointerdown', handleInput);

jumpButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startGame();
    player.jump();
});

attackButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startGame();
    player.shoot();
});

if (!window.PointerEvent) {
    canvas.addEventListener('touchstart', handleInput, { passive: false });
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startGame();
        player.jump();
    }, { passive: false });
    attackButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startGame();
        player.shoot();
    }, { passive: false });
}

// --- 異붽?: ?ъ떆??踰꾪듉 ?대깽??由ъ뒪??---
document.getElementById('restartButton').addEventListener('click', () => {
    document.location.reload();
});

document.getElementById('playAgainButton').addEventListener('click', () => {
    document.location.reload();
});


// 寃뚯엫 ?쒖옉
animate(0);
