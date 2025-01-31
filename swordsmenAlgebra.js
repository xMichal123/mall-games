const levelModel = { initials: "L", name: "Max Level Reached", value: 1, color: "white" };
const killsModel = { initials: "K", name: "Kills", value: 0 };
const scoreModel = { initials: "S", name: "TOTAL SCORE", value: 0, color: "yellow", width: "200px", weight: "bold" };

const scoreManagerModel = [
    levelModel,
    killsModel,
    scoreModel
];

const gameOverModel = [
    levelModel,
    killsModel,
    scoreModel
];

const spriteChangeInterval = 200; // 200 ms interval for frame change
const zDepthDivisor = 10; // Divisor for calculating z-depth
const fightInterval = 1000; // Time interval to start new pairs for the fight
const soldierSpeed = 0.01;
const moveLimit = 2.2;
const maxSoldiers = 100;
const mathTermRowLength = 25;
const initSoldiers = 6;
const fadingSpeed = 0.004;
const complexityStep = 0.1;

let cameraTarget = null;

let upMode = false;
let moving = false;

let guiPoint1 = null;
let guiPoint2 = null;

let army1 = null;
let army2 = null;

let currentComplexity = 1;

let currentMaxSoldiers = initSoldiers;

let modeSolving = true;

let task1 = null;
let sol1 = null;
let task2 = null;
let sol2 = null;

let fading = 1;

let wheel = null;
let wheelActionManager = null;

let guiManager = null;
let scene = null;

