const levelModel = { initials: "L", name: "Max Level Reached", value: 1, color: "white" };
const trainsModel = { initials: "T", name: "Trains Plus/Minus", value: 0 };
const goodTrainsModel = { initials: "CD", name: "Correctly Dispatched", value: 0, color: "lightgreen" };
const wrongTrainsModel = { initials: "WD", name: "Wrongly Dispatched", value: 0, color: "red" };
const scoreModel = { initials: "S", name: "TOTAL SCORE", value: 0, color: "yellow", width: "200px", weight: "bold" };

const scoreManagerModel = [
    levelModel,
    trainsModel,
    scoreModel
];

const gameOverModel = [
    levelModel,
    goodTrainsModel,
    wrongTrainsModel,
    scoreModel
];

const railLength = 0.5;
const segmentsCount = 10;
const segmentLength = railLength / segmentsCount;
const trainSpeed = 0.005; // Speed of animation
const cameraRadius = 0.1;

const minX = 0;
const winX = 1.5;
const minSwitchX = 2;
const startXOffset = 3;

const failTrainPoints = -3;
const levelUpTrainPoints = 3;

let frameSpeed = trainSpeed;

let lastFrameTime = performance.now();

let scene = null;
let camera = null;
let box = null;
let advancedTexture = null;

let flagGenerator = null;
let countryFactory = null;
let railBuilder = null;
let trainFactory = null;
let trainDispatcher = null;
let cameraManager = null;
let winAnimator = null;
let tutorialManager = null;
let gameManager = null;

// Get a reference to the last interval + 1
const interval_id = window.setInterval(function(){}, Number.MAX_SAFE_INTEGER);

// Clear any timeout/interval up to that id
for (let i = 1; i < interval_id; i++) {
  window.clearInterval(i);
}

var createScene = async function () {
    scene = new BABYLON.Scene(engine);
    window.gameScene = scene;

    advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Create the FollowCamera
    camera = new BABYLON.FollowCamera("FollowCamera", new BABYLON.Vector3(3, 2, -4), scene);
    camera.radius = cameraRadius;
    camera.cameraAcceleration  = 0.015;

    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Flat ground with tiled texture (on the right)
    var flatGround = BABYLON.MeshBuilder.CreateGround("flatGround", {width: 50, height: 50}, scene);
    flatGround.position.x = 25;
    flatGround.position.y = -0.001;

    var flatGroundMaterial = new BABYLON.StandardMaterial("flatGroundMat", scene);
    flatGroundMaterial.diffuseTexture = new BABYLON.Texture("textures/sand.jpg", scene); // Replace with your texture path
    flatGroundMaterial.diffuseTexture.uScale = 10; // Tiling
    flatGroundMaterial.diffuseTexture.vScale = 10;
    flatGround.material = flatGroundMaterial;

    // Ground from height map (on the left)
    var heightMapGround = BABYLON.MeshBuilder.CreateGroundFromHeightMap("heightMapGround", 
        "https://raw.githubusercontent.com/xMichal123/publictests/main/bw-map.png", 
        {width: 10, height: 50, subdivisions: 20, minHeight: 0, maxHeight: 2}, 
        scene);
    heightMapGround.position.x = -4;
    heightMapGround.position.y = -0.1;

    var heightMapMaterial = new BABYLON.TerrainMaterial("heightMapMat", scene);
    heightMapMaterial.mixTexture = new BABYLON.Texture("https://raw.githubusercontent.com/xMichal123/publictests/main/rgb-map.png", scene); // Replace with your texture map path
        
    heightMapMaterial.diffuseTexture1 = new BABYLON.Texture("textures/sand.jpg", scene);
    heightMapMaterial.diffuseTexture3 = new BABYLON.Texture("textures/grass.png", scene);
    heightMapMaterial.diffuseTexture2 = new BABYLON.Texture("textures/rock.png", scene);
    
	// Bump textures according to the previously set diffuse textures
    //terrainMaterial.bumpTexture1 = new BABYLON.Texture("textures/floor_bump.png", scene);
    heightMapMaterial.bumpTexture3 = new BABYLON.Texture("textures/grassn.png", scene);
    heightMapMaterial.bumpTexture2 = new BABYLON.Texture("textures/rockn.png", scene);
   
    // Rescale textures according to the terrain
    heightMapMaterial.diffuseTexture1.uScale = heightMapMaterial.diffuseTexture1.vScale = 10;
    heightMapMaterial.diffuseTexture2.uScale = heightMapMaterial.diffuseTexture2.vScale = 10;
    heightMapMaterial.diffuseTexture3.uScale = heightMapMaterial.diffuseTexture3.vScale = 10;

    heightMapGround.material = heightMapMaterial;

    // Box dimensions
    const boxWidth = 1;
    const boxHeight = 1;
    const boxDepth = 1;

    // Create the invisible box
    box = BABYLON.MeshBuilder.CreateBox("box", { width: boxWidth, height: boxHeight, depth: boxDepth }, scene);
    box.position = new BABYLON.Vector3(2.5, 0, 0);
    box.rotation.y = Math.PI
    box.isVisible = false; // Make the box invisible

    camera.lockedTarget = box; // Lock camera to the box

    tutorialManager = new TutorialManager();
    cameraManager = new CameraManager();
    flagGenerator = new FlagGenerator();
    countryFactory = new CountryFactory();
    winAnimator = new WinAnimator();

    railBuilder = new RailBuilder();

    railBuilder.initRailway();

    for (let i = 0; i < 1; i++) {
        railBuilder.addRailway();
    }

    trainFactory = await TrainFactory.create();
    trainDispatcher = new TrainDispatcher();

    gameManager = new GameManager();

    // Watch for browser/canvas resize events
    window.addEventListener('resize', function() {
        engine.resize();
        cameraManager.manage();
    });

    return scene;
};

