'use strict';

let container, stats;
let stageGui, connectionGui;
let camera, scene, renderer;
let topDirectionalLight, leftDirectionalLight, rightDirectionalLight;
let mesh, lines, geometry;
let tool;
let programText;

let focusedStage;

let focus = (object) => {
    focusedStage = object;
};
let getFocus = () => {
    return focusedStage;
};
let unfocus = () => {
    focusedStage = null;
};

let testVar;

let controlMode = "translate";

let swapControlMode = () => {
    controlMode = (controlMode === "translate") ? "rotate" : "translate";
    let controls = getControl();
    if (controls) {
        controls.mode = controlMode;
    }
};

const platformRaiseTranslateFactor = 8;
const maxAxisDisplacement = 125;
const platformYDisplacement = 46.5;

const geometryFactories = {
    stageCase: () => new THREE.BoxBufferGeometry(200, 100, 1000, 2, 2, 2),
    stagePlatform: () => new THREE.BoxBufferGeometry(200, 150, 200, 2, 2, 2),
    rotaryStageCase: () => new THREE.BoxBufferGeometry(150, 50, 150, 2, 2, 2),
    rotaryStagePlatform: () => new THREE.CylinderBufferGeometry(50, 50, 80, 10),
    angledTool: () => new THREE.CylinderBufferGeometry(10, 10, 80, 10),
    straightTool: () => new THREE.CylinderBufferGeometry(10, 10, 80, 10)
};

const defaultStageNames = [
    "sheep", "spinny", "rocket", "ike", "stagezilla", "unicorn", "mustache",
    "plant", "rutabaga", "turnip", "queen", "cedar", "douglas", "quaternion",
    "thevenin", "norton", "ada", "hopper", "derby", "moose", "cliff", "sonoma",
    "hessian", "jacobian", "emerald", "alki", "quilcene", "cascade", "saturn",
    "asteroid", "apricot", "monad", "asymptote", "martingale", "batman",
    "forty-two", "gravenstein", "october", "hyphybot", "gravitas", "charmer",
    "kingman", "euclid", "mechano", "rumbler", "descartes"
];

const defaultToolName = "Tool";

const greenColor = 0xbed346;
const stagePlatformsInMotion = {};

const connections = [];

class Connection {
    constructor(parentName, childName, place) {
        this.parentName = parentName;
        this.childName = childName;
        this.place = place;
        this.name = `${parentName}.${place} -> ${childName}`;
    }
}

let addLinearStage = () => {
    _addStage('linear');
};

let addRotaryStage = () => {
    _addStage('rotary');
};

let addAngledTool = () => {
    _addTool('angled');
};

let addStraightTool = () => {
    _addTool('straight');
};

let _addTool = (toolType) => {
    let group = new THREE.Group();
    let toolGeom;

    if (toolType === 'angled') {
        toolGeom = geometryFactories.angledTool();
    }
    else if (toolType === 'straight') {
        toolGeom = geometryFactories.straightTool();
    }

    group.color = new THREE.MeshLambertMaterial({ color: 0xf90f5c });
    let toolEdges = new THREE.EdgesGeometry(toolGeom);
    let toolLines = new THREE.LineSegments(toolEdges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 5 }));
    let toolMesh = new THREE.Mesh(toolGeom, group.color);

    group.add(toolLines);
    group.add(toolMesh);

    let toolName = defaultToolName;
    group.toolName = toolName;

    group.dgFolder = stageGui.addFolder(toolName);
    group.dgcontroller = group.dgFolder.add(group, 'toolName')
                            .onChange((value) => {
                                setDgFolderName(group.dgFolder, value);
                            });
    group.dgFolder.addColor(group.color, 'color');

    group.accepts = '(?)';
    group.dgFolder.add(group, 'accepts').listen();

    scene.add(group);
    destroyControl();
    generateControlForGroup(group);

    // Attempt to center on grid helper's axis
    group.position.y = 50;
    group.position.x = -35;
    group.position.z = 35;

    focus(group);

    tool = group;
    group.isTool = true;

    return group;
};