var createScene = function () {
    scene = new BABYLON.Scene(engine);
    window.gameScene = scene;

    // Initialize FollowCamera
    var camera = new BABYLON.FollowCamera("followCamera", new BABYLON.Vector3(0, 0, -10), scene);
    camera.radius = 10; // Distance from target
    camera.heightOffset = 0; // Height from target
    camera.rotationOffset = 0; // Angle around the target
    camera.cameraAcceleration = 0.5; // Camera acceleration
    camera.maxCameraSpeed = 10; // Maximum camera speed

    //camera.attachControl(canvas, true);

    let cameraTarget = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 0.1, segments: 1}, scene);
    cameraTarget.rotation.x = 3 * Math.PI / 2;
    cameraTarget.visibility = 0.0;

    guiPoint1 = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 0.1, segments: 1}, scene);
    guiPoint1.visibility = 0.0;

    guiPoint2 = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 0.1, segments: 1}, scene);
    guiPoint2.visibility = 0.0;

    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    const wheelRadius = 90;

    // Create a cylinder for the wheel
    wheel = BABYLON.MeshBuilder.CreateCylinder("wheel", {
        diameter: wheelRadius * 2,
        height: 20,
        tessellation: 64,
        faceUV: [
            new BABYLON.Vector4(0, 0, 0, 0), // Top face (no texture)
            new BABYLON.Vector4(0, 0, 1, 1), // Bottom face (no texture)
            new BABYLON.Vector4(0, 0, 0, 0)  // Side face (texture applied)
        ]
    }, scene);

    wheel.position = new BABYLON.Vector3(0, 0, 100);

    wheelActionManager = new BABYLON.ActionManager(scene);

    // Add a click event to the sphere
    wheelActionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
            upMode = !upMode;
            moving = true;
        })
    );

    // Load your texture for the wheel's body
    var bodyMaterial = new BABYLON.StandardMaterial("bodyMaterial", scene);
    bodyMaterial.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/xMichal123/publictests/main/battlefield.png", scene);
    wheel.material = bodyMaterial;

    // Preload managers for each soldier type to share across instances
    const soldier1Manager = new BABYLON.SpriteManager(
        "soldier1Manager",
        "https://raw.githubusercontent.com/xMichal123/publictests/main/soldier_sprites_1.png",
        1000,
        { width: 110, height: 114 },
        scene
    );

    const soldier2Manager = new BABYLON.SpriteManager(
        "soldier2Manager",
        "https://raw.githubusercontent.com/xMichal123/publictests/main/soldier_sprites_2.png",
        1000,
        { width: 110, height: 114 },
        scene
    );

    // Create two armies
    army1 = new Army(scene, soldier1Manager, new BABYLON.Vector3(0, -moveLimit, 0), initSoldiers, true);
    army2 = new Army(scene, soldier2Manager, new BABYLON.Vector3(6, -moveLimit, 0), 0, false);

    // Fight simulation: periodically select random pairs and make them fight
    scene.onBeforeRenderObservable.add(() => {
        if (army1.soldiers.length > 0 && army2.soldiers.length > 0) {
            // Move each soldier in army1 toward the closest soldier in army2
            army1.soldiers.forEach((soldier1, index1) => {
                let closestSoldier2 = null;
                let minDistance = Infinity;

                // Find the closest soldier in army2 to soldier1
                army2.soldiers.forEach(soldier2 => {
                    let distance = BABYLON.Vector3.Distance(soldier1.sprite.position, soldier2.sprite.position);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestSoldier2 = soldier2;
                    }
                });

                // Move soldier1 toward the closest soldier in army2
                if (closestSoldier2) {
                    soldier1.moveToward(closestSoldier2.sprite.position);

                    // Check if they are close enough to "fight"
                    if (minDistance < 0.5) {
                        let index2 = army2.soldiers.indexOf(closestSoldier2);
                        if (index2 >= 0) {
                            army1.removeSoldier(index1);
                            army2.removeSoldier(index2);
                            killsModel.value++;
                        }
                    }
                }
            });

            // Move each soldier in army2 toward the closest soldier in army1
            army2.soldiers.forEach((soldier2, index2) => {
                let closestSoldier1 = null;
                let minDistance = Infinity;

                // Find the closest soldier in army1 to soldier2
                army1.soldiers.forEach(soldier1 => {
                    let distance = BABYLON.Vector3.Distance(soldier2.sprite.position, soldier1.sprite.position);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestSoldier1 = soldier1;
                    }
                });

                // Move soldier2 toward the closest soldier in army1
                if (closestSoldier1) {
                    soldier2.moveToward(closestSoldier1.sprite.position);

                    // Check if they are close enough to "fight"
                    if (minDistance < 0.5) {
                        let index1 = army1.soldiers.indexOf(closestSoldier1);
                        if (index1 >= 0) {
                            army1.removeSoldier(index1);
                            army2.removeSoldier(index2);
                            killsModel.value++;
                        }
                    }
                }
            });

            fading -= fadingSpeed;
            fading = Math.max(0, fading);

            guiManager.rect1.alpha = fading;
            guiManager.rect2.alpha = fading;
        } else if (army1.soldiers.length > 0) {
            if (!modeSolving) {
                if (killsModel.value > 0) {
                    levelModel.value++;
                }
                
                makeTasks();
            }

            if (moving) {
                if (upMode) {
                    army1.soldiers.forEach((soldier1, index1) => {
                        soldier1.moveUp();

                        if (soldier1.sprite.position.y >= moveLimit) {
                            moving = false;
                        }
                    });
                } else {
                    army1.soldiers.forEach((soldier1, index1) => {
                        soldier1.moveDown();

                        if (soldier1.sprite.position.y <= -moveLimit) {
                            moving = false;
                        }
                    });
                }
            } else {
                army1.soldiers.forEach((soldier1, index1) => {
                    soldier1.moveFront();
                });
            }
        } else {
            gameOverManager.popup(gameOverModel);
            army2.soldiers.forEach((soldier1, index1) => {
                soldier1.moveFront();
            });
        }

        let rightmostSoldier = army1.getRightmostSoldier();

        if (rightmostSoldier) {
            cameraTarget.position = new BABYLON.Vector3(rightmostSoldier.sprite.position.x, 0, 0);
            camera.lockedTarget = cameraTarget;

            // Calculate the distance traveled and update wheel rotation
            let distanceTraveled = rightmostSoldier.sprite.position.x;
            let rotationAngle = Math.PI * distanceTraveled / (wheelRadius);

            wheel.position.x = rightmostSoldier.sprite.position.x;
            wheel.rotation.y = rotationAngle; // Update wheel rotation

            if (modeSolving && task1 != null) {
                if (guiPoint1.position.x - rightmostSoldier.sprite.position.x < 0) {
                    modeSolving = false;

                    army1.addSoldiers(upMode ? sol1 : sol2);

                    currentMaxSoldiers += Math.max(sol1, sol2);

                    army2.initialPosition = new BABYLON.Vector3(rightmostSoldier.sprite.position.x + 6, upMode ? moveLimit : -moveLimit, 0);

                    let soldiersToAdd = 1 + Math.round(Math.random() * (currentMaxSoldiers - 2));

                    army2.addSoldiers(soldiersToAdd);

                    currentMaxSoldiers -= soldiersToAdd;

                    if (sol1 > sol2) {
                        guiManager.rect1.background = "rgba(20, 255, 20, 0.9)";
                        guiManager.rect2.background = "rgba(255, 20, 20, 0.9)";
                    } else {
                        guiManager.rect1.background = "rgba(255, 20, 20, 0.9)";
                        guiManager.rect2.background = "rgba(20, 255, 20, 0.9)";
                    }

                    guiManager.label1.text = formatMathTerm(task1, mathTermRowLength) + " = " + sol1;
                    guiManager.label2.text = formatMathTerm(task2, mathTermRowLength) + " = " + sol2;

                } else if (upMode) {
                    guiManager.rect1.thickness = 16;
                    guiManager.rect1.background = "rgba(255, 255, 20, 0.9)";
                    guiManager.rect2.thickness = 4;
                    guiManager.rect2.background = "rgba(255, 255, 255, 0.9)";
                } else {
                    guiManager.rect1.thickness = 4;
                    guiManager.rect1.background = "rgba(255, 255, 255, 0.9)";
                    guiManager.rect2.thickness = 16;
                    guiManager.rect2.background = "rgba(255, 255, 20, 0.9)";
                }
            }
        }
    });

    scene.onKeyboardObservable.add((kbInfo) => {
        switch (kbInfo.type) {
            case BABYLON.KeyboardEventTypes.KEYDOWN:
                switch (kbInfo.event.key) {
                    case "Enter":
                    case " ":
                        // Toggle upMode with Enter or Space
                        upMode = !upMode;
                        moving = true;
                        break;

                    case "ArrowUp":
                        // Move only up with ArrowUp
                        moveUp();
                        break;

                    case "ArrowDown":
                        // Move only down with ArrowDown
                        moveDown();
                        break;
                }
                break;
        }
    });

    slideGestureDetector.onSlideDown(() => {
        moveDown();
    })

    slideGestureDetector.onSlideUp(() => {
        moveUp();
    })
    
    window.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

    return scene;
};

