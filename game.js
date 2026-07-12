// 1. 기본 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기를 화면에 맞게 조절
canvas.width = Math.min(window.innerWidth * 0.9, 800);
canvas.height = Math.min(window.innerHeight * 0.7, 400);

// --- 추가: 게임 에셋 (이미지, 사운드) ---
const bananaImage = new Image();
bananaImage.src = '/my-arcade-runner/assets/banana_run.png'; // 바나나 스프라이트 이미지
const backgroundMusic = new Audio('/my-arcade-runner/assets/background_music.mp3'); // 배경음악
const jumpSound = new Audio('/my-arcade-runner/assets/jump.wav'); // 점프 효과음
const hitSound = new Audio('/my-arcade-runner/assets/hit.wav'); // 충돌 효과음
const rockImage = new Image(); rockImage.src = '/my-arcade-runner/assets/rock.png'; // 바위 장애물
const birdImage = new Image(); birdImage.src = '/my-arcade-runner/assets/bird.png'; // 새 장애물
const bossImage = new Image(); bossImage.src = '/my-arcade-runner/assets/boss.png'; // 보스 이미지
const peelImage = new Image(); peelImage.src = '/my-arcade-runner/assets/banana_peel.png'; // 바나나 껍질 이미지
const bossHitSound = new Audio('/my-arcade-runner/assets/boss_hit.wav'); // 보스 피격음
const victoryMusic = new Audio('/my-arcade-runner/assets/victory.mp3'); // 승리 음악
const bossProjectileImage = new Image(); bossProjectileImage.src = '/my-arcade-runner/assets/boss_projectile.png'; // 보스 발사체
const playerHitSound = new Audio('/my-arcade-runner/assets/player_hit.wav'); // 플레이어 피격음

backgroundMusic.loop = true; // 음악 반복 재생

// 2. 게임 변수 정의
const gravity = 0.5;
let gameSpeed = 3;
const gameSpeedIncrease = 0.0001; // 게임 속도 증가율
let score = 0;
let gameMode = 'running'; // 'running', 'boss'
let boss = null; // 보스 객체
const BOSS_SPAWN_SCORE = 500; // 보스 등장 점수


// 3. 플레이어 클래스
class Player {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.velocityY = 0;
        this.isJumping = false;

        // --- 추가: 애니메이션을 위한 설정 ---
        this.image = bananaImage;
        // banana_run.png 파일에 4개의 프레임이 있다고 가정
        this.spriteWidth = 250; // 이미지 파일의 총 가로길이 / 프레임 수 (예: 1000 / 4)
        this.spriteHeight = 250; // 이미지 파일의 세로길이
        this.frameX = 0; // 현재 보여줄 프레임 인덱스
        this.maxFrame = 3; // 마지막 프레임 인덱스 (0, 1, 2, 3)
        this.frameTimer = 0;
        this.fps = 15; // 애니메이션 속도
        this.frameInterval = 1000 / this.fps;

        this.hp = 100;
        this.maxHp = 100;
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 1500; // 1.5초 무적
    }

    // 그리기
    draw() {
        // --- 수정: 사각형 대신 이미지 그리기 ---
        // drawImage(이미지, 소스x, 소스y, 소스w, 소스h, 타겟x, 타겟y, 타겟w, 타겟h)
        ctx.drawImage(this.image, this.frameX * this.spriteWidth, 0, this.spriteWidth, this.spriteHeight, 
            this.x, this.y, this.width, this.height);
    }

    // --- 추가: 피격 메소드 ---
    takeDamage(amount) {
        if (this.isInvincible) return;
        this.hp -= amount;
        this.isInvincible = true;
        if (this.hp <= 0) endGame(true);
    }

    // 점프
    jump() {
        if (!this.isJumping) {
            jumpSound.currentTime = 0; // 사운드를 처음부터 재생
            jumpSound.play(); // 점프 사운드 재생
            this.velocityY = -12; // 점프 높이
            this.isJumping = true;
        }
    }

    // --- 추가: 공격 메소드 ---
    shoot() {
        projectiles.push(new Projectile(this.x + this.width, this.y + this.height / 2));
    }

    // 업데이트 (중력 적용 등)
    update(deltaTime) {
        this.y += this.velocityY;

        // --- 추가: 달리기 애니메이션 프레임 변경 ---
        // 땅에 있을 때만 다리가 움직이도록
        if (!this.isJumping) {
            if (this.frameTimer > this.frameInterval) {
                this.frameX < this.maxFrame ? this.frameX++ : this.frameX = 0;
                this.frameTimer = 0;
            } else {
                this.frameTimer += deltaTime;
            }
        }

        // 무적 상태 업데이트 및 깜빡임 효과
        if (this.isInvincible) {
            this.invincibilityTimer += deltaTime;
            // 1500ms 동안 100ms 간격으로 깜빡임
            ctx.globalAlpha = (this.invincibilityTimer / 100) % 2 < 1 ? 0.5 : 1;
            if (this.invincibilityTimer > this.invincibilityDuration) {
                this.isInvincible = false;
                this.invincibilityTimer = 0;
            }
        }
        // 바닥에 닿았는지 확인
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
        ctx.globalAlpha = 1.0; // 투명도 초기화
    }
}

