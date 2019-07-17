'use strict';

let container, stats;
let stageGui, connectionGui;
let camera, scene, renderer;
let topDirectionalLight, leftDirectionalLight, rightDirectionalLight;
let mesh, lines, geometry;
let tool;
let programText;
let clock;
let mixer;

let focusedStage;
let activeSelectionHandle;
let connectionHandlesVisible = false;

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
    straightTool: () => new THREE.CylinderBufferGeometry(10, 10, 80, 10),
    connectionHandle: () => new THREE.SphereBufferGeometry(25, 32, 32)
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
const blueColor = 0x12CBC4;
const yellowColor = 0xFFC312;
const whiteColor = 0xEFEFEF;
const stagePlatformsInMotion = {};

let connections = [];

class Connection {
    constructor(parentName, parentPlace, childName, childPlace) {
        this.parentName = parentName;
        this.parentPlace = parentPlace;
        this.childName = childName;
        this.childPlace = childPlace;
        this.name = `${parentName}.${parentPlace} -> ${childName}.${childPlace}`;
    }
}

let addLinearStage = () => {
    let group = _makeStage('linear');
    _addConnectionHandlesToGroup(group);
    _addGroupToScene(group);
};

let addRotaryStage = () => {
    let group = _makeStage('rotary');
    _addConnectionHandlesToGroup(group);
    _addGroupToScene(group);
};

let addAngledTool = () => {
    let group = _makeTool('angled');
    _addConnectionHandlesToGroup(group);
    _addGroupToScene(group);
};

let addStraightTool = () => {
    let group = _makeTool('straight');
    _addConnectionHandlesToGroup(group);
    _addGroupToScene(group);
};

let _makeTool = (toolType) => {
    let group = new THREE.Group();
    group.isTool = true;
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
    toolMesh.name = 'tool';
    toolMesh.material.transparent = true;

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
    return group;
};

let _makeStage = (stageType) => {
    let group = new THREE.Group();
    group.isStage = true;
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
    group.scaleFactor = stageTypeScale / stageCase.boundingSphere.radius;
    stageCase.scale(group.scaleFactor, group.scaleFactor, group.scaleFactor);
    let stageCaseEdges = new THREE.EdgesGeometry(stageCase);
    let stageCaseLines = new THREE.LineSegments(stageCaseEdges, new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 5 } ));
    let stageCaseMesh = new THREE.Mesh(stageCase, group.color);
    stageCaseMesh.name = 'stageCase';
    stageCaseMesh.material.transparent = true;

    let stagePlatform;
    if (stageType === 'linear') {
        stagePlatform = geometryFactories.stagePlatform();
    }
    else if (stageType === 'rotary') {
        stagePlatform = geometryFactories.rotaryStagePlatform();
    }
    stagePlatform.scale(group.scaleFactor, group.scaleFactor, group.scaleFactor);
    stagePlatform.translate(0, platformRaiseTranslateFactor, 0);
    let stagePlatformEdges = new THREE.EdgesGeometry(stagePlatform);
    let stagePlatformLines = new THREE.LineSegments(stagePlatformEdges, new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 5 } ));
    let stagePlatformMesh = new THREE.Mesh(stagePlatform, group.color);
    stagePlatformMesh.name = 'stagePlatform';
    stagePlatformMesh.material.transparent = true;

    group.add(stageCaseLines);
    group.add(stageCaseMesh);
    group.add(stagePlatformLines);
    group.add(stagePlatformMesh);
    scene.add(group);

    // NOTE: currently we get the id of the Mesh (ignoring group and line ids)
    // May have to change this in the future
    let groups = getStages();
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

    return group;

};

let _addGroupToScene = (group, adjustPosition=true) => {
    scene.add(group);
    destroyControl();
    generateControlForGroup(group);

    if (adjustPosition) {
        group.position.y = 50;
        group.position.x = -35;
        group.position.z = 35;
    }

    focus(group);

};