window.init = () => {
    guiManager = new GuiManager();

    scoreManager.init(scoreManagerModel, (updatedField, updatedOf) => {
        if (updatedField == "L") {
            scoreModel.value = (levelModel.value - 1 ) * 100;
        }

        if (updatedField == "K" && updatedOf > 0) {
            scoreModel.value += updatedOf;
        }
    });

    gameControlsManager.init("https://raw.githubusercontent.com/xMichal123/publictests/main/swordsmen-algebra-intro.webp",
        () => { 
            makeTasks();
            wheel.actionManager = wheelActionManager;
        },
        () => { restart(); },
        () => { },
        () => { }
    );

    gameOverManager.init(() => { restart(); });
}

    function moveDown() {
        moving |= upMode;
        upMode = false;
    }

    function moveUp() {
        moving |= !upMode;
        upMode = true;
    }

    function restart() {
        army1.soldiers.forEach((soldier1, index1) => {
            soldier1.release();
        });

        army2.soldiers.forEach((soldier2, index2) => {
            soldier2.release();
        });

        army2.soldiers = [];

        currentComplexity = 1;

        currentMaxSoldiers = initSoldiers;

        army1.addSoldiers(initSoldiers);

        modeSolving = false;

        killsModel.value = 0;
        levelModel.value = 1;
        scoreModel.value = 0;
    }

    function makeTasks() {
        modeSolving = true;

        task1 = generateMathTask(currentComplexity, getMaxAdd());
        sol1 = eval(task1);

        do {
            task2 = generateMathTask(currentComplexity, getMaxAdd());
            sol2 = eval(task2);
        } while (sol1 === sol2);

        guiManager.label1.text = formatMathTerm(task1, mathTermRowLength);
        guiManager.label2.text = formatMathTerm(task2, mathTermRowLength);

        let soldier = army1.getRightmostSoldier();

        guiPoint1.position = new BABYLON.Vector3(soldier.sprite.position.x + 6, 2, 0);
        guiPoint2.position = new BABYLON.Vector3(soldier.sprite.position.x + 6, -2, 0);

        fading = 1;

        guiManager.rect1.alpha = fading;
        guiManager.rect2.alpha = fading;


        currentComplexity += complexityStep;
    }


    function getMaxAdd() {
        return Math.max(maxSoldiers - army1.soldiers.length, 5);
    }