let _addStage = (stageType) => {
    let group = new THREE.Group();
    group.color = new THREE.MeshLambertMaterial({ color: greenColor });

    let stageCase;
    if (stageType === 'linear') {
        stageCase = geometryFactories.stageCase();
    }
    else if (stageType === 'rotary') {
        stageCase = geometryFactories.rotaryStageCase();
    }
    // scale geometry to a uniform size

    let stageTypeScale;
    if (stageType === 'linear') {
        stageTypeScale = 160;
    }
    else if (stageType === 'rotary') {
        stageTypeScale = 70;
    }
    stageCase.computeBoundingSphere();
    let scaleFactor = stageTypeScale / stageCase.boundingSphere.radius;
    stageCase.scale(scaleFactor, scaleFactor, scaleFactor);
    let stageCaseEdges = new THREE.EdgesGeometry(stageCase);
    let stageCaseLines = new THREE.LineSegments(stageCaseEdges, new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 5 } ));
    let stageCaseMesh = new THREE.Mesh(stageCase, group.color);

    let stagePlatform;
    if (stageType === 'linear') {
        stagePlatform = geometryFactories.stagePlatform();
    }
    else if (stageType === 'rotary') {
        stagePlatform = geometryFactories.rotaryStagePlatform();
    }
    stagePlatform.scale(scaleFactor, scaleFactor, scaleFactor);
    stagePlatform.translate(0, platformRaiseTranslateFactor, 0);
    let stagePlatformEdges = new THREE.EdgesGeometry(stagePlatform);
    let stagePlatformLines = new THREE.LineSegments(stagePlatformEdges, new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 5 } ));
    let stagePlatformMesh = new THREE.Mesh(stagePlatform, group.color);

    group.add(stageCaseLines);
    group.add(stageCaseMesh);
    group.add(stagePlatformLines);
    group.add(stagePlatformMesh);
    scene.add(group);

    // NOTE: currently we get the id of the Mesh (ignoring group and line ids)
    // May have to change this in the future
    let groups = getGroups();
    let stageId = groups[groups.length - 1].id;

    let stageNameIndex = Math.floor(Math.random() * defaultStageNames.length);
    let stageName = defaultStageNames[stageNameIndex];
    group.stageName = stageName;

    group.dgFolder = stageGui.addFolder(stageName);
    group.dgcontroller = group.dgFolder.add(group, 'stageName')
                            .onChange((value) => {
                                setDgFolderName(group.dgFolder, value);
                            });
    group.dgFolder.addColor(group.color, 'color');

    group.axis = 'y';
    group.dgFolder.add(group, 'axis').listen();
    group.stageType = stageType;
    group.dgFolder.add(group, 'stageType');

    scene.add(group);
    destroyControl();
    generateControlForGroup(group);

    // Attempt to center on grid helper's axis
    group.position.y = 50;
    group.position.x = -35;
    group.position.z = 35;

    focus(group);

    return group;

};

let setDgFolderName = (dgFolder, name) => {
    dgFolder.name = name;
};

let getStageName = (stage) => {
    return stage.stageName;
};

let getToolName = () => {
    return tool.toolName;
}

let getStageAxis = (stage) => {
    return stage.axis;
};

let findStageWithName = (name) => {
    return getGroups().find((stage) => (getStageName(stage) === name));
};

let deleteStage = (stage) => {
    unfocus();
    destroyControl();
    stageGui.removeFolder(stage.dgFolder);
    let deletedStageName = getStageName(stage);
    // TODO: recursive deleting of child connections with new ADT
    // Object.keys(connections).forEach((stageName) => {
    //     let stageFoundAsChild = connections[stageName].find((stagePlacePair) => {
    //         getStageName(stagePlacePair[0]);
    //     });
    //     if (stageFoundAsChild !== undefined) {
    //         delete connections[stageName];
    //     }
    // });

    scene.remove(stage);
    stage.children.forEach((el) => {
        el.geometry.dispose();
        el.material.dispose();
    });
};

let getGroups = () => {
    return scene.children.filter((child) => {
        return child.type === 'Group' && !child.isTool;
    });
};

