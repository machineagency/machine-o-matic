'use strict';

let renderer;
let scenes = [];
let cameras = [];
const sceneElements = [];
let pagePaneIndexCounter = 0;
let activePaneIndex = 0;

let mesh, lines, geometry;
let tool;
let programText;
let clock;
let mixers = [];
let EPSILON = 0.001;

const exampleProgramText = `'use strict';
loadStl('assets/pikachu.stl')
.then(() => {
    mesh = getStlMeshes()[0];
    geometry = meshToGeometry(mesh);
    return [mesh, geometry];
})
.then((meshGeomPair) => {
    let mesh = meshGeomPair[0];
    let geometry = meshGeomPair[1];
    let slicer = new Slicer({
        layerHeight: 1.0,
        infill: 'empty'
    });
    let layers = slicer.slice(mesh, geometry);
    slicer.visualizeContours(layers);
    let plotter = new Machine({
        'linear Axis(x)' : 'Motor(x1), Motor(x2) @ step -> 0.03048 mm',
        'linear Axis(y)' : 'Motor(y) @ step -> ??? mm',
        'binary ToolUpDown' : 'Motor(t)'
    });
    plotter.visualizeMachine();
});
`;

const defaultStageNames = [
    "sheep", "spinny", "rocket", "ike", "stagezilla", "unicorn", "mustache",
    "plant", "rutabaga", "turnip", "queen", "cedar", "douglas", "quaternion",
    "thevenin", "norton", "ada", "hopper", "derby", "moose", "cliff", "sonoma",
    "hessian", "jacobian", "emerald", "alki", "quilcene", "cascade", "saturn",
    "asteroid", "apricot", "monad", "asymptote", "martingale", "batman",
    "forty-two", "gravenstein", "october", "hyphybot", "gravitas", "charmer",
    "kingman", "euclid", "mechano", "rumbler", "descartes"
];

const DriveQualEnum = {
    LINEAR: 0,
    ROTARY: 1,
    VOLUMETRIC: 2,
    BINARY: 3
};

const MESH_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true
});

const LINE_MATERIAL = new THREE.LineBasicMaterial({
    color: 0xffffff
});

const greenColor = 0xbed346;
const platformRaiseTranslateFactor = 8;

// NOTE: +y is the "up" direction

THREE.Vector3.prototype.approxEqual = function(v) {
    return Math.abs(v.x - this.x) <= EPSILON
           && Math.abs(v.y - this.y) <= EPSILON
           && Math.abs(v.z - this.z) <= EPSILON;
};

/* MESH STUFF */

class ModelMesh {
    // TODO
}

let loadStl = (filepath) => {
    addPaneDomWithType('blank');
    let promise = makeLoadStlPromise(filepath);
    return addStlFromPromise(promise);
};

let makeLoadStlPromise = (filepath) => {
    let loadPromise = new Promise(resolve => {
        let loader = new THREE.STLLoader();
        let stlMesh;
        return loader.load(filepath, (stlGeom) => {
            stlMesh = new THREE.Mesh(stlGeom, MESH_MATERIAL);
            stlMesh.isLoadedStl = true;
            resolve(stlMesh);
        }, undefined, (errorMsg) => {
            console.log(errorMsg);
        });
    });
    return loadPromise;
};

let addStlFromPromise = (promise) => {
   return promise.then((mesh) => {
       scenes[activePaneIndex].add(mesh);
   });
};

let getStlMeshes = () => {
    return scenes[activePaneIndex].children.filter((child) => {
        return child.isLoadedStl;
    });
};

let meshToGeometry = (mesh) => {
    return new THREE.Geometry().fromBufferGeometry(mesh.geometry);
};

let initStl = () => {
    loadStl('assets/pikachu.stl').then(() => {
        // NOTE: we have to assign promise values to global variables
        mesh = getStlMeshes()[0];
        geometry = meshToGeometry(mesh);
    });
};

/* SLICNG OPERATIONS */

class Layers {
    // TODO: some wrapper, provide rendering functions
}

class Slicer {
    constructor(kvs) {
        this._layerHeight = kvs.layerHeight;
        this._infill = kvs.infill;
    }

    get layerHeight() {
        return this._layerHeight;
    }

    get infill() {
        return this.infill;
    }