window.init = () => {
    scoreManager.init(scoreManagerModel, (updatedField, updatedOf) => {
        if (updatedField == "L") {
            scoreModel.value += 10 * Math.pow(2, levelModel.value);
        }

        if (updatedField == "T" && updatedOf > 0) {
            scoreModel.value += updatedOf * Math.pow(2, levelModel.value);
        }
    });

    gameControlsManager.init("https://raw.githubusercontent.com/xMichal123/mall-games/main/train-dispatcher/intro.webp",
        () => { gameManager.start(true); },
        () => { gameManager.restart(); },
        () => { trainDispatcher.pause(); },
        () => { trainDispatcher.resume(); }
    );

    gameOverManager.init(() => { gameManager.restart(); });
}

const RailNodeType = {
  STRAIGHT: 1,
  LEFT: 2,
  RIGHT: 3,
};

class TutorialManager {
    constructor() {
        this._pendingHint = true;
        // Add a sprite manager
        var spriteManager = new BABYLON.SpriteManager("spriteManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/hand.png", 1, {width: 83, height: 146}, scene);

        // Create a sprite
        this._sprite = new BABYLON.Sprite("sprite", spriteManager);
        this._sprite.position = new BABYLON.Vector3(minSwitchX + 3 * railLength / 4, 0, 0); // Starting position
        this._sprite.invertU = true;
        this._sprite.invertV = true;
        const scale = 0.5;
        this._sprite.width = 0.57 * scale;
        this._sprite.height = scale;
        this._sprite.isVisible = false;

        // Create the animation
        this.createSmoothUpDownAnimation(this._sprite, 0.7, 0.2); // Start from y=1 and move smoothly up/down by 2 units
    }

    // Function to create the up-and-down animation using sine wave
    createSmoothUpDownAnimation(sprite, point, length) {
        var frameRate = 60;
        var animation = new BABYLON.Animation("smoothUpDown", "position.y", frameRate, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);

        // Define animation keys
        var keys = [];
        for (var i = 0; i <= frameRate; i++) {
            var frame = i;
            var value = point + length * Math.sin((i / frameRate) * 2 * Math.PI); // Sine wave for smooth motion
            keys.push({ frame: frame, value: value });
        }

        animation.setKeys(keys);

        // Attach animation to the sprite
        this._sprite.animations.push(animation);

        // Start the animation
        scene.beginAnimation(this._sprite, 0, frameRate, true, 0.4);
    }

    switched() {
        if (this._pendingHint) {
            trainDispatcher.resume();

            this._sprite.dispose();
        }

        this._pendingHint = false;
    }

    tryHint(train) {
        if (this._pendingHint && train.position.x - 2 * railLength <= minSwitchX) {

            trainDispatcher.pause();

            this._sprite.isVisible = true;
        }
    }
}

class WinAnim {
    constructor(sprite) {
        this.sprite = sprite;
        this.fadeInTime = 1000; // 1 second
        this.visibleTime = 3000; // 3 seconds
        this.fadeOutTime = 1000; // 1 second
        this.totalTime = this.fadeInTime + this.visibleTime + this.fadeOutTime;
        this.elapsedTime = 0;
    }

    animate() {
        const deltaTime = scene.getEngine().getDeltaTime();
        this.elapsedTime += deltaTime;

        if (this.elapsedTime < this.fadeInTime) {
            // Fade in
            this.sprite.color.a = this.elapsedTime / this.fadeInTime;
        } else if (this.elapsedTime < this.fadeInTime + this.visibleTime) {
            // Fully visible
            this.sprite.color.a = 1;
        } else if (this.elapsedTime < this.totalTime) {
            // Fade out
            const fadeOutElapsed = this.elapsedTime - this.fadeInTime - this.visibleTime;
            this.sprite.color.a = 1 - (fadeOutElapsed / this.fadeOutTime);
        } else {
            // Animation complete
            this.sprite.dispose();

            return false;
        }

        return true;
    }
}

