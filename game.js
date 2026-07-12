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

function playSound(sound) {
    try {
        sound.currentTime = 0;
        const result = sound.play();
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
let gameSpeed = 3;
const gameSpeedIncrease = 0.0001; // 寃뚯엫 ?띾룄 利앷???
let score = 0;
let gameMode = 'running'; // 'running', 'boss'
let boss = null; // 蹂댁뒪 媛앹껜
const BOSS_SPAWN_SCORE = 500; // 蹂댁뒪 ?깆옣 ?먯닔

function drawJungleBackground() {
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
    for (let x = -40; x < canvas.width + 80; x += 96) {
        ctx.beginPath();
        ctx.ellipse(x + 20, canvas.height - 112, 74, 42, -0.25, 0, Math.PI * 2);
        ctx.ellipse(x + 72, canvas.height - 126, 86, 50, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(6, 31, 21, 0.7)';
    for (let x = 18; x < canvas.width; x += 142) {
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
    for (let x = 34; x < canvas.width; x += 118) {
        ctx.fillRect(x, canvas.height - 48, 28, 4);
    }
}


// 3. ?뚮젅?댁뼱 ?대옒??
class Player {
    constructor(x, y, width, height) {
        this.x = x;
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
        if (imageReady(this.image) && this.image.src.endsWith('.svg')) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
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
    }

    // --- 異붽?: ?쇨꺽 硫붿냼??---
    takeDamage(amount) {
        if (this.isInvincible) return;
        this.hp -= amount;
        this.isInvincible = true;
        if (this.hp <= 0) endGame(true);
    }

    // ?먰봽
    jump() {
        if (!this.isJumping) {
            playSound(jumpSound); // ?먰봽 ?ъ슫???ъ깮
            this.velocityY = -12; // ?먰봽 ?믪씠
            this.isJumping = true;
        }
    }

    // --- 異붽?: 怨듦꺽 硫붿냼??---
    shoot() {
        projectiles.push(new Projectile(this.x + this.width, this.y + this.height / 2));
    }

    // ?낅뜲?댄듃 (以묐젰 ?곸슜 ??
    update(deltaTime) {
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
        playSound(bossHitSound);
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
let animationFrameId; // --- 異붽?: 寃뚯엫 猷⑦봽 ?쒖뼱??---
let lastTime = 0; // --- 異붽?: ?쒓컙 媛꾧꺽 怨꾩궛??---
let isGameStarted = false; // --- 異붽?: 寃뚯엫 ?쒖옉 ?щ? ?뺤씤 ---

function keepPlayerOnGround() {
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
        score += deltaTime * 0.01;
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

    player.update(deltaTime);

    // --- ?섏젙: 寃뚯엫 紐⑤뱶???곕Ⅸ 濡쒖쭅 遺꾧린 ---
    if (gameMode === 'running') {
        // --- 異붽?: 寃뚯엫 ?띾룄 ?먯쭊??利앷? ---
        if (isGameStarted) {
            gameSpeed += gameSpeedIncrease * deltaTime;
        }

        // ?쇰컲 ?μ븷臾??앹꽦 諛??낅뜲?댄듃
        const obstacleSpawnInterval = 1500;
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
            boss = new Boss(150, 150, bossImage); // 蹂댁뒪 ?앹꽦
        }
    } else if (gameMode === 'boss') {
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
                    boss.takeDamage(10); // 10 ?곕?吏
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
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// --- 異붽?: 寃뚯엫 ?ㅻ쾭 泥섎━ ?⑥닔 ---
function endGame(playerWasHit = false) {
    if (gameMode === 'gameOver') return; // 以묐났 ?ㅽ뻾 諛⑹?
    gameMode = 'gameOver';
    cancelAnimationFrame(animationFrameId);
    backgroundMusic.pause();
    if (playerWasHit) {
        playSound(playerHitSound);
    } else {
        playSound(hitSound);
    }
    document.getElementById('finalScore').innerText = Math.floor(score);
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// --- 異붽?: 寃뚯엫 ?밸━ 泥섎━ ?⑥닔 ---
function winGame() {
    if (gameMode === 'victory') return; // 以묐났 ?ㅽ뻾 諛⑹?
    gameMode = 'victory';
    cancelAnimationFrame(animationFrameId);
    backgroundMusic.pause();
    playSound(victoryMusic);
    document.getElementById('victoryScore').innerText = Math.floor(score);
    document.getElementById('victoryScreen').classList.remove('hidden');
}

// 7. ?낅젰 泥섎━
function startGame() {
    if (!isGameStarted) {
        playSound(backgroundMusic);
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
    if (gameMode === 'boss') {
        player.shoot();
    }
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
        if (gameMode === 'boss') {
            player.shoot();
        }
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