let getTool = () => {
    return tool;
};

let getObjectGroup = (obj) => {
    return obj.parent;
};

let getControl = () => {
    let control = scene.children.find(obj => obj instanceof THREE.TransformControls);
    return control;
};

let initGui = () => {
    connectionGui = new dat.GUI( { width: 200 } );
    stageGui = new dat.GUI( { width: 200 } );
    stageGui.add({ AddLinearStage: () => {
        addLinearStage();
    } }, 'AddLinearStage');
    stageGui.add({ AddRotaryStage: () => {
        addRotaryStage();
    } }, 'AddRotaryStage');
};

let _getIntersectsFromClickWithCandidates = (event, candidates) => {
    let vector = new THREE.Vector3();
    let raycaster = new THREE.Raycaster();
    let dir = new THREE.Vector3();

    vector.set((event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1, -1); // z = - 1 important!
    vector.unproject(camera);
    dir.set(0, 0, -1).transformDirection(camera.matrixWorld);
    raycaster.set(vector, dir);

    let searchRecursively = true;
    return raycaster.intersectObjects(candidates, searchRecursively);
};

let generateControlForGroup = (group) => {
    // Add controls to the new mesh group
    let control = new THREE.TransformControls( camera, renderer.domElement );
    control.mode = controlMode;
    control.addEventListener('change', (event) => {
        render();
    });
    control.addEventListener('dragging-changed', (event) => {
        // console.log(event)
    });
    control.setRotationSnap(THREE.Math.degToRad(45));
    scene.add(control);
    control.attach(group);
    return control;
};

let destroyControl = () => {
    let control = getControl();
    if (control !== undefined) {
        control.detach();
        scene.remove(control);
    }
};

let onDocumentMouseDown = (event) => {
    // NOTE: do not fire click events if we click on the GUI
    if (stageGui.domElement.contains(event.target)) {
        if (event.target.className === "title") {
            let maybeStage = findStageWithName(event.target.innerHTML);
            if (maybeStage !== undefined) {
                destroyControl();
                generateControlForGroup(maybeStage);
                focus(maybeStage);
            }
        }
        return;
    }

    let candidates = getGroups().concat(getTool());
    let isectGroups = _getIntersectsFromClickWithCandidates(event, candidates);
    let isectControl;
    if (getControl() === undefined) {
        isectControl = [];
    }
    else {
        isectControl = _getIntersectsFromClickWithCandidates(event, [getControl()]);
    }
    // Kludge: isectControl length >= 3 means we are clicking the controls
    if (isectControl.length < 3 && isectGroups.length > 0) {
        let stage = getObjectGroup(isectGroups[0].object);
        // If we are holding shift, make a connection
        if (event.shiftKey) {
            if (getFocus().isTool) {
                connectToolToStage(getFocus(), stage);
            }
            else {
                let parentStageName = getStageName(getFocus());
                let childStageName = getStageName(stage);
                let place = prompt(`Where is ${parentStageName} connecting to ${childStageName}?`);
                if (!(place === 'center' || place === 'right' || place === 'left')) {
                    return;
                }
                connectParentChildAtPlace(getFocus(), stage, place);
            }
        }

        // Otherwise, just focus the new stage
        destroyControl();
        generateControlForGroup(stage);
        focus(stage);
        openFolderForStage(stage);
    }
    else if (isectControl.length < 3) {
        unfocus();
        destroyControl();
        openFolderForStage(null);
    }
};

let onDocumentMouseUp = (event) => {
    // If we had clicked on a stage folder, close all folders and let the
    // datGui mouseup handler just open the one stage folder
    if (stageGui.domElement.contains(event.target)) {
        if (event.target.className === "title") {
            openFolderForStage(null);
        }
        return;
    }
    // FIXME: better to do only on rotation, but this is easier
    redetermineAllStageAxes();
    redetermineAccepts();
};

let openFolderForStage = (stage) => {
    let groups = getGroups();
    groups.forEach((group) => {
        if (group === stage) {
            group.dgFolder.open();
        }
        else {
            group.dgFolder.close();
        }
    });
};

let onDocumentKeyDown = (event) => {
    if (event.key === "Backspace") {
        if (getFocus() !== null && event.shiftKey) {
            deleteStage(getFocus());
        }
    }
    if (event.key === "m") {
        swapControlMode();
    }
};

let initCamera = () => {
    let aspect = window.innerWidth / window.innerHeight;
    let viewSize = 150;
    camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect,
        viewSize, -viewSize, -1000, 10000);
    camera.zoom = 0.35;
    camera.updateProjectionMatrix();
    camera.frustumCulled = false;
    camera.position.set(-500, 500, 500); // I don't know why this works
    camera.lookAt(scene.position);
    camera.position.set(-400, 500, 800); // Pan away to move machine to left
};