class WinAnimator {
    constructor() {
        this._checkmarkManager = new BABYLON.SpriteManager("checkmarkManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/checkmark.png", 1, { width: 66, height: 66 }, scene);
        this._crossmarkManager = new BABYLON.SpriteManager("crossmarkManager", "https://raw.githubusercontent.com/xMichal123/publictests/main/crossmark.png", 1, { width: 66, height: 66 }, scene);
        this._anims = [];

        scene.onBeforeRenderObservable.add(() => {
            this._anims = this._anims.filter(anim => anim.animate());
        });
    }

    _createSprite(position, spriteManager) {
        const sprite = new BABYLON.Sprite("mark", spriteManager);
        sprite.width = 0.5;
        sprite.height = 0.5;
        sprite.position = position.clone();
        sprite.position.y += 0.3;
        sprite.color = new BABYLON.Color4(1, 1, 1, 0); // Start fully transparent
        return sprite;
    }

    win(position) {
        const sprite = this._createSprite(position, this._checkmarkManager);
        this._anims.push(new WinAnim(sprite, this.scene));
    }

    lose(position) {
        const sprite = this._createSprite(position, this._crossmarkManager);
        this._anims.push(new WinAnim(sprite, this.scene));
    }
}

class CameraManager {
    constructor() {
        this.targetPosition = null; // Target position for smooth movement
        this.currentLerpTime = 0;   // Current interpolation time
        this.totalLerpTime = 30;  // Total time for the transition (seconds)

        scene.registerBeforeRender(() => {
            if (this.targetPosition) {
                // Smoothly interpolate the box position towards the target position
                if (this.currentLerpTime < this.totalLerpTime) {
                    this.currentLerpTime += scene.getEngine().getDeltaTime() / 1000; // Convert to seconds
                    const t = this.currentLerpTime / this.totalLerpTime; // Normalized time
                    const easedT = this.easeInOutCubic(t); // Apply easing
                    box.position = BABYLON.Vector3.Lerp(box.position, this.targetPosition, easedT);
                }
            }
        });
    }

    setTarget(target) {
        this.targetPosition = target;
        this.currentLerpTime = 0;
    }

    // Easing function for smooth acceleration and deceleration
    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t // Ease in
            : 1 - Math.pow(-2 * t + 2, 3) / 2; // Ease out
    }

    manage() {
        const rightPoint = new BABYLON.Vector3(railBuilder._maxSwitchX + startXOffset, 0, 0);
        //const leftPoint = new BABYLON.Vector3(minX, 0, railBuilder._minZ);
        const leftPoint = new BABYLON.Vector3(minX, 0, (railBuilder._maxZ + railBuilder._minZ) / 2);
        const midPoint = BABYLON.Vector3.Center(leftPoint, rightPoint);

        //const direction = rightPoint.subtract(leftPoint).normalize();
        //const up = new BABYLON.Vector3(0, 1, 0);
        //const right = BABYLON.Vector3.Cross(up, direction).normalize();

        this.setTarget(midPoint);
        //box.position = new BABYLON.Vector3(2, 0, 0);
        //box.rotation = new BABYLON.Vector3(0, Math.atan2(right.z, right.x) - Math.PI / 2, 0);

        const distance = BABYLON.Vector3.Distance(leftPoint, rightPoint);
        
        // Compute the bounding sphere radius
        const boundingRadius = distance / 2; // Radius to cover both points
        const viewport = engine.getRenderWidth() / engine.getRenderHeight();
        
        // Adjust camera radius based on the viewport aspect ratio
        const padding = 2.4; // Add some padding to ensure points are comfortably visible

        let radius = 0;
        //if (viewport > 1) {
            // Landscape orientation: width is more limiting
            radius = boundingRadius * padding / viewport;
        /*} else {
            // Portrait orientation: height is more limiting
            radius = boundingRadius * padding;
        }*/
        
        //camera.radius /= 1.2;

        // Adjust the height offset to center points
        //camera.heightOffset = Math.max(radius - cameraRadius, 2) * 1;
        const diff = railBuilder._maxZ - railBuilder._minZ;

        // Define ranges for diff to control the transition
        const minDiff = -3;   // Minimum diff value (small range)
        const maxDiff = 3;  // Maximum diff value (large range)

        // Normalize diff to a range between 0 and 1 for smooth interpolation
        const t = Math.min(1, Math.max(0, (diff - minDiff) / (maxDiff - minDiff)));

        // Interpolate between the two modes using t
        const smoothRadius = radius * (1 - t) + (1 / radius) * t;
        const smoothHeightOffset = (1 / radius) * (1 - t) + radius * t;

        // Apply the interpolated values
        camera.heightOffset = smoothHeightOffset;
        camera.radius = Math.max(smoothRadius, 1);
    }
}

