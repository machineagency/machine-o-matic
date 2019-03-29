'use strict';

let container, stats;
let stageGui, connectionGui;
let camera, scene, renderer;
let topDirectionalLight, leftDirectionalLight, rightDirectionalLight;
let mesh, lines, geometry;

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
    stageCase: () => new THREE.BoxBufferGeometry(200, 100, 1000, 2, 2, 2 ),
    stagePlatform: () => new THREE.BoxBufferGeometry(200, 150, 200, 2, 2, 2 )
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

const greenColor = 0xbed346;
const stagePlatformsInMotion = {};

const connections = [];

class Connection {
    constructor(parentName, childName, place) {
        this.parentName = parentName;
        this.childName = childName;
        this.place = place;
    }
}

let addStage = () => {
    let group = new THREE.Group();
    group.color = new THREE.MeshLambertMaterial({ color: greenColor });

    let stageCase = geometryFactories.stageCase();
    // scale geometry to a uniform size

    stageCase.computeBoundingSphere();
    let scaleFactor = 160 / stageCase.boundingSphere.radius;
    stageCase.scale(scaleFactor, scaleFactor, scaleFactor);
    let stageCaseEdges = new THREE.EdgesGeometry(stageCase);
    let stageCaseLines = new THREE.LineSegments(stageCaseEdges, new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 5 } ));
    let stageCaseMesh = new THREE.Mesh(stageCase, group.color);

    let stagePlatform = geometryFactories.stagePlatform();
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

    group.axis = "x";
    group.dgFolder.add(group, 'axis');

    scene.add(group);
    destroyControl();
    generateControlForGroup(group);

    focus(group);

    return group;

};

let addConnection = () => {
};

let setDgFolderName = (dgFolder, name) => {
    dgFolder.name = name;
};

let getStageName = (stage) => {
    return stage.stageName;
};

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
        return child.type === 'Group';
    });
};

let getObjectGroup = (obj) => {
    return obj.parent;
};

let getControl = () => {
    let control = scene.children.find(obj => obj instanceof THREE.TransformControls);
    return control;
};

let initGui = () => {
    stageGui = new dat.GUI( { width: 200 } );
    stageGui.add({ AddStage: () => {
        addStage();
    } }, 'AddStage');
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

    let isectGroups = _getIntersectsFromClickWithCandidates(event, getGroups());
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
    camera.position.set(-500, 500, 500); // I don't know why this works
    camera.frustumCulled = false;
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
    // scene.add(new THREE.GridHelper(2000, 40));
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

    initCamera();
    initScene();
    initRenderer();
    initStats();
    initGui();

    let stage = addStage();

    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);

    camera.lookAt(scene.position);
    window.addEventListener( 'resize', onWindowResize, false );

    DEBUG__connectTwoStages();
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
    stagePlatformsInMotion[stageName] = targetDisp;
};

let _moveStagePlatform = (stage, delta) => {
    let platformLines = stage.children[2];
    let platformMesh = stage.children[3];
    if (Math.abs(platformMesh.position.z + delta) <= maxAxisDisplacement) {
        platformLines.translateZ(delta);
        platformMesh.translateZ(delta);
    }
};


let _moveStage = (stage, delta, axis) => {
    if (Math.abs(stage.position.z + delta) <= maxAxisDisplacement) {
        // stage.translateX(delta);
        stage.translateOnAxis(axis, delta);
    }
};

let incrementPlatforms = () => {
    Object.keys(stagePlatformsInMotion).forEach((stageName) => {
        let stage = findStageWithName(stageName);
        let targetDisp = stagePlatformsInMotion[stageName];
        let currDisp = getPlatformDisplacementForStage(stage);
        if (targetDisp === currDisp) {
            delete stagePlatformsInMotion[stageName];
        }
        else {
            let increment = targetDisp > currDisp ? 1 : -1;
            _moveStagePlatform(stage, increment);

            let baseAxis = new THREE.Vector3();
            stage.getWorldDirection(baseAxis);
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

let connectStageToStageAtPlace = (childStage, parentStage, place) => {
    if (!(place === 'center' || place === 'left' || place === 'right')) {
        console.log(`Invalid place for connection: ${place}`);
        return;
    }
    let parentPosMat = parentStage.matrixWorld;
    childStage.position.setFromMatrixPosition(parentPosMat);
    childStage.translateY(platformYDisplacement);

    // Add to connections table
    let parentName = getStageName(parentStage);
    let childName = getStageName(childStage);
    connections.push(new Connection(parentName, childName, place));
    // let existingChildren = connections[getStageName(parentStage)];
    // if (existingChildren === undefined) {
    //     connections[getStageName(parentStage)] = [[childStage, place]];
    // }
    // else {
    //     connections[getStageName(parentStage)].concat([childStage, place]);
    // }

    // Position child stage appropriately
    let parentDir = new THREE.Vector3();
    parentStage.getWorldDirection(parentDir);
    let axis = childStage.worldToLocal(parentDir);
    if (place === 'left') {
        childStage.translateOnAxis(axis, maxAxisDisplacement);
    }
    if (place === 'right') {
        childStage.translateOnAxis(axis, -maxAxisDisplacement);
    }
    if (place === 'center') {
        childStage.translateOnAxis(axis, 0);
    }
};

let DEMO__connectTwoStages = () => {
    connectStageToStageAtPlace(getGroups()[1], getGroups()[0], "right");
};

let DEBUG__connectTwoStages = () => {
    addStage();
    DEMO__connectTwoStages();
};

let generateMomProgram = () => {
    var programStr = 'tool Pen:\n\taccepts (x,y)\n';
    programStr = programStr.concat('\nstages:\n');
    getGroups().forEach((stage) => {
        let stageName = getStageName(stage);
        let stageAxis = getStageAxis(stage);
        let defaultTransfer = 'step -> 0.03048 mm';
        programStr = programStr.concat(`\tlinear ${stageName} -> A(${stageAxis}):\n\t\t${defaultTransfer}\n`);
    });
    programStr = programStr.concat('\nconnections:\n');
    Object.keys(connections).forEach((cxn) => {
        programStr = programStr.concat(`\t${cxn.parentName}.${cxn.place} -> ${cxn.childName}.platform`);
    });
    // Object.keys(connections).forEach((stageNameDotPlace) => {
    //    let toStageDotPlace = connections[stageNameDotPlace].concat(".platform");
    //     programstr = programstr.concat(`\t${stagenamedotplace} -> ${tostagedotplace}`);
    // });
    programStr = programStr.concat('\n');
    return programStr;

};

let animate = () => {
    requestAnimationFrame( animate );
    render();
    stats.update();
    incrementPlatforms();
};

let render = () => {
    renderer.render( scene, camera );
};

init();
animate();