// Soldier class to encapsulate functionality
class Soldier {
    constructor(scene, spriteManager, position2D, flipped = false) {
        // Calculate 3D position with depth based on y position
        let x = position2D.x;
        let y = position2D.y;
        let z = y / zDepthDivisor;

        this.sprite = new BABYLON.Sprite("sprite", spriteManager);
        this.sprite.position = new BABYLON.Vector3(x, y, z);
        this.alive = true;

        // Optional flip
        if (flipped) {
            this.sprite.invertU = 1; // Flips horizontally
        }

        // Animation sequences
        this.animation1Frames = [0, 1, 2, 1]; // Walk animation
        this.animation2Frames = [3, 4, 5, 4, 5, 4, 5, 6, 7]; // Death animation
        this.frameIndex = 0;
        this.lastFrameTime = Date.now();
        this.fadeOut = false;
        this.animation1Active = true; // Starts with walk animation

        // Blink properties
        this.isBlinking = false;
        this.blinkDuration = 500; // Total blink duration in ms
        this.blinkInterval = 100; // Blink on/off interval in ms

        // Start update loop
        this.updateAnimation(scene);
    }

    // Blink animation
    blink() {
        this.isBlinking = true;
        let blinkEnd = Date.now() + this.blinkDuration;

        const toggleVisibility = () => {
            if (Date.now() < blinkEnd) {
                this.sprite.isVisible = !this.sprite.isVisible;
                setTimeout(toggleVisibility, this.blinkInterval);
            } else {
                this.sprite.isVisible = true; // Ensure it's visible at the end
                this.isBlinking = false;
            }
        };

        toggleVisibility();
    }

    // Update animation frames based on active animation
    updateAnimation(scene) {
        scene.onBeforeRenderObservable.add(() => {
            if (!this.isBlinking) {
                let now = Date.now();
                if (this.animation1Active && now - this.lastFrameTime >= spriteChangeInterval) {
                    this.sprite.cellIndex = this.animation1Frames[this.frameIndex % this.animation1Frames.length];
                    this.frameIndex++;
                    this.lastFrameTime = now;
                } else if (!this.animation1Active && !this.fadeOut && now - this.lastFrameTime >= spriteChangeInterval) {
                    if (this.frameIndex < this.animation2Frames.length) {
                        this.sprite.cellIndex = this.animation2Frames[this.frameIndex];
                        this.frameIndex++;
                        this.lastFrameTime = now;
                    } else {
                        this.fadeOut = true;
                        this.lastFrameTime = now;
                    }
                } else if (this.fadeOut && now - this.lastFrameTime >= spriteChangeInterval) {
                    this.sprite.color.a -= 0.02;
                    if (this.sprite.color.a <= 0) {
                        this.release();
                    }
                }
            }
        });
    }

    // Method to switch to death animation
    die() {
        this.alive = false;
        this.animation1Active = false;
        this.frameIndex = 0;
        this.sprite.color.a = 1;
    }

    // Method to move toward a target position
    moveToward(targetPosition) {
        let direction = targetPosition.subtract(this.sprite.position);
        let distance = direction.length();
        if (distance > soldierSpeed) {
            direction.normalize();
            this.sprite.position.addInPlace(direction.scale(soldierSpeed));
        } else {
            this.sprite.position = targetPosition;
        }
    }