// 4. 장애물 클래스
class Obstacle {
    constructor(x, y, width, height, image) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = image;
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

    update() { // update 로직은 동일
        this.x -= gameSpeed;
        this.draw();
    }
}

// --- 추가: 발사체 클래스 ---
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
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
}

// --- 추가: 보스 발사체 클래스 ---
class BossProjectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 20;
        this.speed = -5; // 왼쪽으로 이동
        this.image = bossProjectileImage;
    }

    update() {
        this.x += this.speed;
        this.draw();
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
}


// --- 추가: 보스 클래스 ---
class Boss {
    constructor(width, height, image) {
        this.width = width;
        this.height = height;
        this.image = image;
        this.x = canvas.width; // 화면 오른쪽 밖에서 시작
        this.y = canvas.height / 2 - this.height / 2; // 화면 중앙 높이
        this.hp = 100;
        this.maxHp = 100;
        this.speedX = 1; // 등장 시 수평 이동 속도
        this.speedY = 2; // 상하 이동 속도
        this.projectiles = []; // 보스의 발사체 배열
        this.shootTimer = 0;
        this.shootInterval = 2000; // 2초마다 발사
    }

    draw() {
        // 보스 이미지 그리기
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);

        // HP 바 그리기
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y - 20, this.width, 10);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x, this.y - 20, this.width * (this.hp / this.maxHp), 10);
    }

    update(deltaTime) {
        // 화면 안으로 일정 위치까지 들어옴
        if (this.x > canvas.width - this.width - 50) {
            this.x -= this.speedX;
        }

        // 위아래로 움직이는 패턴
        this.y += this.speedY;
        if (this.y <= 0 || this.y + this.height >= canvas.height) {
            this.speedY *= -1; // 화면 끝에 닿으면 방향 전환
        }

        // 보스 공격 패턴
        this.shootTimer += deltaTime;
        if (this.shootTimer > this.shootInterval && this.x <= canvas.width - this.width - 50) {
            this.shoot();
            this.shootTimer = 0;
        }

        // 보스 발사체 업데이트
        this.projectiles.forEach((projectile, index) => {
            projectile.update();
            if (projectile.x + projectile.width < 0) this.projectiles.splice(index, 1);
        });

        this.draw();
    }

    // --- 추가: 피격 메소드 ---
    takeDamage(amount) {
        this.hp -= amount;
        bossHitSound.currentTime = 0;
        bossHitSound.play();
    }

    // 보스 공격 메소드
    shoot() {
        this.projectiles.push(new BossProjectile(this.x, this.y + this.height / 2));
    }
}

// 5. 게임 객체 생성
const player = new Player(50, canvas.height - 50, 50, 50);
let projectiles = []; // 발사체 배열
let obstacles = [];
let animationFrameId; // --- 추가: 게임 루프 제어용 ---
let lastTime = 0; // --- 추가: 시간 간격 계산용 ---
let isGameStarted = false; // --- 추가: 게임 시작 여부 확인 ---