class GameManager {
    constructor() {
        trainsModel.value = 0;
        goodTrainsModel.value = 0;
        wrongTrainsModel.value = 0;
        levelModel.value = 1;

        this.lost = false;

        scene.registerBeforeRender(() => {
            if (trainsModel.value >= levelUpTrainPoints) {
                trainsModel.value = 0;
                levelModel.value++;
                railBuilder.addRailway();
            }

            if (!this.lost && trainsModel.value <= failTrainPoints) {
                trainDispatcher.stop();

                gameOverManager.popup(gameOverModel);

                this.lost = true;
            }

            const currentFrameTime = performance.now();

            // Delta time in seconds
            const deltaTime = (currentFrameTime - lastFrameTime) / 1000;

            // Update the last frame time
            lastFrameTime = currentFrameTime;

            if (!this._paused && !trainDispatcher.paused) {
                // Adjust the speed for this frame
                frameSpeed = (trainSpeed * deltaTime * 60 + 4 * frameSpeed) / 5;
            }

            if (!trainDispatcher.paused) {
                this._paused = false;
            }
        });
    }

    setPaused() {
        this._paused = true;
    }

    start(first = false) {
        trainDispatcher.start(first);
    }

    restart() {
        this.lost = false;

        countryFactory.reset();
        flagGenerator.reset();

        railBuilder.clear();
        railBuilder.initRailway();

        railBuilder.addRailway();

        trainDispatcher.clear();

        trainsModel.value = 0;
        goodTrainsModel.value = 0;
        wrongTrainsModel.value = 0;
        levelModel.value = 1;
        scoreModel.value = 1;

        this.start();
    }

    win(position) {
        trainsModel.value++;
        goodTrainsModel.value++;
        winAnimator.win(position);
    }

    lose(position) {
        trainsModel.value--;
        wrongTrainsModel.value++;
        winAnimator.lose(position);
    }
}

class RailNode {
    constructor(path, startPosition, startDirection, mesh, type) {
        this._path = path; // Path array for this segment
        this._startPosition = startPosition.clone();
        this._startDirection = startDirection.clone();
        this._mesh = mesh;
        this._type = type;

        this.children = []; // Child nodes (used for switches)
        this.activeChildIndex = 0; // For switches, index of the active child
        this._switchPaths = [];
        this._switchMeshes = [];
    }

    // Computed property: Determine if this node is a switch
    get isSwitch() {
        return this.children.length > 1;
    }

    get startPosition() {
        return this._startPosition;
    }

    get endPosition() {
        return this._path[this._path.length - 1];
    }

    get startDirection() {
        return this._startDirection;
    }

    get mesh() {
        return this._mesh;
    }

    get type() {
        return this._type;
    }

    get path() {
        return this._path;
    }

    get switchToPath() {
        return this._switchPaths[this.activeChildIndex];
    }

    addSwitchPath(path) {
        this._switchPaths.push(path);
    }

    addSwitchMesh(mesh) {
        this._switchMeshes.push(mesh);
    }

    // Get the next node (active child)
    getNextNode() {
        if (this.children.length > 0) {
            return this.children[this.activeChildIndex];
        }
        
        return null; // No more children
    }

    // Add a child node
    addChild(childNode) {
        this.children.push(childNode);
        return childNode;
    }

    // Toggle between children (only meaningful for switches)
    toggleSwitch() {
        this.activeChildIndex = (this.activeChildIndex + 1) % this.children.length;

        tutorialManager.switched();
    }

    clear() {
        this._mesh.dispose();
        this._mesh = null;

        for (let mesh of this._switchMeshes) {
            mesh.dispose();
        }

        this._switchMeshes = [];
    }
}

class RailBuilder {
    constructor() {
        this._railMaterial = new BABYLON.StandardMaterial("railMaterial", scene);
        
        const railTexture = new BABYLON.Texture("https://raw.githubusercontent.com/xMichal123/publictests/main/rail_vert.png", scene);

        railTexture.uScale = 3.35;
        railTexture.vScale = 5.66;
        railTexture.hasAlpha = true;

        this._railMaterial.diffuseTexture = railTexture;
        this._transMat = this._railMaterial.clone("transMat");
        this._transMat.alpha = 0.3;

        this._railProfile = [
            new BABYLON.Vector3(-0.05, 0, 0),
            new BABYLON.Vector3(0.05, 0, 0),
            new BABYLON.Vector3(0, -0.1, 0),
            new BABYLON.Vector3(-0.05, 0, 0)
        ];

        this._tunnels = [];
    }

    get initRailNode() {
        return this._initRail;
    }

    initRailway() {
        this._maxSwitchX = 0;

        this._minZ = 0;
        this._maxZ = 0;
        this._railMap = new Map();

        this.currentPosition = new BABYLON.Vector3(50, 0, 0);
        this.currentDirection = new BABYLON.Vector3(-1, 0, 0);

        this._initRail = this.createRailNode(RailNodeType.STRAIGHT);
        this._railMap.set(this.currentPosition.x, this._initRail);

        this.makeStraightRailway(this._initRail, () => { return this.currentPosition.x > minX; });

        this.addTunnel();
    }
    