let initScene = () => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f6f8);
    topDirectionalLight = new THREE.DirectionalLight( 0xffffff, 1.00 );
    leftDirectionalLight = new THREE.DirectionalLight( 0xffffff, 0.75 );
    rightDirectionalLight = new THREE.DirectionalLight( 0xffffff, 0.50 );
    leftDirectionalLight.position.set(-1.0, 0.0, 0.0);
    rightDirectionalLight.position.set(0.0, 0.0, 1.0);
    scene.add(topDirectionalLight);
    scene.add(leftDirectionalLight);
    scene.add(rightDirectionalLight);
    scene.add(new THREE.GridHelper(2000, 100, 0x444444, 0xe5e6e8));
};

let initRenderer = () => {
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );
};

let initStats = () => {
    stats = new Stats();
    container.appendChild( stats.dom );
};

let init = () => {
    container = document.getElementById( 'container' );

    initScene();
    initCamera();
    initRenderer();
    // initStats();
    initGui();

    addStraightTool();

    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener( 'resize', onWindowResize, false );

    // DEBUG__connectTwoStages();
};

let onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
};

/**
 * NOTE: for displacement, we always move along each stage's local X axis
 */

let getPlatformDisplacementForStage = (stage) => {
    return stage.children[3].position.z;
};

let setPlatformDisplacementForStage = (stage, displ) => {
    stage.children[3].position.z = displ;
};


let setStageNamePlatformToTargetDispl = (stageName, targetDisp) => {
    let stage = findStageWithName(stageName);
    if (stage.stageType === 'rotary') {
        if (targetDisp < 0) {
            targetDisp = 0;
        }
        if (targetDisp >= 180) {
            targetDisp = 179;
        }
    }
    stagePlatformsInMotion[stageName] = targetDisp;
};

let _moveStagePlatform = (stage, delta) => {
    if (stage.stageType === 'linear') {
        let platformLines = stage.children[2];
        let platformMesh = stage.children[3];
        if (Math.abs(platformMesh.position.z + delta) <= maxAxisDisplacement) {
            platformLines.translateZ(delta);
            platformMesh.translateZ(delta);
        }
    }
    else if (stage.stageType === 'rotary') {
        let platformLines = stage.children[2];
        let platformMesh = stage.children[3];
        let deltaRad = THREE.Math.degToRad(delta);
        platformLines.rotateY(deltaRad);
        platformMesh.rotateY(deltaRad);
    }
};


let _moveStage = (stage, delta, axis) => {
    if (Math.abs(stage.position.z + delta) <= maxAxisDisplacement) {
        stage.translateOnAxis(axis, delta);
    }
};

let incrementPlatforms = () => {
    Object.keys(stagePlatformsInMotion).forEach((stageName) => {
        let stage = findStageWithName(stageName);
        let targetDisp = stagePlatformsInMotion[stageName];
        let currDisp = getStageValue(stage);
        if (targetDisp === currDisp) {
            delete stagePlatformsInMotion[stageName];
        }
        else {
            let increment = targetDisp > currDisp ? 1 : -1;
            _moveStagePlatform(stage, increment);

            let baseAxis = getStageWorldDirection(stage);
            let childStages = gatherDeepChildStages(stage);
            childStages.forEach((stage) => {
                let stageOrigin = stage.position;
                let translatedBaseAxis = new THREE.Vector3().addVectors(baseAxis, stageOrigin);
                let axis = stage.worldToLocal(translatedBaseAxis);
                _moveStage(stage, increment, axis);
            });
        }

    });
};