    slice(mesh, nonBufferGeometry) {
        /* Returns intersection point, or undefined if no intersection */
        let segmentPlaneIntersect = (v0, v1, plane) => {
            let v0_dist_to_plane = plane.distanceToPoint(v0);
            let v1_dist_to_plane = plane.distanceToPoint(v1);
            if (v0_dist_to_plane * v1_dist_to_plane < 0) {
                // NOTE: isect = v0 + t * (v1 - v0)
                let t = v0_dist_to_plane / (v0_dist_to_plane - v1_dist_to_plane);
                let isect = new THREE.Vector3().copy(v0);
                let rest = new THREE.Vector3().copy(v1).sub(v0).multiplyScalar(t);
                return isect.add(rest);
            }
        };
        let calcSegmentsForPlane = (plane) => {
            let isectSegments = [];
            nonBufferGeometry.faces.forEach((face) => {
                let v0 = mesh.localToWorld(nonBufferGeometry.vertices[face.a]);
                let v1 = mesh.localToWorld(nonBufferGeometry.vertices[face.b]);
                let v2 = mesh.localToWorld(nonBufferGeometry.vertices[face.c]);
                let isect01 = segmentPlaneIntersect(v0, v1, xzPlane);
                let isect12 = segmentPlaneIntersect(v1, v2, xzPlane);
                let isect20 = segmentPlaneIntersect(v2, v0, xzPlane);
                if (isect01 !== undefined && isect12 !== undefined) {
                    isectSegments.push([isect01, isect12])
                }
                if (isect01 !== undefined && isect20 !== undefined) {
                    isectSegments.push([isect01, isect20])
                }
                if (isect12 !== undefined && isect20 !== undefined) {
                    isectSegments.push([isect12, isect20])
                }
            });
            return isectSegments;
        };
        let calcContoursForLayerSegment = (segments, segIdx) => {
            if (segments.length === 0) {
                return [];
            }
            let contours = [];
            // NOTE: define a contour as an ordered list of points
            let currContour = [];
            let unvisitedSegments = segments.slice();
            let currSegment = unvisitedSegments[0];
            let pointToPush = currSegment[0];
            let pointForFindingNextSeg = currSegment[1];
            while (unvisitedSegments.length > 0) {
                currContour.push(pointToPush);
                unvisitedSegments.splice(unvisitedSegments.indexOf(currSegment), 1);
                let foundNextSegment = unvisitedSegments.some((potentialSegment) => {
                    if (potentialSegment[0].approxEqual(pointForFindingNextSeg)) {
                        currSegment = potentialSegment;
                        pointToPush = potentialSegment[0];
                        pointForFindingNextSeg = potentialSegment[1];
                        return true;
                    }
                    if (potentialSegment[1].approxEqual(pointForFindingNextSeg)) {
                        currSegment = potentialSegment;
                        pointToPush = potentialSegment[1];
                        pointForFindingNextSeg = potentialSegment[0];
                        return true;
                    }
                });
                if (!foundNextSegment) {
                    contours.push(currContour.slice());
                    currContour = [];
                    if (unvisitedSegments.length > 0) {
                        currSegment = unvisitedSegments[0];
                        pointToPush = currSegment[0];
                        pointForFindingNextSeg = currSegment[1];
                    }
                }
            }
            return contours;
        };
        geometry.computeBoundingBox();
        let planeHeight = geometry.boundingBox.min.y;
        let maxHeight = geometry.boundingBox.max.y;
        let xzPlane, segments, layerContours;
        let contoursPerLayer = [];
        while (planeHeight <= maxHeight) {
            // NOTE: constant should be negative because plane -> origin distance
            // is downward
            xzPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);
            segments = calcSegmentsForPlane(xzPlane);
            layerContours = calcContoursForLayerSegment(segments);
            contoursPerLayer.push(layerContours);
            planeHeight += this.layerHeight;
        }
        return contoursPerLayer;
    };

    visualizeContours(contours) {
        addPaneDomWithType('blank');
        let layerHeightShapesPairs = contours.map((contours) => {
            let sliceHeight = contours[0] && contours[0][0].y;
            let shapes = contours.map((contour) => {
                let pts2d = contour.map((vec3) => new THREE.Vector2(vec3.x, vec3.z));
                let shape = new THREE.Shape(pts2d);
                return shape;
            });
            return [sliceHeight, shapes];
        });
        layerHeightShapesPairs.forEach((heightShapePair) => {
            let height = heightShapePair[0];
            let shapes = heightShapePair[1];
            let geometries = shapes.map((shape) => new THREE.ShapeGeometry(shape));
            let edgeGeometries = geometries.map((geom) => new THREE.EdgesGeometry(geom))
            let lines = edgeGeometries.map((geom) => new THREE.LineSegments(geom, LINE_MATERIAL));
            lines.forEach((line) => {
                line.translateZ(height);
                scenes[activePaneIndex].add(line);
            });
        });
        return layerHeightShapesPairs;
    };

}