    addRailway() {
        this._railMap = new Map([...this._railMap.entries()].sort((a, b) => a[0] - b[0]));

        let nearestRail = null;

        do {
            const key = this._railMap.keys().next().value;
            nearestRail = this._railMap.get(key);
            this._railMap.delete(key);
        } while (nearestRail.endPosition.x < minSwitchX);

        this.makeSwitch(nearestRail);

        let currentRail = nearestRail;

        currentRail = this.makeStraightRailway(currentRail, () => { return this.currentPosition.z > this._minZ && this.currentPosition.z < this._maxZ });

        currentRail = this.addCurve(currentRail);

        this.makeStraightRailway(currentRail, () => { return this.currentPosition.x > minX; });

        cameraManager.manage();

        return this.addTunnel();
    }

    addTunnel() {
        const country = countryFactory.add(this.currentPosition.z);

        const myPath = [
		 	new BABYLON.Vector3(0, 0.06, this.currentPosition.z),
			new BABYLON.Vector3(1.3, 0.06, this.currentPosition.z)
	    ];
	
	    const tube = BABYLON.MeshBuilder.CreateTube("tube", {path: myPath, radius: 0.11, sideOrientation: BABYLON.Mesh.DOUBLESIDE,updatable:true}, scene);
        tube.material = new BABYLON.StandardMaterial("ballMaterial");
        
        let flagTexture = country.texture.clone();

        flagTexture.uScale = -5;
        flagTexture.vScale = 5;
        flagTexture.wAng = -Math.PI / 2;

        tube.material.diffuseTexture = flagTexture;

        this._tunnels.push(tube);

        return flagTexture;
    }

    createRailNode(type) {
        let startPos = this.currentPosition;
        let startDirection = this.currentDirection;
        let path = null;

        switch (type) {
        case RailNodeType.STRAIGHT:
            path = this.addStraight();
            break;
        case RailNodeType.LEFT:
            path = this.addLeft();
            break;
        case RailNodeType.RIGHT:
            path = this.addRight();
            break;
        }

        const mesh = this.createRailSegment(path);

        this._minZ = Math.min(this._minZ, this.currentPosition.z);
        this._maxZ = Math.max(this._maxZ, this.currentPosition.z);
        
        return new RailNode(path, startPos, startDirection, mesh, type);
    }

    createRailSegment(path, trans = false) {
        const mesh = BABYLON.MeshBuilder.ExtrudeShape('rail', {
            shape: this._railProfile,
            path: path,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
            cap: BABYLON.Mesh.CAP_ALL
        }, scene);

        if (trans) {
            mesh.material = this._transMat;
            mesh.position.y = 0.0005;
        } else {
            mesh.material = this._railMaterial;
        }

        return mesh;
    }

    addCurve(railFrom) {
        let newRail = this.createRailNode(this.currentPosition.z > 0 ? RailNodeType.LEFT : RailNodeType.RIGHT);

        railFrom.addChild(newRail);

        this._railMap.set(this.currentPosition.x, newRail); // TODO remove or not?

        return newRail;
    }

    makeStraightRailway(railFrom, whileCond) {
        let currentRail = railFrom;

        while (whileCond()) {
            let newRail = this.createRailNode(RailNodeType.STRAIGHT);

            currentRail.addChild(newRail);

            if (this.currentDirection.x < - 0.9) {
                this._railMap.set(this.currentPosition.x, newRail);
            }

            currentRail = newRail;
        }

        return currentRail;
    }

    // Calculate the direction of the switched segment (straightened)
    calculateSwitchDirection(segment) {
        const lastPoint = segment[segment.length - 1];
        const secondLastPoint = segment[segment.length - 2];
        return lastPoint.subtract(secondLastPoint).normalize();
    }