let getStageWorldDirection = (stage) => {
    let vector = new THREE.Vector3();
    stage.getWorldDirection(vector);
    let eps = 1e-6;
    if (Math.abs(vector.x) < eps) {
        vector.x = 0.0;
    }
    if (Math.abs(vector.y) < eps) {
        vector.y = 0.0;
    }
    if (Math.abs(vector.z) < eps) {
        vector.z = 0.0;
    }
    return vector;
};

/* Three JS world direction -> our system, so y axis is z axis e.g.
 * Assumes stage's direction is normalized by three js */
let determineStageAxis = (stage) => {
    if (stage.stageType === 'rotary') {
        return 'theta';
    }
    else if (stage.stageType === 'linear') {
        let worldDir = getStageWorldDirection(stage);
        if (Math.abs(worldDir.x) == 1.0) {
            return 'x';
        }
        if (Math.abs(worldDir.z) == 1.0) {
            return 'y';
        }
        if (Math.abs(worldDir.y) == 1.0) {
            return 'z';
        }
        else {
            return 'r';
        }
    }
    else {
        return '?';
    }
};

let redetermineAllStageAxes = () => {
    let stages = getGroups();
    stages.forEach((stage) => {
        stage.axis = determineStageAxis(stage);
    });
};

let redetermineAccepts = () => {
    let axes = getDistinctAxes();
    tool.accepts = axes;
}

let gatherDeepChildStages = (parentStage) => {
    let parentName = getStageName(parentStage);
    let shallowChildCxns = connections.filter((cxn) => cxn.parentName === parentName);
    if (shallowChildCxns === undefined) {
        return [];
    }
    let shallowChildNames = [];
    shallowChildCxns.forEach((cxn) => shallowChildNames.push(cxn.childName));
    let shallowChildStages = shallowChildNames.map((stageName) => findStageWithName(stageName));
    let deepStages = shallowChildStages.map((stage) => gatherDeepChildStages(stage));
    let deepStagesFlat = deepStages.flat(1);
    return shallowChildStages.concat(deepStagesFlat);
};

let connectToolToStage = (tool, stage) => {
    // Add to connections table
    let parentName = getToolName();
    let childName = getStageName(stage);
    let place = '';
    let newConnection = new Connection(parentName, childName, place);
    connections.push(newConnection);

    // Add to GUI
    let newConnectionFolder = connectionGui.addFolder(newConnection.name);
    newConnectionFolder.add(newConnection, 'parentName');
    newConnectionFolder.add(newConnection, 'childName');

    let childStagePlatform = stage.children[3];
    childStagePlatform.add(tool);
};

let connectParentChildAtPlace = (parentStage, childStage, place) => {
    if (!(place === 'center' || place === 'left' || place === 'right')) {
        console.log(`Invalid place for connection: ${place}`);
        return;
    }
    let parentPosMat = parentStage.matrixWorld;
    // childStage.position.setFromMatrixPosition(parentPosMat);
    // childStage.translateY(platformYDisplacement);

    // Add to connections table
    let parentName = getStageName(parentStage);
    let childName = getStageName(childStage);
    let newConnection = new Connection(parentName, childName, place);
    connections.push(newConnection);

    // Position child stage appropriately
    let parentDir = getStageWorldDirection(parentStage);
    let axis = childStage.worldToLocal(parentDir);
    if (place === 'left') {
        // childStage.translateOnAxis(axis, maxAxisDisplacement);
    }
    if (place === 'right') {
        // childStage.translateOnAxis(axis, -maxAxisDisplacement);
    }
    if (place === 'center') {
        // childStage.translateOnAxis(axis, 0);
    }

    // Add to GUI
    let newConnectionFolder = connectionGui.addFolder(newConnection.name);
    newConnectionFolder.add(newConnection, 'parentName');
    newConnectionFolder.add(newConnection, 'childName');
    newConnectionFolder.add(newConnection, 'place');
};

