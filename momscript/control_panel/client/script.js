'use strict';

let container, stats;
let stageGui, connectionGui;
let renderer;
let scenes = [];
let cameras = [];
let activeSceneCameraIndex = 0;

let topDirectionalLight, leftDirectionalLight, rightDirectionalLight;
let mesh, lines, geometry;
let tool;
let programText;
let clock;
let mixers = [];
let EPSILON = 0.001;

let DriveQualEnum = {
    LINEAR: 0,
    ROTARY: 1,
    VOLUMETRIC: 2,
    BINARY: 3
};

let MESH_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true
});

let LINE_MATERIAL = new THREE.LineBasicMaterial({
    color: 0xffffff
});

// NOTE: +y is the "up" direction

THREE.Vector3.prototype.approxEqual = function(v) {
    return Math.abs(v.x - this.x) <= EPSILON
           && Math.abs(v.y - this.y) <= EPSILON
           && Math.abs(v.z- this.z) <= EPSILON
};

/* SCENE INITIALIZATION */

let initCamera = () => {
    let aspect = window.innerWidth / window.innerHeight;
    let viewSize = 150;
    camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect,
        viewSize, -viewSize, -1000, 10000);
    camera.zoom = 1.5;
    camera.updateProjectionMatrix();
    camera.frustumCulled = false;
    camera.position.set(-500, 500, 500); // I don't know why this works
    camera.lookAt(scene.position);
    // camera.position.set(-400, 500, 800); // Pan away to move machine to left
};

let initScene = () => {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    scene.background = new THREE.Color(0x000000);
    topDirectionalLight = new THREE.DirectionalLight( 0xffffff, 1.00 );
    leftDirectionalLight = new THREE.DirectionalLight( 0xffffff, 0.75 );
    rightDirectionalLight = new THREE.DirectionalLight( 0xffffff, 0.50 );
    leftDirectionalLight.position.set(-1.0, 0.0, 0.0);
    rightDirectionalLight.position.set(0.0, 0.0, 1.0);
    scene.add(topDirectionalLight);
    scene.add(leftDirectionalLight);
    scene.add(rightDirectionalLight);
    scene.add(new THREE.GridHelper(2000, 50, 0xe5e6e8, 0x444444));
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

    window.addEventListener( 'resize', onWindowResize, false );
};

let onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
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

/* MESH STUFF */

class ModelMesh {
    // TODO
}

let loadStl = (filepath) => {
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
       mesh.visible = false;
       scenes[activeSceneCameraIndex].add(mesh);
   });
};

let getStlMeshes = () => {
    return scenes[activeSceneCameraIndex].children.filter((child) => {
        return child.isLoadedStl;
    });
};

let meshToGeometry = (mesh) => {
    return new THREE.Geometry().fromBufferGeometry(mesh.geometry);
};

let test = () => {
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

let sliceMesh = (mesh, nonBufferGeometry, layerHeight) => {
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
        planeHeight += layerHeight;
    }
    return contoursPerLayer;
};

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

let visualizeContours = (contoursPerLayer) => {
    let layerHeightShapesPairs = contoursPerLayer.map((contours) => {
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
            scenes[activeSceneCameraIndex].add(line);
        });
    });
    return layerHeightShapesPairs;
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

    renderMachineInGui() {
        // TODO
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

/* SCENE RENDERING MAIN FUNCTIONS */

let animate = () => {
    cappedFramerateRequestAnimationFrame(30);
    render();
    // stats.update();
};

let render = () => {
    let deltaSeconds = clock.getDelta();
    mixers.forEach((mixer) => {
        mixer.update(deltaSeconds);
    });
    renderer.render( scene, camera );
};

//init();
// animate();

/* SCENE RENDERING */

let makeScene = (domElement) => {
    let scene = new THREE.Scene();
    // let aspect = window.innerWidth / window.innerHeight;
    let aspect = domElement.offsetWidth / domElement.offsetHeight;
    let viewSize = 150;
    let camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect,
        viewSize, -viewSize, -1000, 10000);
    camera.zoom = 1.5;
    camera.updateProjectionMatrix();
    camera.frustumCulled = false;
    camera.position.set(-500, 500, 500); // I don't know why this works
    camera.lookAt(scene.position);
    scene.add(camera);
    scene.background = new THREE.Color(0x000000);
    scene.add(new THREE.GridHelper(2000, 50, 0xe5e6e8, 0x444444));
    return { scene, camera, undefined };
}

/* NEW SCENE RENDERING */

function main() {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({canvas, alpha: true});
    // renderer.setScissorTest(true);

    const sceneElements = [];
    function addScene(elem, fn) {
        const ctx = document.createElement('canvas').getContext('2d');
        elem.appendChild(ctx.canvas);
        sceneElements.push({elem, ctx, fn});
    }

    function nMakeScene(elem) {
        const scene = new THREE.Scene();

        const fov = 45;
        const aspect = 2;  // the canvas default
        const near = 0.1;
        const far = 5;
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        camera.position.set(0, 1, 1);
        camera.lookAt(0, 0, 0);
        scene.add(camera);
        scene.background = new THREE.Color(0x000000);
        cameras.push(camera);

        const controls = new THREE.TransformControls(camera, elem);
        controls.noZoom = true;
        controls.noPan = true;

        {
            const color = 0xFFFFFF;
            const intensity = 1;
            const light = new THREE.DirectionalLight(color, intensity);
            light.position.set(-1, 2, 4);
            scene.add(light);
        }

        return {scene, camera, controls};
    }

    const sceneInitFunctionsByName = {
        'box': (elem) => {
            const {scene, camera, controls} = makeScene(elem);
            scenes.push(scene);
            cameras.push(cameras);
            const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
            const material = new THREE.MeshPhongMaterial({color: 'red'});
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            return (time, rect) => {
                mesh.rotation.y = time * .1;
                camera.aspect = rect.width / rect.height;
                camera.updateProjectionMatrix();
                renderer.render(scene, camera);
            };
        },
        'pyramid': (elem) => {
            const {scene, camera, controls} = makeScene(elem);
            scenes.push(scene);
            cameras.push(cameras);
            const radius = .8;
            const widthSegments = 4;
            const heightSegments = 2;
            const geometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);
            const material = new THREE.MeshPhongMaterial({
                color: 'blue',
                flatShading: true,
            });
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            return (time, rect) => {
                mesh.rotation.y = time * .1;
                camera.aspect = rect.width / rect.height;
                camera.updateProjectionMatrix();
                renderer.render(scene, camera);
            };
        },
    };

    document.querySelectorAll('[data-diagram]').forEach((elem) => {
        const sceneName = elem.dataset.diagram;
        const sceneInitFunction = sceneInitFunctionsByName[sceneName];
        const sceneRenderFunction = sceneInitFunction(elem);
        addScene(elem, sceneRenderFunction);
    });

    function render(time) {
        time *= 0.001;

        for (const {elem, fn, ctx} of sceneElements) {
            // get the viewport relative position opf this element
            const rect = elem.getBoundingClientRect();
            const {left, right, top, bottom, width, height} = rect;
            const rendererCanvas = renderer.domElement;

            const isOffscreen =
                    bottom < 0 ||
                    top > window.innerHeight ||
                    right < 0 ||
                    left > window.innerWidth;

            if (!isOffscreen) {
                // make sure the renderer's canvas is big enough
                if (rendererCanvas.width < width || rendererCanvas.height < height) {
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
    }

    requestAnimationFrame(render);
}

main();

