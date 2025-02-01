const levelModel = { initials: "L", name: "Level Reached", value: 1, color: "white" };
const scoreModel = { initials: "S", name: "TOTAL SCORE", value: 0, color: "yellow", width: "200px", weight: "bold" };

const scoreManagerModel = [
    levelModel,
    scoreModel
];

const gameOverModel = [
    levelModel,
    scoreModel
];

let scene = null;

const pipes = [];
let pipeFrameCount = 0;
let verticalVelocity = 0;
let started = false;
let ended = false;
let gameOver = false;

const createScene = function () {
    scene = new BABYLON.Scene(engine);
    window.gameScene = scene;

    const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 2, 16, new BABYLON.Vector3(0, 0, 0));
    const light = new BABYLON.PointLight("Point", new BABYLON.Vector3(5, 10, 5), scene);

    // Constants for sprite sizes and scaling
    const BACKGROUND_WIDTH = 144;
    const BACKGROUND_HEIGHT = 256;
    const GROUND_WIDTH = 168;
    const GROUND_HEIGHT = 56;
    const PLAYER_WIDTH = 17;
    const PLAYER_HEIGHT = 12;
    const PIPE_WIDTH = 26;
    const PIPE_HEIGHT = 160;

    const BACKGROUND_FLIP = 2.8;
    const GROUND_FLIP = 0.85;
    const BACKGROUND_SCALE = 20;
    const GROUND_SCALE = 24;
    const PLAYER_SCALE = 0.07;
    const PIPE_SCALE = 0.07;

    const BACKGROUND_Y_POSITION = 5;
    const GROUND_Y_POSITION = -8;
    const PLAYER_Y_INITIAL = 4;
    const PLAYER_Y_FLOOR = -3.7;
    const PLAYER_Y_ROOF = 6.5;

    // Dynamic pipe gap variables
    const MIN_PIPE_GAP = 13.5;
    const MAX_PIPE_GAP = 14.5;
    const PIPE_GAP_DECAY_RATE = 0.001;
    let PIPE_GAP = MAX_PIPE_GAP;
    let gapReductionProgress = 0;

    const GROUND_SPEED = 0.05;
    const GRAVITY = -0.01;
    const JUMP_STRENGTH = 0.14;
    const MAX_GRAVITY = -0.1;

    const MAX_ROTATION_DOWN = -Math.PI / 2;
    const ROTATION_UP = Math.PI / 6;
    const PIPE_INTERVAL = 150;

    // Cooldown configuration
    const GAME_OVER_COOLDOWN = 1000; // 1 second in milliseconds
    let canRestart = true;

    // Create sprite managers
    const spriteManagerBackground = new BABYLON.SpriteManager("backgroundManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/flappy-bg.png", 1, { width: BACKGROUND_WIDTH, height: BACKGROUND_HEIGHT }, scene);
    const spriteManagerGround = new BABYLON.SpriteManager("groundManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/flappy-gnd.png", 1, { width: GROUND_WIDTH, height: GROUND_HEIGHT }, scene);
    const spriteManagerPlayer = new BABYLON.SpriteManager("playerManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/bird-sprites.png", 3, { width: PLAYER_WIDTH, height: PLAYER_HEIGHT }, scene);
    const spriteManagerPipeUp = new BABYLON.SpriteManager("pipeUpManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/flappy-pipe-up.png", 10, { width: PIPE_WIDTH, height: PIPE_HEIGHT }, scene);
    const spriteManagerPipeDown = new BABYLON.SpriteManager("pipeDownManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/flappy-pipe-down.png", 10, { width: PIPE_WIDTH, height: PIPE_HEIGHT }, scene);

    function addSprite(name, spriteManager, width, height, scale) {
        const sprite = new BABYLON.Sprite(name, spriteManager);
        sprite.width = width * scale;
        sprite.height = height * scale;

        const boundingBox = BABYLON.MeshBuilder.CreateBox(name + "BoundingBox", {
            width: width * scale,
            height: height * scale,
            depth: 0.01
        }, scene);
        boundingBox.position.z = 0;                                                                                                                                  
        boundingBox.visibility = 0.1;

        return { sprite, boundingBox };
    }

    const background = new BABYLON.Sprite("background", spriteManagerBackground);
    background.position.y = BACKGROUND_Y_POSITION;
    background.position.z = 0;
    background.width = BACKGROUND_SCALE;
    background.height = (BACKGROUND_HEIGHT / BACKGROUND_WIDTH) * BACKGROUND_SCALE;

    const ground = new BABYLON.Sprite("ground", spriteManagerGround);
    ground.position.y = GROUND_Y_POSITION;
    ground.width = GROUND_SCALE;
    ground.height = (GROUND_HEIGHT / GROUND_WIDTH) * GROUND_SCALE;

    const playerObject = addSprite("player0", spriteManagerPlayer, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SCALE);
    const player = playerObject.sprite;
    player.playAnimation(0, 2, true, 100);
    player.position.y = PLAYER_Y_INITIAL;
    playerObject.boundingBox.position.y = PLAYER_Y_INITIAL;

    function endNow() {
        player.stopAnimation();
        ended = true;
        gameOver = true;
        gameOverManager.popup(gameOverModel);

        // Set a timeout to prevent immediate restart
        canRestart = false;
        setTimeout(() => {
            canRestart = true;
        }, GAME_OVER_COOLDOWN);
    }

    function createPipePair() {
        const pipeUpObject = addSprite("pipeUp", spriteManagerPipeUp, PIPE_WIDTH, PIPE_HEIGHT, PIPE_SCALE);
        const pipeDownObject = addSprite("pipeDown", spriteManagerPipeDown, PIPE_WIDTH, PIPE_HEIGHT, PIPE_SCALE);

        const gapY = Math.random() * 6 - 2;

        pipeUpObject.sprite.position.x = 10;
        pipeUpObject.sprite.position.y = gapY + PIPE_GAP / 2;

        pipeDownObject.sprite.position.x = 10;
        pipeDownObject.sprite.position.y = gapY - PIPE_GAP / 2;

        pipeUpObject.boundingBox.position = pipeUpObject.sprite.position;
        pipeDownObject.boundingBox.position = pipeDownObject.sprite.position;

        pipes.push({ up: pipeUpObject, down: pipeDownObject, passed: false });
    }

    function reducePipeGap() {
        if (PIPE_GAP > MIN_PIPE_GAP) {
            gapReductionProgress += PIPE_GAP_DECAY_RATE;
            PIPE_GAP = MAX_PIPE_GAP + (MAX_PIPE_GAP - MIN_PIPE_GAP) * Math.exp(-gapReductionProgress);
        }
    }

    function checkCollision(playerBox, pipeBox) {
        return playerBox.intersectsMesh(pipeBox, false);
    }

    scene.onBeforeRenderObservable.add(() => {
        if (ended || gameControlsManager.paused) {
            return;
        }

        ground.position.x -= GROUND_SPEED;
        if (ground.position.x < -GROUND_FLIP) {
            ground.position.x = GROUND_FLIP;
        }

        if (started) {
            // Update pipes and check collisions
            for (let i = 0; i < pipes.length; i++) {
                const { up, down, passed } = pipes[i];

                if (checkCollision(playerObject.boundingBox, up.boundingBox) || checkCollision(playerObject.boundingBox, down.boundingBox)) {
                    endNow();
                }

                up.sprite.position.x -= GROUND_SPEED;
                down.sprite.position.x -= GROUND_SPEED;
                up.boundingBox.position = up.sprite.position;
                down.boundingBox.position = down.sprite.position;

                if (!passed && (player.position.x - player.width / 2) > (up.sprite.position.x + up.sprite.width / 2)) {
                    pipes[i].passed = true;
                    levelModel.value++;
                }

                if (up.sprite.position.x < -10) {
                    up.sprite.dispose();
                    down.sprite.dispose();
                    up.boundingBox.dispose();
                    down.boundingBox.dispose();
                    pipes.splice(i, 1);
                    i--;
                }
            }

            verticalVelocity += GRAVITY;
            if (verticalVelocity < MAX_GRAVITY) {
                verticalVelocity = MAX_GRAVITY;
            }

            player.position.y += verticalVelocity;
            playerObject.boundingBox.position = player.position;

            // Rotate the bird based on velocity and update bounding box
            if (verticalVelocity > 0) {
                player.angle = ROTATION_UP;
            } else {
                const rotationAmount = Math.max(MAX_ROTATION_DOWN, (MAX_ROTATION_DOWN * verticalVelocity) / MAX_GRAVITY);
                player.angle = rotationAmount;
            }

            // Apply the same rotation to the bounding box
            playerObject.boundingBox.rotation.z = player.angle;

            if (player.position.y < PLAYER_Y_FLOOR || player.position.y > PLAYER_Y_ROOF) {
                verticalVelocity = 0;
                endNow();
            }

            pipeFrameCount++;
            if (pipeFrameCount >= PIPE_INTERVAL) {
                createPipePair();
                pipeFrameCount = 0;
            }

            reducePipeGap();
        }
    });

    function resetGame() {
        levelModel.value = 0; // Reset GUI text

        pipes.forEach((pipe) => {
            pipe.up.sprite.dispose();
            pipe.down.sprite.dispose();
            pipe.up.boundingBox.dispose();
            pipe.down.boundingBox.dispose();
        });
        pipes.length = 0; // Clear the pipes array

        player.position.y = PLAYER_Y_INITIAL;
        verticalVelocity = 0;
        pipeFrameCount = 0;
        PIPE_GAP = MAX_PIPE_GAP;
        gapReductionProgress = 0;
        started = false;
        ended = false;
        gameOver = false;
        player.playAnimation(0, 2, true, 100);

        // Reset bird rotation
        player.angle = 0;
        playerObject.boundingBox.rotation.z = player.angle;
    }

    const userAction = () => {
        if (!started && !gameOver) {
            started = true;
            verticalVelocity = JUMP_STRENGTH;
        } else if (gameOver && canRestart) {
            //resetGame(); // Restart game on space/tap/click if game over and cooldown passed
        } else if (!gameOver) {
            verticalVelocity = JUMP_STRENGTH;
        }
    };

    scene.onKeyboardObservable.add((kbInfo) => {
        switch (kbInfo.type) {
            case BABYLON.KeyboardEventTypes.KEYDOWN:
                switch (kbInfo.event.key) {
                    case "Enter":
                    case " ":
                        userAction();
                        break;
                }
                break;
        }
    });
    
    scene.onPointerDown = function (evt, pickResult) {
        userAction();
    }

    return scene;
};

window.init = () => {
    scoreManager.init(scoreManagerModel, (updatedField, updatedOf) => {
        if (updatedField == "L") {
            scoreModel.value = (levelModel.value - 1 ) * 100;
        }
    });

    gameControlsManager.init("https://raw.githubusercontent.com/xMichal123/mall-games/main/resources/flappy-bird-intro.webp",
        () => { },
        () => { resetGame(); },
        () => { },
        () => { }
    );

    gameOverManager.init(() => { resetGame(); });
}

createScene();