let getDistinctAxes = () => {
    return getGroups().map((stage) => stage.axis)
            .filter((axis, idx, ary) => ary.indexOf(axis) === idx);
};

let getStagesWithAxis = (axis) => {
    let stages = getGroups();
    return stages.filter((stage) => (stage.axis === axis));
};

let DEMO__connectTwoStages = () => {
    connectParentChildAtPlace(getGroups()[1], getGroups()[0], "right");
};

let DEBUG__connectTwoStages = () => {
    addLinearStage();
    getGroups()[1].axis = 'y';
    connectParentChildAtPlace(getGroups()[1], getGroups()[0], "center");
    let secondStage = getGroups()[1];
    secondStage.rotateY(THREE.Math.degToRad(90));
    secondStage.axis = determineStageAxis(secondStage);
};

let generateMomProgram = () => {
    let s = '    ';
    var programStr = `tool ${getToolName(tool)}:\n${s}accepts (${tool.accepts})\n`;
    programStr = programStr.concat('\nstages:\n');
    getGroups().forEach((stage) => {
        let stageName = getStageName(stage);
        let stageAxis = getStageAxis(stage);
        let defaultTransfer;
        if (stage.stageType === 'linear') {
            defaultTransfer = 'step -> 0.03048 mm';
        }
        else if (stage.stageType === 'rotary') {
            defaultTransfer = 'step -> 0.06 deg';
        }
        programStr = programStr.concat(`${s}${stage.stageType} ${stageName} -> A(${stageAxis}):\n${s}${s}${defaultTransfer}\n`);
    });
    programStr = programStr.concat('\nconnections:\n');
    connections.forEach((cxn) => {
        programStr = programStr.concat(`${s}${cxn.name}.platform\n`);
    });
    programStr = programStr.concat('\n');
    return programStr;

};

let DOM__generate = () => {
    programText = generateMomProgram();
    let programContainerDom = document.querySelector('.program-container');
    programContainerDom.innerText = programText;
};

let DOM__compile = () => {
    // TODO: basic static checking
    let programIsValid = (progText) => {
        return !(/^\s*$/.test(progText));
    };
    let programContainerDom = document.querySelector('.program-container');
    if (!programIsValid(programContainerDom.innerText)) {
        alert("Could not compile .mom program.");
        return;
    }
    let posInstContainerDom = document.querySelector('.pos-inst-container');
    posInstContainerDom.style.display = 'block';
    document.querySelector('.inst-input').onkeyup = (event) => {
        if (event.key === 'Enter') {
            let inst = document.querySelector('.inst-input').value;
            API__inst(inst);
            document.querySelector('.inst-input').value = '';
        }
    };
    inflateControlPad();
    // TODO: actually generate software controller via momlang
    API__program(programText);
};

let DOM__decrement = (axis) => {
    // TODO: actually use software controller, hardcode axis for now
    let stagesForAxis = getStagesWithAxis(axis);
    stagesForAxis.forEach((stage) => {
        let currDisp = getStageValue(stage);
        let targetDisp = currDisp - 2;
        let stageName = getStageName(stage);
        setStageNamePlatformToTargetDispl(stageName, targetDisp);
        updateDomPosition();
    });
};

let DOM__increment = (axis) => {
    // TODO: actually use software controller, hardcode axis for now
    let stagesForAxis = getStagesWithAxis(axis);
    stagesForAxis.forEach((stage) => {
        let currDisp = getStageValue(stage);
        let targetDisp = currDisp + 2;
        let stageName = getStageName(stage);
        setStageNamePlatformToTargetDispl(stageName, targetDisp);
        updateDomPosition();
    });
};

let API__program = (progText) => {
    let req = new XMLHttpRequest();
    req.open('POST', '/program');
    req.setRequestHeader('Content-Type', 'application/json');
    req.send(JSON.stringify({ "program" : progText }));
};