let visualizePoints = (isectPts) => {
    let pointsMaterial = new THREE.PointsMaterial({
        size: 5.0,
        color: 0xEA2027
    });
    let pointsGeom = new THREE.Geometry();
    pointsGeom.vertices = isectPts;
    let pointsObj = new THREE.Points(pointsGeom, pointsMaterial);
    scene.add(pointsObj);
    return pointsObj;
};

/* MACHINE IMPLEMENTATIONS */

/**
 * The Machine object represents an AST of a virtual Machine, where the AST
 * is used to compute forward and inverse kinematics. In addition, when the
 * Machine object is paired with one or more Tool objects, each Tool uses
 * the Motors defined in the Machine to generate appropriate physical machine
 * instructions e.g. GCode. To instantiate a Machine object, pass in an object
 * using Machine-o-Matic DSL syntax, where each property-value is of the
 * following form:
 *
 * <DRIVE_STATEMENT> : <MOTOR_STATEMENT>
 *
 * where
 *
 * <DRIVE_STATEMENT> ::= "<QUAL> [Axis(] <IDEN> [)]"
 * <MOTOR_STATEMENT> ::= "Motor(<IDEN>) [@ <STEP>]"
 * <QUAL> ::=  linear | rotary | volumetric | binary
 * <STEP> ::= step -> <NUM> (mm | rad | mm3)
 *
 * E.g.
 * {
 *     "linear Axis(x)" : "Motor(x) @ step -> 0.123mm",
 *     "linear Axis(y) : "Motor(y) @ step -> ???mm",
 *     "rotary Axis(theta) : "Motor(t) @ step -> 2.7rad",
 *     "volumetric Compressor : "Motor(c) @ step -> ???mm3",
 *     "binary PenUpDown : "Motor(p)"
 * }
 *
 * ??? are determined at run time by probing the machine and having the
 * user measure the displacement.
 *
 * For machines with non-direct drive kinematics e.g. delta bot or CoreXY,
 * define properties as so: // TODO
 * {
 *     "linear Axis(x) : "Motor(a), Motor(b) @ <need to think about this>
 * }
 * */

class Machine {
    constructor(kvs) {
        this._root = {
            tools: [],
            drives: [],
            motors: []
        };
        this._kvs = kvs;
        this._initFromMomKvs(kvs)
    }

    get tools() {
        return this._root.tools;
    }

    get drives() {
        return this._root.drives;
    }

    get motors() {
        return this._root.motors;
    }

    get axes() {
        return this._root.drives.filter((drive) => drive.isAxis)
                                .map((axisDrive) => axisDrive.name);
    }

    get description() {
        let kvStrings = Object.keys(this._kvs).map((key) => {
            return key.concat(' : ').concat(this._kvs[key]);
        });
        return kvStrings.join('\n');
    }

    visualizeMachine() {
        // TODO: currently hardcoded. make these calls from the Machine AST
        addPaneDomWithType('blank');
        let paneIndex = pagePaneIndexCounter - 1;
        let scene = scenes[paneIndex];
        let camera = cameras[paneIndex];

        let stageX1 = addLinearStage(scene, camera);
        stageX1.position.x = -160;
        let stageX2 = addLinearStage(scene, camera);
        stageX2.position.x = 85;
        let stageY = addLinearStage(scene, camera);
        stageY.rotateY(Math.PI / 2);
        stageY.position.y = 100;

        camera.zoom = 0.25;
        camera.updateProjectionMatrix();
    }

    /* PRIVATE METHODS */