    makeSwitch(railNode) {
        this.currentPosition = railNode.startPosition;
        this.currentDirection = railNode.startDirection;

        this._maxSwitchX = Math.max(this._maxSwitchX, railNode.startPosition.x);

        let firstPath = null;
        let secondPath = null;
        
        if (railNode.type == RailNodeType.STRAIGHT) {
            let left = false;
            if (railNode.startDirection.x < -0.9 && Math.abs(railNode.startPosition.z) < 0.01) {
                left = Math.random() < 0.5;
            } else if (railNode.startDirection.x < -0.9) {
                left = railNode.startPosition.z < 0;
            } else {
                left = railNode.startDirection.z > 0;
            }

            firstPath = this.addStraight();

            this.currentPosition = railNode.startPosition;
            this.currentDirection = railNode.startDirection;

            if (left) {
                secondPath = this.addLeft();
            } else {
                secondPath = this.addRight();
            }
        } else {
            if (railNode.type == RailNodeType.LEFT) {
                firstPath = this.addLeft();
            } else {
                firstPath = this.addRight();
            }

            this.currentPosition = railNode.startPosition;
            this.currentDirection = railNode.startDirection;

            secondPath = this.addStraight();
        }

        let switchMesh1 = this.createRailSegment(firstPath, true);
        let switchMesh2 = this.createRailSegment(secondPath, true);

        railNode.addSwitchPath(firstPath);
        railNode.addSwitchPath(secondPath);

        railNode.addSwitchMesh(switchMesh1);
        railNode.addSwitchMesh(switchMesh2);

        const actionManager = new BABYLON.ActionManager(scene);

        const helpThis = this;
        // Add a click event to the sphere
        actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                railNode.toggleSwitch();
                helpThis.animateNode(railNode);
            })
        );

        switchMesh1.actionManager = actionManager;
        switchMesh2.actionManager = actionManager;
    }

    addStraight() {
        const path = [];
        for (let i = 0; i <= segmentsCount; i++) {
            path.push(this.currentPosition.add(this.currentDirection.scale(segmentLength * i)));
        }
        this.currentPosition = path[path.length - 1];
        return path;
    }

    addCurved(arcLength, radius = 1) {
        const path = [];
        const center = this.currentPosition.add(this.currentDirection.cross(new BABYLON.Vector3(0, Math.sign(arcLength), 0)).scale(radius));
        const startAngle = Math.atan2(this.currentPosition.z - center.z, this.currentPosition.x - center.x);
        const angle = arcLength / radius; // Calculate angle from arc length
        const step = angle / segmentsCount;

        for (let i = 0; i <= segmentsCount; i++) {
            const theta = startAngle + i * step;
            const x = center.x + radius * Math.cos(theta);
            const z = center.z + radius * Math.sin(theta);
            path.push(new BABYLON.Vector3(x, this.currentPosition.y, z));
        }

        this.currentPosition = path[path.length - 1];

        // Update currentDirection based on the tangent at the end of the curve
        const lastPoint = path[path.length - 1];
        const secondLastPoint = path[path.length - 2];
        this.currentDirection = lastPoint.subtract(secondLastPoint).normalize();

        return path;
    }

    addLeft() {
        return this.addCurved(railLength);
    }

    addRight() {
        return this.addCurved(-railLength);
    }

    animateNode(railNode) {
        if (this.animationActive) return; // Prevent overlapping animations

        this.animationActive = true;
        const startPath = railNode.path.slice(); // Current path of the node

        const endPath = railNode.switchToPath;

        let animationFrame = 0;
        const totalFrames = 30;

        const helpThis = this;
        scene.registerBeforeRender(() => {
            if (animationFrame > totalFrames) {
                helpThis.animationActive = false;

                railNode._path = endPath.slice();

                return;
            }

            const t = animationFrame / totalFrames;

            // Animate all points of the path
            for (let i = 0; i < railNode._path.length; i++) {
                railNode._path[i] = BABYLON.Vector3.Lerp(startPath[i], endPath[i], t);
            }

            // Recreate the mesh with the updated path
            railNode.mesh.dispose();
            railNode._mesh = helpThis.createRailSegment(railNode._path);
            railNode._mesh.material = helpThis._railMaterial;

            animationFrame++;
        });
    }

    clear() {
        this.clearRecursive(this._initRail);

        for (let child of this._tunnels) {
            child.dispose();
        }

        this._tunnels = [];
    }

    clearRecursive(rail) {
        rail.clear();

        for (let child of rail.children) {
            this.clearRecursive(child);
        }
    }
}

class Country {
    constructor(texture, posZ) {
        this._texture = texture;
        this._posZ = posZ;
    }

    get posZ() {
        return this._posZ;
    }

    get texture() {
        return this._texture;
    }
}

class CountryFactory {
    constructor() {
        this._countries = [];
    }

    add(posZ) {
        const texture = flagGenerator.getTexture();
        const country = new Country(texture, posZ);

        this._countries.push(country);

        return country;
    }

    getRandom() {
        return this._countries[Math.round(Math.random() * (this._countries.length - 1))];
    }

    getFirst() {
        return this._countries[1];
    }

    reset() {
        this._countries = [];
    }
}

class TrainDispatcher {
    constructor() {
        this._dispatches = [];
        this._intervalDuration = 7000; // Interval duration in milliseconds
        this._lastDispatchTime = null; // Timestamp of the last train dispatch
        this._isPaused = 0;
        this._gapStart = null;
        this._gapDuration = 0;
        this._isStopped = true;

        scene.registerBeforeRender(() => {
            if (this._isPaused === 0) {
                let i = 0;
                while (i < this._dispatches.length) {
                    if (!this._dispatches[i].move()) {
                        let deleted = this._dispatches.splice(i, 1); // Remove the current element
                        deleted[0].stop();
                    } else {
                        i++; // Increment index only when no deletion
                    }
                }

                if (!this._isStopped) {
                    this.checkAndDispatchTrain();
                }
            }
        });
    }

    get paused() {
        return this._isPaused > 0;
    }