let _addConnectionHandlesToGroup = (group) => {
    if (group.isTool) {
        let connectionHandle = geometryFactories.connectionHandle();
        connectionHandle.computeBoundingSphere();
        connectionHandle.scale(0.4, 0.4, 0.4);

        let handleColor = new THREE.MeshLambertMaterial({
            color: yellowColor,
            emissive: yellowColor,
            emissiveIntensity: 0.25
        });
        let connectionHandleMesh = new THREE.Mesh(connectionHandle, handleColor);
        connectionHandleMesh.name = 'connectionHandle';
        connectionHandleMesh.position.z = 0;
        connectionHandleMesh.position.y = -45;
        connectionHandleMesh.visible = connectionHandlesVisible;
        connectionHandleMesh.place = 'tool';

        group.add(connectionHandleMesh);
    } else if (group.stageType === 'rotary') {
        let connectionHandle = geometryFactories.connectionHandle();
        connectionHandle.computeBoundingSphere();
        connectionHandle.scale(0.4, 0.4, 0.4);

        let handleColor = new THREE.MeshLambertMaterial({
            color: yellowColor,
            emissive: yellowColor,
            emissiveIntensity: 0.25
        });
        let connectionHandleMesh = new THREE.Mesh(connectionHandle, handleColor);
        connectionHandleMesh.name = 'connectionHandle';
        connectionHandleMesh.position.z = 0;
        connectionHandleMesh.position.y = 40;
        connectionHandleMesh.visible = connectionHandlesVisible;
        connectionHandleMesh.place = 'platform';

        group.add(connectionHandleMesh);
    } else {
        let connectionHandleRight = geometryFactories.connectionHandle();
        let connectionHandleLeft = geometryFactories.connectionHandle();
        let connectionHandlePlatform = geometryFactories.connectionHandle();
        connectionHandleRight.scale(group.scaleFactor, group.scaleFactor, group.scaleFactor);
        connectionHandleLeft.scale(group.scaleFactor, group.scaleFactor, group.scaleFactor);
        connectionHandlePlatform.scale(group.scaleFactor, group.scaleFactor, group.scaleFactor);
        let handleColor = new THREE.MeshLambertMaterial({
            color: yellowColor,
            emissive: yellowColor,
            emissiveIntensity: 0.25
        });
        let connectionHandleMeshRight = new THREE.Mesh(connectionHandleRight, handleColor);
        let connectionHandleMeshLeft = new THREE.Mesh(connectionHandleLeft, handleColor);
        let connectionHandleMeshPlatform = new THREE.Mesh(connectionHandlePlatform, handleColor);
        connectionHandleMeshRight.name = 'connectionHandle';
        connectionHandleMeshLeft.name = 'connectionHandle';
        connectionHandleMeshPlatform.name = 'connectionHandle';

        connectionHandleMeshRight.position.z = 155;
        connectionHandleMeshRight.position.y = 15;
        connectionHandleMeshLeft.position.z = -155;
        connectionHandleMeshLeft.position.y = 15;
        connectionHandleMeshPlatform.position.z = 0;
        connectionHandleMeshPlatform.position.y = 35;
        connectionHandleMeshRight.visible = connectionHandlesVisible;
        connectionHandleMeshLeft.visible = connectionHandlesVisible;
        connectionHandleMeshPlatform.visible = connectionHandlesVisible;
        connectionHandleMeshRight.place = 'right';
        connectionHandleMeshLeft.place = 'left';
        connectionHandleMeshPlatform.place = 'platform';

        group.add(connectionHandleMeshRight);
        group.add(connectionHandleMeshLeft);
        group.add(connectionHandleMeshPlatform);
    }
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
    return getStages().find((stage) => (getStageName(stage) === name));
};