    _initFromMomKvs(kvs) {
        let driveMotorTokenPairs = [];
        Object.keys(kvs).forEach((key) => {
            let driveStatementStr = key;
            let motorStatementStr = kvs[key];
            let driveTokens = this._parseDriveStatement(driveStatementStr);
            let motorTokens = this._parseMotorStatement(motorStatementStr);
            driveMotorTokenPairs.push([driveTokens, motorTokens]);
        });
        this._buildAstFromDriveMotorPairs(driveMotorTokenPairs);
    }

    // TODO: check for syntax errors
    _parseDriveStatement(str) {
        let tokens = str.split(' ');
        if (tokens.length !== 2) {
            console.error(`Parsing error: ${str}`);
        }
        let regex = /Axis\([a-z]+\)/;
        let regexResult = tokens[1].match(regex);
        if (regexResult) {
            // Have token of the form "Axis(<IDEN>)"
            let splitAxisIden = regexResult[0].replace(')', '').split('(');
            return [tokens[0]].concat(splitAxisIden);
        } else {
            return tokens;
        }
    }

    _parseMotorStatement(str) {
        let tokens = str.split(' ');
        let motorIden = tokens[0].replace(')', '').split('(')[1];
        let atSymbolIndex = tokens.indexOf('@');
        if (atSymbolIndex === -1) {
            return [motorIden];
        }
        if (tokens[atSymbolIndex + 1] === 'step') {
            let displToken = tokens[atSymbolIndex + 3];
            let regex = /[0-9]+\.[0-9]+/;
            let regexResult = displToken.match(regex);
            if (regexResult) {
                return [motorIden].concat(regexResult[0]);
            }
        }
        return [motorIden].concat(tokens[atSymbolIndex + 1]);
    }

    /** DM_PAIRS is an array of the e.g. following:
     * [['linear', 'axis', 'x'], ['x', 0.123]]
     */
    _buildAstFromDriveMotorPairs(dmPairs) {
        dmPairs.forEach((dmPair) => {
            let driveTokens = dmPair[0];
            let motorTokens = dmPair[1];
            let qual = driveTokens[0];
            let isAxis = driveTokens[1] === 'Axis';
            let driveIden;
            if (isAxis) {
                driveIden = driveTokens[2];
            }
            else {
                driveIden = driveTokens[1];
            }
            let motorIden = motorTokens[0];
            let motorTransfer;
            if (motorTokens.length == 2) {
                motorTransfer = motorTokens[1];
            }
            let driveNode = new Drive(qual, isAxis, driveIden);
            let motorNode = new Motor(motorIden, motorTransfer);
            driveNode.setMotors([motorNode]);
            motorNode.setDrives([driveNode]);
            this._root.drives.push(driveNode);
            this._root.motors.push(motorNode);
        });
    }
}

class Tool {
    // TODO: include actions in the domain specific language
}

/* The following are generated as parts of the AST */

class Drive {
    constructor(qual, isAxis, name) {
        this.qual = qual;
        this.isAxis = isAxis;
        this.name = name;
        this.motors = [];
    }

    setMotors(motors) {
        this.motors = motors;
    }
}

class Motor {
    constructor(name, transfer) {
        this.name = name;
        this.transfer = transfer;
        this.drives = [];
    }

    setDrives(drives) {
        this.drives = drives;
    }
}

/* PROGRAM TEXT UTILITIES */

let programTextToDivs = (programText) => {
    let programTextElem = document.querySelector('.program-container');
    let programTextLines = programText.split('\n');
    let divs = programTextLines.map((line) => {
        let div = document.createElement('div');
        div.innerHTML = line;
        div.className = 'code-line';
        return div;
    });
    programTextElem.innerHTML = '';
    divs.forEach((div) => programTextElem.appendChild(div));
};

let reduceDivsToProgramText = () => {
    let divArr = Array.from(document.querySelectorAll('.code-line'));
    return divArr.reduce((text, div) => text.concat(`${div.innerText}\n`), '');
};

// TODO: alsongisde other evaluation
let scanProgramAndGeneratePanes = (programText) => {

};

// TODO: something to partially or completely evaluate the program text
// such that the program text IS the program being executed, with handles
// for the visual panes

/* MACHINE FRONTEND */

let addLinearStage = (scene, camera) => {
    let group = _makeStageInScene('linear', scene);
    // _addConnectionHandlesToGroup(group);
    _addGroupToScene(group, scene, camera);
    return group;
};