    moveFront() {
        this.sprite.position.addInPlace(new BABYLON.Vector3(1, 0, 0).scale(soldierSpeed));
    }

    moveUp() {
        this.sprite.position.addInPlace(new BABYLON.Vector3(1, 4, 0).scale(soldierSpeed));
    }

    moveDown() {
        this.sprite.position.addInPlace(new BABYLON.Vector3(1, -4, 0).scale(soldierSpeed));
    }

    // Method to release the soldier (cleanup)
    release() {
        this.sprite.dispose();
    }
}

// Army class to manage multiple soldiers
class Army {
    constructor(scene, spriteManager, initialPosition, numSoldiers, flipped = false, radius = 1.5) {
        this.scene = scene;
        this.spriteManager = spriteManager;
        this.soldiers = [];
        this.initialPosition = initialPosition.clone();
        this.flipped = flipped;
        this.radius = radius;
        this.addSoldiers(numSoldiers); // Initialize with specified number of soldiers
    }

    // Add soldiers to the army in a densely packed horde around the initial position
    addSoldiers(num) {
        // Recalculate the center based on the average position of all active soldiers
        if (this.soldiers.length > 0) {
            let sumPosition = this.soldiers.reduce((sum, soldier) => {
                return sum.add(soldier.sprite.position);
            }, new BABYLON.Vector3(0, 0, 0));

            this.initialPosition = sumPosition.scale(1 / this.soldiers.length);
        }

        // Calculate starting layer based on current soldier count
        let existingSoldierCount = this.soldiers.length;
        let startingLayer = Math.ceil(Math.pow(existingSoldierCount, 1 / 4)) - 1;
        let totalAddedSoldiers = 0; // Track total added soldiers

        while (totalAddedSoldiers < num) {
            let layer = startingLayer + 1;
            let layerRadius = layer * this.radius; // Radius for the current layer

            // Calculate soldiers for this layer, adjusting dynamically for remaining soldiers
            let soldiersInThisLayer = Math.min(num - totalAddedSoldiers, layer * layer); // Increase with radius

            for (let j = 0; j < soldiersInThisLayer; j++) {
                let angle = (j / soldiersInThisLayer) * 2 * Math.PI - Math.PI / 2;
                let xOffset = (layerRadius * Math.cos(angle)) / 4; // Scale for compactness
                let yOffset = (layerRadius * Math.sin(angle)) / 8;

                let diff = Math.abs(Math.abs(xOffset) - Math.abs(yOffset));
                let opoDif = 1.5 - diff / 4;

                // Create a 2D position for the new soldier
                let position2D = new BABYLON.Vector2(this.initialPosition.x + opoDif * xOffset, this.initialPosition.y + opoDif * yOffset);

                // Create soldier and add to army
                let soldier = new Soldier(this.scene, this.spriteManager, position2D, this.flipped);
                soldier.blink();
                this.soldiers.push(soldier);
            }

            // Update count and layer
            totalAddedSoldiers += soldiersInThisLayer;
            startingLayer++;
        }
    }

    // Randomly select a soldier
    getRandomSoldier() {
        return this.soldiers.length > 0 ? this.soldiers[Math.floor(Math.random() * this.soldiers.length)] : null;
    }

    // Remove a soldier by index
    removeSoldier(index) {
        if (this.soldiers[index]) {
            this.soldiers[index].die();
            this.soldiers.splice(index, 1);
        }
    }

    // Find the rightmost alive soldier
    getRightmostSoldier() {
        return this.soldiers
            .filter(soldier => soldier.alive)
            .reduce((rightmost, soldier) => {
                return !rightmost || soldier.sprite.position.x > rightmost.sprite.position.x ? soldier : rightmost;
            }, null);
    }
}