    start(first = false) {
        this._isStopped = false;
        this._lastDispatchTime = performance.now(); // Use high-precision timer

        this.dispatchTrain(first);

        this.resume();
    }

    dispatchTrain(first = false) {
        const train = trainFactory.pop(first);
        const traveler = new TrainTraveler(train);
        this._dispatches.push(traveler);

        // Update last dispatch time
        this._lastDispatchTime = performance.now();
    }

    checkAndDispatchTrain() {
        const currentTime = performance.now();
        if (currentTime - this._lastDispatchTime - this._gapDuration >= this._intervalDuration) {
            this.dispatchTrain();
            this._gapDuration = 0;
        }
    }

    pause() {
        if (this._isPaused === 0) {
            this._gapStart = performance.now();
            this._lastFrameSpeed = frameSpeed;

            gameManager.setPaused();
        }

        this._isPaused++;
    }

    resume() {
        if (this._isPaused > 0) {
            this._isPaused--;

            if (this._isPaused === 0 && this._gapStart) {
                this._gapDuration = performance.now() - this._gapStart;
                frameSpeed = this._lastFrameSpeed;
            }
        }
    }

    stop() {
        this._isStopped = true;
    }

    clear() {
        for (let traveler of this._dispatches) {
            traveler.stop();
        }

        this._dispatches = [];
        this._gapStart = null;
   }
}

class TrainTraveler {
    constructor(train) {
        this._currentNode = railBuilder.initRailNode;
        this._currentPath = this._currentNode.path;
        this._train = train;
        this._distanceTraveled = 0;
        this._won = false;
    }

    move() {
        this._distanceTraveled += frameSpeed;

        // Loop back if the train completes the path
        if (this._distanceTraveled > railLength) {
            this._distanceTraveled = 0;
            this._currentNode = this._currentNode.getNextNode(); // Switch to next node or loop back

            if (this._currentNode === null) {
                return false;
            }

            while (this._currentNode.startPosition.x > railBuilder._maxSwitchX + startXOffset) {
                this._currentNode = this._currentNode.getNextNode();
            }

            this._currentPath = this._currentNode.path;
        }

        // Determine the current segment and position on the path
        let cumulativeLength = 0;
        let segmentIndex = 0;

        while (segmentIndex < segmentsCount && cumulativeLength + segmentLength < this._distanceTraveled) {
            cumulativeLength += segmentLength;
            segmentIndex++;
        }

        if (segmentIndex < segmentsCount) {
            const localDistance = this._distanceTraveled - cumulativeLength;
            const fraction = localDistance / segmentLength;

            const startPosition = this._currentPath[segmentIndex];
            const endPosition = this._currentPath[segmentIndex + 1];
            const position = BABYLON.Vector3.Lerp(startPosition, endPosition, fraction);

            // Update ball position
            this._train.position = position;

            if (!this._won && position.x <= winX) {
                this._won = true;

                if (Math.abs(this._train.country.posZ - position.z) < 0.01) {
                    gameManager.win(position);
                } else {
                    gameManager.lose(position);
                }
            }

            // Calculate direction vector
            const direction = endPosition.subtract(startPosition).normalize();

            // Calculate quaternion rotation around Y axis
            const yaw = Math.atan2(direction.x, direction.z);
            const rotation = BABYLON.Quaternion.RotationYawPitchRoll(yaw, 0, 0);

            // Update train rotation
            this._train.rotationQuaternion = rotation;
        }

        tutorialManager.tryHint(this._train);

        return true;
    }

    stop() {
        this._train.position = new BABYLON.Vector3(minX, 0, 0);
        trainFactory.release(this._train);
    }
}

class Train {
    constructor(mesh) {
        this._mesh = mesh;
    }

    set position(position) {
        this._mesh.position = position;
        this._mesh.position.y = 0.07;
    }

    get position() {
        return this._mesh.position;
    }

    set rotationQuaternion(quaternion) {
        this._mesh.rotationQuaternion = quaternion;
    }

    set texture(texture) {
        for (let mesh of this._mesh.getChildMeshes()) {
            if (mesh.material && mesh.material.name === 'Flag') {
                mesh.material = mesh.material.clone();//new BABYLON.PBRMaterial('Flag');
                mesh.material.albedoTexture = texture;
                mesh.material.name = 'Flag';
            }
        }
    }

    set country(country) {
        this._country = country;
        this.texture = country.texture;
    }

    get country() {
        return this._country;
    }
}

class TrainFactory {
    constructor(origMesh) {
        this._freeTrains = [];
        this._origMesh = origMesh;
    }