let _addGroupToScene = (group, scene, camera, adjustPosition=true) => {
    scene.add(group);
    // destroyControl();
    // generateControlForGroup(group, scene, camera);

    if (adjustPosition) {
        group.position.y = 50;
        group.position.x = -35;
        group.position.z = 35;
    }

    // focus(group);

};

const geometryFactories = {
    stageCase: () => new THREE.BoxBufferGeometry(200, 100, 1000, 2, 2, 2),
    stagePlatform: () => new THREE.BoxBufferGeometry(200, 150, 200, 2, 2, 2),
    rotaryStageCase: () => new THREE.BoxBufferGeometry(150, 50, 150, 2, 2, 2),
    rotaryStagePlatform: () => new THREE.CylinderBufferGeometry(50, 50, 80, 10),
    angledTool: () => new THREE.CylinderBufferGeometry(10, 10, 80, 10),
    straightTool: () => new THREE.CylinderBufferGeometry(10, 10, 80, 10),
    connectionHandle: () => new THREE.SphereBufferGeometry(25, 32, 32)
};

let _makeStageInScene = (stageType, scene) => {
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
    let stageCaseLines = new THREE.LineSegments(stageCaseEdges, new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 5 } ));
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
    let stagePlatformLines = new THREE.LineSegments(stagePlatformEdges, new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 5 } ));
    let stagePlatformMesh = new THREE.Mesh(stagePlatform, group.color);
    stagePlatformMesh.name = 'stagePlatform';
    stagePlatformMesh.material.transparent = true;

    group.add(stageCaseLines);
    group.add(stageCaseMesh);
    group.add(stagePlatformLines);
    group.add(stagePlatformMesh);
    // scene.add(group);

    // NOTE: currently we get the id of the Mesh (ignoring group and line ids)
    // May have to change this in the future
    let groups = getStages(scene);
    // let stageId = groups[groups.length - 1].id;

    let stageNameIndex = Math.floor(Math.random() * defaultStageNames.length);
    let stageName = defaultStageNames[stageNameIndex];
    group.stageName = stageName;
    group.axis = 'y';

    return group;

}