let deleteStage = (stage) => {
    unfocus();
    destroyControl();
    stageGui.removeFolder(stage.dgFolder);
    let deletedStageName = getStageName(stage);
    let connectionsAfterDeletions = [];
    connections.forEach((cxn) => {
        if (cxn.childName !== deletedStageName && cxn.parentName !== deletedStageName) {
            connectionsAfterDeletions.push(cxn);
        } else {
            connectionGui.removeFolder(cxn.dgFolder);
        }
    });
    connections = connectionsAfterDeletions;

    scene.remove(stage);
    stage.children.forEach((el) => {
        el.geometry.dispose();
        el.material.dispose();
    });
};

let getStages = () => {
    let getStagesFromGroup = (group) => {
        let groupChildrenGroups = group.children.filter((child) => {
            return child.type === 'Group' && !child.isTool;
        });
        if (group.isStage && groupChildrenGroups.length === 0) {
            return group;
        }
        return groupChildrenGroups.map((group) => {
            return getStagesFromGroup(group);
        }).flat();
    };

    return scene.children.filter((child) => {
        return child.type === 'Group' && !child.isTool;
    }).map((group) => {
        return getStagesFromGroup(group);
    }).flat();
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
    let lastPosition = new THREE.Vector3();
    let currPosition = new THREE.Vector3();
    let control = new THREE.TransformControls( camera, renderer.domElement );
    let offset = new THREE.Vector3();
    let parentMods = gatherDeepParentStages(group);
    control.mode = controlMode;
    control.addEventListener('change', (event) => {
        render();
    });
    control.addEventListener('mouseDown', (event) => {
        lastPosition.copy(group.position);
    });
    control.addEventListener('objectChange', (event) => {
        currPosition.copy(group.position);
        offset = currPosition.sub(lastPosition);
        parentMods.forEach((parentMod) => {
            parentMod.position.add(offset);
        });
        lastPosition.copy(group.position);
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

let getRootConnectionGroup = (group) => {
    if (group.parent.type !== 'Group') {
        return group;
    }
    return getRootConnectionGroup(group.parent);
};

let makeConnectionGroupForModules = (parentMod, childMod) => {
    let cxnGroup = new THREE.Group();
    cxnGroup.isConnectionGroup = true;
    cxnGroup.add(parentMod);
    cxnGroup.add(childMod);
    cxnGroup.parent = parentMod.parent; // TODO: is this okay?
    return cxnGroup;
};

/**
 * KEYPRESS LOGIC
 */
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

    let candidates = getStages().concat(getTool()).concat(getConnectionHandles());
    let isectGroups = _getIntersectsFromClickWithCandidates(event, candidates);
    let isectControl;
    if (getControl() === undefined) {
        isectControl = [];
    }
    else {
        isectControl = _getIntersectsFromClickWithCandidates(event, [getControl()]);
    }
    let possibleHandles = isectGroups.filter((result) => result.object.name === 'connectionHandle')
    if (possibleHandles.length > 0) {
        let currHandle = possibleHandles[0];
        if (activeSelectionHandle === undefined) {
            setActiveSelectionHandle(currHandle);
        } else {
            let fromModule;
            if (activeSelectionHandle.object.parent.isTool) {
                fromModule = getTool();
            } else {
                fromModule = findStageWithName(activeSelectionHandle.object.parent.stageName);
            }
            let fromPlace = activeSelectionHandle.object.place;
            let toStage = findStageWithName(currHandle.object.parent.stageName);
            let toPlace = currHandle.object.place;
            connectParentChild(fromModule, fromPlace, toStage, toPlace);
            releaseActiveSelectionHandle();
        }
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
                if (!(place === 'platform' || place === 'right' || place === 'left')) {
                    return;
                }
                connectParentChild(getFocus(), stage, place);
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
    let groups = getStages();
    groups.forEach((group) => {
        if (group.isStage) {
            if (group === stage) {
                group.dgFolder.open();
            }
            else {
                group.dgFolder.close();
            }
        }
    });
};

let onDocumentKeyDown = (event) => {
    if (event.target.nodeName === "PRE" || event.target.nodeName === "INPUT") {
        if (event.key === "Escape") {
            document.activeElement.blur();
        }
        return;
    }
    if (event.key === "Backspace") {
        if (getFocus() !== null && event.shiftKey) {
            deleteStage(getFocus());
        }
    }
    if (event.key === "m") {
        swapControlMode();
    }
    if (event.key === "s") {
        toggleConnectionHandles();
    }
    if (event.key === "Escape") {
        releaseActiveSelectionHandle();
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
    clock = new THREE.Clock();
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
    //initStats();
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
    stage.translateOnAxis(axis, delta);
};

let incrementPlatforms = () => {
    Object.keys(stagePlatformsInMotion).forEach((stageName) => {
        let stage = findStageWithName(stageName);
        let targetDisp = stagePlatformsInMotion[stageName];
        let currDisp = getStageValue(stage);
        if (currDisp === targetDisp) {
            delete stagePlatformsInMotion[stageName];
            if (Object.keys(stagePlatformsInMotion).length === 0) {
                updateDomPosition();
            }
        }
        else {
            let increment = targetDisp > currDisp ? 1 : -1;
            _moveStagePlatform(stage, increment);
            let siblings = getStageSiblings(stage);
            siblings.forEach((stage) => _moveStagePlatform(stage, increment));

            let baseAxis = getStageWorldDirection(stage);
            let stagePath = getPathToToolForStage(stage);
            let parentStages = stagePath.slice(1);
            parentStages.forEach((stage) => {
                let stageOrigin = stage.position;
                let translatedBaseAxis = new THREE.Vector3().addVectors(baseAxis, stageOrigin);
                let axis = stage.worldToLocal(translatedBaseAxis);
                _moveStage(stage, increment, axis);
            });
        }
    });
};

let getStageSiblings = (stage) => {
    let stageName = getStageName(stage);
    let stageToParentConnection = connections.find((cxn) => cxn.childName === stageName);
    if (stageToParentConnection === undefined) {
        return [];
    }
    let parentName = stageToParentConnection.parentName;
    let parentConnections = connections.filter((cxn) => cxn.parentName === parentName);
    let siblingNamesWithSelf = parentConnections.map((cxn) => cxn.childName);
    let siblingNames = siblingNamesWithSelf.filter((name) => name !== stageName);
    let siblings = siblingNames.map((name) => findStageWithName(name));
    return siblings;
};

let getPathToToolForStage = (stage) => {
    let helper = (currStage) => {
        let currName = getStageName(currStage);
        let connection = connections.find((cxn) => cxn.childName === currName);
        if (connection === undefined) {
            return [currStage];
        }
        let parentName = connection.parentName;
        if (parentName === getToolName()) {
            return [currStage, tool];
        }
        let parentStage = findStageWithName(parentName);
        return [currStage].concat(helper(parentStage));
    };
    return helper(stage);
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
    let stages = getStages();
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

let gatherDeepParentStages = (childStage) => {
    let childName = getStageName(childStage);
    let shallowParentCxns = connections.filter((cxn) => cxn.childName === childName);
    if (shallowParentCxns === undefined) {
        return [];
    }
    if (shallowParentCxns.length === 1 && shallowParentCxns[0].parentPlace === 'tool') {
        return [getTool()];
    }
    let shallowParentNames = [];
    shallowParentCxns.forEach((cxn) => shallowParentNames.push(cxn.parentName));
    let shallowParentStages = shallowParentNames.map((stageName) => findStageWithName(stageName));
    let deepStages = shallowParentStages.map((stage) => gatherDeepParentStages(stage));
    let deepStagesFlat = deepStages.flat(1);
    return shallowParentStages.concat(deepStagesFlat);
};

let getConnectionHandles = () => {
    let groups = getStages();
    let tool = getTool();
    let groupsAndTool = groups.concat(tool);
    return groupsAndTool.map((group) => group.children)
               .flat()
               .filter((obj) => obj.name === 'connectionHandle');
};

let getMeshes = () => {
    let groups = getStages();
    let tool = getTool();
    let groupsAndTool = groups.concat(tool);
    return groupsAndTool.map((group) => group.children)
               .flat()
               .filter((obj) => obj.name === 'stageCase'
                             || obj.name === 'stagePlatform'
                             || obj.name === 'tool');
};

let toggleConnectionHandles = () => {
    let handles = getConnectionHandles();
    let meshes = getMeshes();
    connectionHandlesVisible = !connectionHandlesVisible;
    handles.forEach((handle) => { handle.visible = connectionHandlesVisible; });
    meshes.forEach((mesh) => {
        mesh.material.opacity = connectionHandlesVisible ? 0.5 : 1.0;
    });
};

let setActiveSelectionHandle = (handle) => {
    activeSelectionHandle = handle;
    let handles = getConnectionHandles();
    handles.forEach((handle) => {
        handle.material.color = new THREE.Color(whiteColor);
    });
};

let releaseActiveSelectionHandle = () => {
    activeSelectionHandle = undefined;
    let handles = getConnectionHandles();
    handles.forEach((handle) => {
        handle.material.color = new THREE.Color(yellowColor);
    });
};

let drawArrowFromHandle = (handle) => {
    let handleOrigin = activeSelectionHandle.point;
    let mouseVecUnproj = new THREE.Vector3();
    let mouseVect = new THREE.Vector3();
    let arrowDir = new THREE.Vector3();
    let arrowDist = 500; // arbitrary large number serves as maximum
    let arrow = new THREE.ArrowHelper(arrowDir, handleOrigin, 1,
                                      blueColor);
    scene.add(arrow);
    document.onmousemove = (event) => {
        // mouseVecUnproj.set(event.pageX, event.pageY, -1);
        mouseVecUnproj.set(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1,
            -1
        );
        mouseVecUnproj.unproject(camera);
        mouseVect.copy(mouseVecUnproj);
        arrowDir.copy(mouseVect).sub(handleOrigin).normalize();
        arrow.setDirection(arrowDir);
        arrow.setLength(handleOrigin.distanceTo(mouseVect));
    };
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

    // let childStagePlatform = stage.children[3];
    // childStagePlatform.add(tool);
};

let connectParentChild = (parentStage, parentPlace, childStage, childPlace) => {
    if (parentStage.id === childStage.id) {
        alert('Cannot connect a stage to itself.');
        return;
    }
    let parentPosMat = parentStage.matrixWorld;
    // childStage.position.setFromMatrixPosition(parentPosMat);
    // childStage.translateY(platformYDisplacement);

    // Add to connections table
    let parentName = getStageName(parentStage) || 'Tool' ;
    let childName = getStageName(childStage);
    let newConnection = new Connection(parentName, parentPlace, childName, childPlace);
    connections.push(newConnection);

    // Position child stage appropriately
    let parentDir = getStageWorldDirection(parentStage);
    let axis = childStage.worldToLocal(parentDir);
    // if (place === 'left') {
    //     // childStage.translateOnAxis(axis, maxAxisDisplacement);
    // }
    // if (place === 'right') {
    //     // childStage.translateOnAxis(axis, -maxAxisDisplacement);
    // }
    // if (place === 'platform') {
    //     // childStage.translateOnAxis(axis, 0);
    // }

    // Add to GUI
    let newConnectionFolder = connectionGui.addFolder(newConnection.name);
    newConnectionFolder.add(newConnection, 'parentName');
    newConnectionFolder.add(newConnection, 'parentPlace');
    newConnectionFolder.add(newConnection, 'childName');
    newConnectionFolder.add(newConnection, 'childPlace');
    newConnection.dgFolder = newConnectionFolder;
};

let getDistinctAxes = () => {
    return getStages().map((stage) => stage.axis)
            .filter((axis, idx, ary) => ary.indexOf(axis) === idx);
};

let getStagesWithAxis = (axis) => {
    let stages = getStages();
    return stages.filter((stage) => (stage.axis === axis));
};

let DEMO__connectTwoStages = () => {
    connectParentChildAtPlace(getStages()[1], getStages()[0], "right");
};

let DEBUG__connectTwoStages = () => {
    addLinearStage();
    getStages()[1].axis = 'y';
    connectParentChildAtPlace(getStages()[1], getStages()[0], "platform");
    let secondStage = getStages()[1];
    secondStage.rotateY(THREE.Math.degToRad(90));
    secondStage.axis = determineStageAxis(secondStage);
};

let generateMomProgram = () => {
    let s = '    ';
    var programStr = `tool ${getToolName(tool)}:\n${s}accepts (${tool.accepts})\n`;
    programStr = programStr.concat('\nstages:\n');
    getStages().forEach((stage) => {
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
        programStr = programStr.concat(`${s}${cxn.name}\n`);
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
            // TODO: uncomment when done testing
            // API__inst(inst);
            setSimPositionsFromInst(inst);
            document.querySelector('.inst-input').value = '';
        }
    };
    inflateControlPad();
    // TODO: uncomment to generate actual controller
    // API__program(programText);
};

let setSimPositionsFromInst = (inst) => {
    let targetPositionsStrings = inst.split(' ').slice(1);
    let targetPositions = targetPositionsStrings.map((s) => parseInt(s));
    let axes = getDistinctAxes();
    axes.forEach((axis, idx) => {
        let stages = getStagesWithAxis(axis);
        stages.forEach((stage) => {
            let stageName = getStageName(stage);
            setStageNamePlatformToTargetDispl(stageName, targetPositions[idx]);
        });
    });
};

let DOM__decrement = (axis) => {
    // TODO: actually use software controller, hardcode axis for now
    let stagesForAxis = getStagesWithAxis(axis);
    stagesForAxis.forEach((stage) => {
        let currDisp = getStageValue(stage);
        let targetDisp = currDisp - 1;
        let stageName = getStageName(stage);
        setStageNamePlatformToTargetDispl(stageName, targetDisp);
    });
};

let DOM__increment = (axis) => {
    // TODO: actually use software controller, hardcode axis for now
    let stagesForAxis = getStagesWithAxis(axis);
    stagesForAxis.forEach((stage) => {
        let currDisp = getStageValue(stage);
        let targetDisp = currDisp + 1;
        let stageName = getStageName(stage);
        setStageNamePlatformToTargetDispl(stageName, targetDisp);
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

let cappedFramerateRequestAnimationFrame = (framerate) => {
    if (framerate === undefined) {
        requestAnimationFrame(animate);
    } else {
        setTimeout(() => {
            requestAnimationFrame(animate);
        }, 1000 / framerate);
    }
};

let testAnimation = () => {
    let stage = getStages()[0];
    mixer = new THREE.AnimationMixer(stage);

    let positionKF = new THREE.VectorKeyframeTrack('.position', [1,2,3],
                        [ -35, 50, 35, 60, 60, 60, -35, 50, 35 ]);
    let clip = new THREE.AnimationClip('Action', 3, [ positionKF ]);
    let clipAction = mixer.clipAction(clip);
    clipAction.play();
};

let animate = () => {
    cappedFramerateRequestAnimationFrame();
    render();
    // stats.update();
    // TODO: remove when animation is working, uncomment to go back to the
    // bad old days
    // incrementPlatforms();
};

let render = () => {
    let deltaSeconds = clock.getDelta();
    if (mixer !== undefined) {
        mixer.update(deltaSeconds);
    }
    renderer.render( scene, camera );
};

init();
animate();