    static async create(scene) {
        let results = await BABYLON.SceneLoader.ImportMeshAsync("", "https://raw.githubusercontent.com/xMichal123/publictests/main/train.glb", "", scene);
        let meshes = results.meshes;

        meshes[0].scaling = new BABYLON.Vector3(-0.05, 0.05, 0.05);

        // Set up the rotation quaternion
        const rotationQuaternion = BABYLON.Quaternion.RotationAxis(
            BABYLON.Axis.Y, // Y-axis
            -Math.PI / 2     // Rotation angle (PI/2 radians)
        );

        // Apply the quaternion to the mesh
        meshes[0].rotationQuaternion = rotationQuaternion;

        const factory = new TrainFactory(meshes[0]);
        factory._freeTrains.push(new Train(meshes[0]));

        return factory;
    }

    pop(first = false) {
        let train = null;
        if (this._freeTrains.length > 0) {
            train = this._freeTrains.splice(0, 1)[0];
        } else {
            train = new Train(this._origMesh.clone());
        }

        const country = first ? countryFactory.getFirst() : countryFactory.getRandom();

        train.country = country;

        return train;
    }

    release(train) {
        this._freeTrains.push(train);
    }
}

class FlagGenerator {
    constructor() {
        this.countryCodesInitial = [
  'af', 'ax', 'al', 'dz', 'as', 'ad', 'ao', 'ai', 'aq', 'ag', 'ar', 'am', 'aw', 'au', 'at', 'az',
  'bs', 'bh', 'bd', 'bb', 'by', 'be', 'bz', 'bj', 'bm', 'bt', 'bo', 'bq', 'ba', 'bw', 'bv', 'br',
  'io', 'bn', 'bg', 'bf', 'bi', 'cv', 'kh', 'cm', 'ca', 'ky', 'cf', 'td', 'cl', 'cn', 'cx', 'cc',
  'co', 'km', 'cg', 'cd', 'ck', 'cr', 'ci', 'hr', 'cu', 'cw', 'cy', 'cz', 'dk', 'dj', 'dm', 'do',
  'ec', 'eg', 'sv', 'gq', 'er', 'ee', 'sz', 'et', 'fk', 'fo', 'fj', 'fi', 'fr', 'gf', 'pf', 'tf',
  'ga', 'gm', 'ge', 'de', 'gh', 'gi', 'gr', 'gl', 'gd', 'gp', 'gu', 'gt', 'gg', 'gn', 'gw', 'gy',
  'ht', 'hm', 'va', 'hn', 'hk', 'hu', 'is', 'in', 'id', 'ir', 'iq', 'ie', 'im', 'il', 'it', 'jm',
  'jp', 'je', 'jo', 'kz', 'ke', 'ki', 'kp', 'kr', 'kw', 'kg', 'la', 'lv', 'lb', 'ls', 'lr', 'ly',
  'li', 'lt', 'lu', 'mo', 'mg', 'mw', 'my', 'mv', 'ml', 'mt', 'mh', 'mq', 'mr', 'mu', 'yt', 'mx',
  'fm', 'md', 'mc', 'mn', 'me', 'ms', 'ma', 'mz', 'mm', 'na', 'nr', 'np', 'nl', 'nc', 'nz', 'ni',
  'ne', 'ng', 'nu', 'nf', 'mp', 'no', 'om', 'pk', 'pw', 'ps', 'pa', 'pg', 'py', 'pe', 'ph', 'pn',
  'pl', 'pt', 'pr', 'qa', 're', 'ro', 'ru', 'rw', 'bl', 'sh', 'kn', 'lc', 'mf', 'pm', 'vc', 'ws',
  'sm', 'st', 'sa', 'sn', 'rs', 'sc', 'sl', 'sg', 'sx', 'sk', 'si', 'sb', 'so', 'za', 'gs', 'ss',
  'es', 'lk', 'sd', 'sr', 'sj', 'se', 'ch', 'sy', 'tw', 'tj', 'tz', 'th', 'tl', 'tg', 'tk', 'to',
  'tt', 'tn', 'tr', 'tm', 'tc', 'tv', 'ug', 'ua', 'ae', 'gb', 'us', 'um', 'uy', 'uz', 'vu', 've',
  'vn', 'vg', 'vi', 'wf', 'eh', 'ye', 'zm', 'zw'
        ];

        this.availableCountryCodes = [...this.countryCodesInitial];
    }

    // Get a random country code that hasn't been used yet
    getRandomFlag() {
        if (this.availableCountryCodes.length === 0) {
            throw new Error("No more flags available. Reset the generator.");
        }

        const randomIndex = Math.floor(Math.random() * this.availableCountryCodes.length);
        const selectedCode = this.availableCountryCodes.splice(randomIndex, 1)[0];
        return selectedCode;
    }

    // Reset the generator to reuse all country codes
    reset() {
        this.availableCountryCodes = [...this.countryCodesInitial];
    }

    // Get a Babylon.js texture for a random flag
    getTexture() {
        const countryCode = this.getRandomFlag();
        const texturePath = `https://raw.githubusercontent.com/xMichal123/publictests/main/flags/${countryCode}.png`;
        const texture = new BABYLON.Texture(texturePath, scene);
        texture.vScale = -1;

        return texture;
    }
}

createScene();