function formatMathTerm(term, minLength) {
    let formatted = "";
    let lastBreak = 0;

    // Replace all * with x
    term = term.replace(/\*/g, "x");

    for (let i = 0; i < term.length; i++) {
        // Check if we have reached the end of a series of closing parentheses
        if (term[i] === ")" && (i === term.length - 1 || term[i + 1] !== ")") && i - lastBreak >= minLength) {
            // Find the end of closing parentheses series
            let endOfParentheses = i;
            while (term[endOfParentheses + 1] === ")") {
                endOfParentheses++;
            }

            // Slice up to the end of closing parentheses series
            formatted += term.slice(lastBreak, endOfParentheses + 1).trim() + "\n";
            lastBreak = endOfParentheses + 1;

            // Skip any spaces after the closing parentheses
            while (lastBreak < term.length && term[lastBreak] === " ") {
                lastBreak++;
            }
        }
    }

    // Add any remaining part of the term
    formatted += term.slice(lastBreak).trim();
    return "+ " + formatted;
}

function generateMathTask(complexity, solutionRange) {
  const operators = complexity >= 2.5 ? ['+', '-', '*', '/'] : complexity >= 1.75 ? ['+', '-', '*'] : complexity >= 1.5 ? ['+', '-'] : ['+'];

  // Helper function to generate random operands
  function getRandomOperand() {
    return Math.floor(Math.random() * complexity * 4);
  }

  // Helper function to recursively build an expression based on the desired complexity
  function buildExpression(currentComplexity) {
    if (currentComplexity <= 1) {
      // Base case: return a single operand when complexity is minimal
      return getRandomOperand().toString();
    }

    // Randomly split the complexity between the left and right operands
    const leftComplexity = Math.floor(Math.random() * (currentComplexity - 1)) + 1;
    const rightComplexity = currentComplexity - leftComplexity;

    const leftOperand = buildExpression(leftComplexity);
    const rightOperand = buildExpression(rightComplexity);
    const operator = operators[Math.floor(Math.random() * operators.length)];

    // Ensure division results in integers and avoid division by zero
    if (operator === '/' && parseInt(rightOperand) === 0) {
      return buildExpression(currentComplexity); // Retry if division is by zero
    }

    return `(${leftOperand} ${operator} ${rightOperand})`;
  }

  while (true) {
    const expression = buildExpression(complexity);
    let solution;

    try {
      solution = eval(expression); // Evaluate the generated expression
    } catch {
      continue; // If evaluation fails, try again
    }

    // Check if the solution is an integer and within the desired range
    if (Number.isInteger(solution) && solution > 0 && solution <= solutionRange) {
      console.log(`Math Task: ${expression} = ?`);
      console.log(`Solution: ${solution}`);
      return expression;
    }
  }
}


class GuiManager {
    constructor() {
        this.rect1 = new BABYLON.GUI.Rectangle();
        this.rect1.width = 0.4;
        this.rect1.height = 0.34;
        this.rect1.cornerRadius = 20;
        this.rect1.color = "Black";
        this.rect1.thickness = 4;
        this.rect1.background = "rgba(255, 255, 255, 0.9)";
        this.rect1.alpha = 0;
        advancedTexture.addControl(this.rect1);
        this.rect1.linkWithMesh(guiPoint1);

        this.label1 = new BABYLON.GUI.TextBlock();
        this.rect1.addControl(this.label1);

        this.rect1.isPointerBlocker = true;
        this.rect1.onPointerClickObservable.add(() => {
            moveUp();
        });
        
        this.rect2 = new BABYLON.GUI.Rectangle();
        this.rect2.width = 0.4;
        this.rect2.height = 0.34;
        this.rect2.cornerRadius = 20;
        this.rect2.color = "Black";
        this.rect2.thickness = 4;
        this.rect2.background = "rgba(255, 255, 255, 0.9)";
        this.rect2.alpha = 0;
        advancedTexture.addControl(this.rect2);
        this.rect2.linkWithMesh(guiPoint2);

        this.label2 = new BABYLON.GUI.TextBlock();
        this.rect2.addControl(this.label2);

        this.rect2.isPointerBlocker = true;
        this.rect2.onPointerClickObservable.add(() => {
            moveDown();
        });
    }
}

createScene();
