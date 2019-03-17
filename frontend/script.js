'use strict'

let container, stats, gui;
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

const geometries = [
    new THREE.BoxBufferGeometry( 1000, 100, 200, 2, 2, 2 ),
];

const options = {
    Geometry: 0
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
const material = new THREE.MeshLambertMaterial({ color: greenColor });

let addStage = () => {
    geometry = geometries[ options.Geometry ];
    // scale geometry to a uniform size

    geometry.computeBoundingSphere();
    let scaleFactor = 160 / geometry.boundingSphere.radius;
    geometry.scale( scaleFactor, scaleFactor, scaleFactor );
    let edges = new THREE.EdgesGeometry(geometry);
    lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 5 } ));
    mesh = new THREE.Mesh( geometry, material );
    let group = new THREE.Group();
    group.add(lines);
    group.add(mesh);
    scene.add(group);

    // NOTE: currently we get the id of the Mesh (ignoring group and line ids)
    // May have to change this in the future
    let groups = getGroups();
    let stageId = groups[groups.length - 1].id;

    let stageNameIndex = Math.floor(Math.random() * defaultStageNames.length);
    let stageName = defaultStageNames[stageNameIndex];
    // group.dgcontroller = gui.add({ stageName: stageName }, 'stageName');

    // TODO: investigate how to use folders/colors. Leave commented for now.
    group.dgFolder = gui.addFolder(stageName);
    group.dgcontroller = group.dgFolder.add({ stageName: stageName }, 'stageName')
                            .onChange((value) => {
                                setDgFolderName(group.dgFolder, value);
                            });
    // gui.add({ stageName: stageName }, 'stageName');
    // console.log(mesh.material.color);
    // gui.addColor(mesh.material.color, 'color');

    scene.add(group);
    destroyControl();
    generateControlForGroup(group);

    focus(group);

    return group;

};

let setDgFolderName = (dgFolder, name) => {
    dgFolder.name = name;
};

let getStageName = (stage) => {
    // FIXME: consolidate what gets named
    // return stage.dgController.object.stageName;
    return stage.dgFolder.name;
};

let findStageWithName = (name) => {
    return getGroups().find((stage) => (getStageName(stage) === name));
};

let deleteStage = (stage) => {
    unfocus();
    destroyControl();
    gui.removeFolder(stage.dgFolder);

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
    gui = new dat.GUI( { width: 200 } );
    gui.add({ AddStage: () => {
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
    if (gui.domElement.contains(event.target)) {
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
    if (gui.domElement.contains(event.target)) {
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
        if (getFocus() !== null) {
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
};

let onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
};

let animate = () => {
    requestAnimationFrame( animate );
    render();
    stats.update();
};

let render = () => {
    renderer.render( scene, camera );
};

init();
animate();