let generateControlForGroup = (group, scene, camera) => {
    // Add controls to the new mesh group
    let lastPosition = new THREE.Vector3();
    let currPosition = new THREE.Vector3();
    let control = new THREE.TransformControls( camera, renderer.domElement );
    let offset = new THREE.Vector3();
    // let parentMods = gatherDeepParentStages(group);
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

let getStages = (scene) => {
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

/* SCENE RENDERING MAIN FUNCTIONS */

let animate = () => {
    cappedFramerateRequestAnimationFrame(30);
    render();
    // stats.update();
};

let renderWithAnimate = () => {
    let deltaSeconds = clock.getDelta();
    mixers.forEach((mixer) => {
        mixer.update(deltaSeconds);
    });
    renderer.render(scene, camera);
};

let makeScene = (domElement) => {
    let scene = new THREE.Scene();
    let aspect = domElement.offsetWidth / domElement.offsetHeight;
    let viewSize = 50;
    let camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect,
        viewSize, -viewSize, -1000, 10000);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.frustumCulled = false;
    camera.position.set(-500, 500, 500); // I don't know why this works
    camera.lookAt(scene.position);
    scene.add(camera);
    scene.background = new THREE.Color(0x000000);
    scene.add(new THREE.GridHelper(2000, 50, 0xe5e6e8, 0x444444));
    return { scene, camera, undefined };
}

let addScene = (elem, fn) => {
    const ctx = document.createElement('canvas').getContext('2d');
    elem.appendChild(ctx.canvas);
    sceneElements.push({elem, ctx, fn});
};

/**
 * Adds a pane DOM element and inflates it using the inflate function
 * corresponding to PANE_TYPE. PANE_TYPE should correspond with a key
 * in PANE_INFLATE_FUNCTIONS_BY_NAME. */
let addPaneDomWithType = (paneType) => {
    let panesContainerDom = document.querySelector('.panes-container');
    let paneContainerDom = document.createElement('div');
    paneContainerDom.className = 'pane-container';
    let diagramDom = document.createElement('div');
    diagramDom.setAttribute('data-diagram', paneType);
    diagramDom.className = 'left';
    diagramDom.id = pagePaneIndexCounter;
    pagePaneIndexCounter += 1;

    paneContainerDom.appendChild(diagramDom);
    panesContainerDom.appendChild(paneContainerDom);

    let sceneInitFunction = paneInflateFunctionsByName[paneType];
    if (sceneInitFunction === undefined) {
        console.error(`Can't find inflate function for pane type: ${paneType}.`);
    } else {
        let sceneRenderFunction = sceneInitFunction(diagramDom);
        addScene(diagramDom, sceneRenderFunction);
    }
    return paneContainerDom;
};

/**
 * PANE INFLATE FUNCTIONS
 * Add implementations here about how particular panes should be
 * implemented. */
const paneInflateFunctionsByName = {
    'blank': (elem) => {
        const {scene, camera, controls} = makeScene(elem);
        scenes.push(scene);
        cameras.push(camera);

        activePaneIndex = parseInt(elem.id);

        return () => {
            renderer.render(scene, camera);
        };
    },
    'mesh': (elem) => {
        const {scene, camera, controls} = makeScene(elem);
        scenes.push(scene);
        cameras.push(camera);

        activePaneIndex = parseInt(elem.id);

        loadStl('assets/pikachu.stl').then(() => {
            mesh = getStlMeshes()[0];
            geometry = meshToGeometry(mesh);
        });

        return () => {
            renderer.render(scene, camera);
        };
    },

    'slices': (elem) => {
        const {scene, camera, controls} = makeScene(elem);
        scenes.push(scene);
        cameras.push(camera);

        activePaneIndex = parseInt(elem.id);

        let slicer = new Slicer({
            layerHeight: 1.0,
            infill: 'empty'
        });
        let contours = slicer.slice(mesh, geometry);
        slicer.visualizeContours(contours);

        return () => {
            renderer.render(scene, camera);
        };
    },

    'machine': (elem) => {
        const {scene, camera, controls} = makeScene(elem);
        scenes.push(scene);
        cameras.push(camera);

        activePaneIndex = parseInt(elem.id);

        // TODO: make these calls from the Machine AST
        let stageX1 = addLinearStage(scene, camera);
        stageX1.position.x = -160;
        let stageX2 = addLinearStage(scene, camera);
        stageX2.position.x = 85;
        let stageY = addLinearStage(scene, camera);
        stageY.rotateY(Math.PI / 2);
        stageY.position.y = 100;

        camera.zoom = 0.25;
        camera.updateProjectionMatrix();
        return () => {
            renderer.render(scene, camera);
        };
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

let render = (time) => {
    time *= 0.001;

    for (const {elem, fn, ctx} of sceneElements) {
        // get the viewport relative position opf this element
        const rect = elem.getBoundingClientRect();
        let {left, right, top, bottom, width, height} = rect;
        width *= window.devicePixelRatio;
        height *= window.devicePixelRatio;

        const rendererCanvas = renderer.domElement;

        const isOffscreen =
                bottom < 0 ||
                top > window.innerHeight ||
                right < 0 ||
                left > window.innerWidth;

        if (!isOffscreen) {
            // make sure the renderer's canvas is big enough
            if (rendererCanvas.width < width || rendererCanvas.height < height) {
                // renderer.setPixelRatio(window.devicePixelRatio);
                renderer.setSize(width, height, false);
            }

            // make sure the canvas for this area is the same size as the area
            if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
                ctx.canvas.width = width;
                ctx.canvas.height = height;
            }

            renderer.setScissor(0, 0, width, height);
            renderer.setViewport(0, 0, width, height);

            fn(time, rect);

            // copy the rendered scene to this element's canvas
            ctx.globalCompositeOperation = 'copy';
            ctx.drawImage(
                    rendererCanvas,
                    0, rendererCanvas.height - height, width, height,  // src rect
                    0, 0, width, height);                              // dst rect
        }
    }

    requestAnimationFrame(render);
};

let main = () => {
    let programTextElem = document.querySelector('.program-container');
    programTextToDivs(exampleProgramText);
    programTextElem.spellcheck = false;
    programTextElem.focus();
    programTextElem.blur();

    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
    renderer.setScissorTest(true);
    requestAnimationFrame(render);
};

main();