// 6. 게임 루프
function animate(timestamp) {
    const deltaTime = timestamp - lastTime; // 프레임 간 시간 간격
    lastTime = timestamp;

    animationFrameId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- 추가: 점수 계산 및 표시 ---
    // 게임이 시작되었을 때만 점수 증가
    if (isGameStarted) {
        score += deltaTime * 0.01;
    }
    ctx.fillStyle = 'white';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${Math.floor(score)}`, 20, 30);

    // --- 추가: 플레이어 HP 바 표시 ---
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 45, 150, 15);
    ctx.fillStyle = 'green';
    ctx.fillRect(20, 45, 150 * (player.hp / player.maxHp), 15);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(20, 45, 150, 15);

    player.update(deltaTime);

    // --- 수정: 게임 모드에 따른 로직 분기 ---
    if (gameMode === 'running') {
        // --- 추가: 게임 속도 점진적 증가 ---
        if (isGameStarted) {
            gameSpeed += gameSpeedIncrease * deltaTime;
        }

        // 일반 장애물 생성 및 업데이트
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
                player.takeDamage(25); // 장애물 충돌 시 25 데미지
                obstacles.splice(index, 1); // 충돌한 장애물 제거
            }
            if (obstacle.x + obstacle.width < 0) obstacles.splice(index, 1);
        });

        // 보스 등장 조건 확인
        if (score >= BOSS_SPAWN_SCORE) {
            gameMode = 'boss';
            obstacles = []; // 모든 일반 장애물 제거
            boss = new Boss(150, 150, bossImage); // 보스 생성
        }
    } else if (gameMode === 'boss') {
        // 보스전 로직
        if (boss) {
            boss.update(deltaTime);
            if (isColliding(player, boss)) {
                player.takeDamage(50); // 보스 몸체 충돌 시 50 데미지
            }

            // 보스 발사체와 플레이어 충돌 감지
            boss.projectiles.forEach((projectile, index) => {
                if (isColliding(player, projectile)) {
                    boss.projectiles.splice(index, 1);
                    player.takeDamage(10); // 보스 발사체 피격 시 10 데미지
                }
            });

            // 발사체와 보스 충돌 감지
            projectiles.forEach((projectile, projIndex) => {
                if (isColliding(projectile, boss)) {
                    boss.takeDamage(10); // 10 데미지
                    projectiles.splice(projIndex, 1); // 발사체 제거

                    if (boss.hp <= 0) {
                        winGame();
                    }
                }
            });
        }
    }

    // 발사체 업데이트
    projectiles.forEach((projectile, index) => {
        projectile.update();
        if (projectile.x > canvas.width) {
            projectiles.splice(index, 1); // 화면 밖으로 나가면 제거
        }
    });
}

// --- 추가: 충돌 감지 함수 ---
function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// --- 추가: 게임 오버 처리 함수 ---
function endGame(playerWasHit = false) {
    if (gameMode === 'gameOver') return; // 중복 실행 방지
    gameMode = 'gameOver';
    cancelAnimationFrame(animationFrameId);
    backgroundMusic.pause();
    if (playerWasHit) {
        playerHitSound.currentTime = 0;
        playerHitSound.play();
    } else {
        hitSound.play();
    }
    document.getElementById('finalScore').innerText = Math.floor(score);
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// --- 추가: 게임 승리 처리 함수 ---
function winGame() {
    if (gameMode === 'victory') return; // 중복 실행 방지
    gameMode = 'victory';
    cancelAnimationFrame(animationFrameId);
    backgroundMusic.pause();
    victoryMusic.play();
    document.getElementById('victoryScore').innerText = Math.floor(score);
    document.getElementById('victoryScreen').classList.remove('hidden');
}

// 7. 입력 처리
function handleInput(e) {
    // --- 추가: 첫 입력 시 배경음악 재생 ---
    if (!isGameStarted) {
        backgroundMusic.play();
        isGameStarted = true;
    }

    // 스페이스바 또는 터치로 점프
    if (e.code === 'Space' || e.type === 'touchstart') {
        e.preventDefault(); // 터치 시 화면 스크롤 방지
        player.jump();
    }

    // --- 추가: 'x' 키로 공격 ---
    if (e.code === 'KeyX' && gameMode === 'boss') {
        player.shoot();
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', handleInput, { passive: false });

// --- 추가: 재시작 버튼 이벤트 리스너 ---
document.getElementById('restartButton').addEventListener('click', () => {
    document.location.reload();
});

document.getElementById('playAgainButton').addEventListener('click', () => {
    document.location.reload();
});


// 게임 시작
animate(0);