let API__inst = (instText) => {
    let req = new XMLHttpRequest();
    req.open('POST', '/inst');
    req.setRequestHeader('Content-Type', 'application/json');
    req.send(JSON.stringify({ "inst" : instText }));
};

/* For linear and rotary stages */
let getStageValue = (stage) => {
    if (stage.stageType === 'linear') {
        return getPlatformDisplacementForStage(stage);
    }
    else if (stage.stageType === 'rotary') {
        return getRotaryStageAngle(stage);
    }
};

let updateDomPosition = () => {
    var positionString = '';
    var instString = 'move ';
    let distinctAxes = getDistinctAxes();
    distinctAxes.forEach((axis) => {
        let stagesForAxis = getStagesWithAxis(axis);
        let representativeStage = stagesForAxis[0];
        let axisDispl;
        if (representativeStage.stageType === 'linear') {
            axisDispl = getPlatformDisplacementForStage(representativeStage);
        }
        else if (representativeStage.stageType === 'rotary') {
            axisDispl = getRotaryStageAngle(representativeStage);
        }
        positionString = positionString.concat(` ${axis}: ${axisDispl} `);
        instString = instString.concat(`${axisDispl} `);
    });
    let posRowDom = document.querySelector('.position-row');
    posRowDom.innerText = positionString;
    console.log(instString);
    API__inst(instString);
};

let getRotaryStageAngle = (stage) => {
    let platformMesh = stage.children[3]
    let worldDir = getStageWorldDirection(platformMesh);
    let posZDir = new THREE.Vector3(0, 0, 1);
    // Formula: cos(theta) = (a dot b) / |a| * |b|
    // a and b here are already normalized
    let dotProd = posZDir.dot(worldDir);
    let angleRad = Math.acos(dotProd);
    let angleDeg = THREE.Math.radToDeg(angleRad);
    return Math.floor(angleDeg);
};

let inflateControlPad = () => {
    clearControlPad();
    // TODO: inflate from program, not from scene-graph
    let distinctAxes = getDistinctAxes();
    let controlPadDom = document.querySelector('.control-pad-row-container');
    distinctAxes.forEach((axisName) => {
        let controlRowDom = document.createElement('div');
        controlRowDom.className = 'control-row clearfix';

        let axisNameDom = document.createElement('div');
        axisNameDom.className = 'axis-name';
        axisNameDom.innerHTML = axisName;

        // TODO: figure out which arrow to use
        let firstArrowDom = document.createElement('img');
        firstArrowDom.className = 'control-arrow float-left';
        firstArrowDom.src = '/img/arrow_left.png';
        firstArrowDom.setAttribute('axis', axisName);
        firstArrowDom.onmousedown = () => {
            DOM__decrement(axisName);
        };

        let secondArrowDom = document.createElement('img');
        secondArrowDom.className = 'control-arrow float-right';
        secondArrowDom.src = '/img/arrow_right.png';
        secondArrowDom.onmousedown = () => {
            DOM__increment(axisName);
        };

        controlPadDom.appendChild(controlRowDom);
        controlRowDom.appendChild(firstArrowDom);
        controlRowDom.appendChild(axisNameDom);
        controlRowDom.appendChild(secondArrowDom);
    });
};

/* Takes a unary funciton applied to an axis passed as argument */
let onMouseHoldDoAxisFunction = (fn, axisName) => {
    let sendingInterval = 500;
    let interval = setInterval(() => {
        fn(axisName);
        document.onmouseup = () => {
            clearInterval(interval);
        };
        document.onclick = () => {
            clearInterval(interval);
        };
    }, sendingInterval);
};

let onClickDoAxisFunction = (fn, axisName) => {

};

let clearControlPad = () => {
    let controlPadDom = document.querySelector('.control-pad-row-container');
    while (controlPadDom.firstChild) {
        controlPadDom.removeChild(controlPadDom.firstChild);
    }
};

let animate = () => {
    requestAnimationFrame( animate );
    render();
    // stats.update();
    incrementPlatforms();
};

let render = () => {
    renderer.render( scene, camera );
};

init();
animate();

