'use strict';

const DEBUG_RENDER_ONCE = false;

let renderer;
let scenes = [];
let cameras = [];
const sceneElements = [];
let pagePaneIndexCounter = 0;
let activePaneIndex = 0;

let mesh, lines, geometry;
let tool;
let programText;
let clock = new THREE.Clock();
let mixers = [];
let pageProjectionContour;
const EPSILON = 0.001;
const ANIMATION_TIMESCALE = 2;

const pikachuProgramText = `'use strict';
loadStl('assets/pikachu.stl').then((meshGeomPair) => {
    let mesh = meshGeomPair[0];
    let geometry = meshGeomPair[1];
    let slicer = new Slicer({
        layerHeight: 1.0,
        infill: 'empty'
    });
    let layers = slicer.slice(mesh, geometry);
    slicer.visualizeContours(layers);
    let plotter = new Machine({
        'linear Axis(x)' : 'Motor(x1) @ step -> 0.03048 mm, \
                            Motor(x2) @ step -> 0.03048 mm',
        'linear Axis(y)' : 'Motor(y) @ step -> ??? mm',
        'binary ToolUpDown' : 'Motor(t)'
    });
    plotter.visualizeMachine();
    console.log(plotter.getDriveWithName('ToolUpDown'));
    let pen = new Tool(plotter, {
        'penUp' : (bar) => {
            moveToBeginning(ToolUpDown);
        },
        'penDown' : () => {
            moveToEnd(ToolUpDown);
        },
        'drawContourAtPoint' : (contour, point) => {
            // assert(machine.axes matches point);
            // assert(machine.axes matches contour[0]);
            // TODO: can mouse over each line and visualize
            moveTo(point);
            setOrigin();
            // $scale(contour); // dynamically scale and reposition contour
                                // at run time using gui control
            penDown();
            contour.forEach((contourPoint) => {
                console.log(moveTo(contourPoint));
            });
            penUp();
        }
    });
    let connection = new Connection(pen, true);
    let point = {x: 0, y: 0};
    let testContour = layers[1][0];
    connection.connect();
    return connection.execute(() => {
        moveTo({x: 0, y: 0});
        moveTo({x: 100, y: 0});
        moveTo({x: 100, y: 100});
        moveTo({x: 0, y: 100});
    }).then((res) => {
        // stuff after the plotting finishes
        // $controlPad();
        console.log('Post plot');
    });
})
`;

const uistProgramText = `'use strict';
async function main() {
    // TODO: load several small SVGs to choose from
    let svg = await loadSvg('assets/uist-letters_u.svg');
    let contours = convertSvgToContours(svg);
    visualizeContours2d(contours);
    let plotter = new Machine({ preset: 'axidraw' });
    let pen = new Tool(plotter, {
        'penUp' : () => {
            moveToBeginning(ToolUpDown);
        },
        'penDown' : () => {
            moveToEnd(ToolUpDown);
        },
        'drawContour' : (async (contour) => {
            API__sendAndPlotCoords(contourToPointArrays(contour, false)[0][0])
            // penDown();
            // sendContour(contour);
            // penUp();
        })
    });
    plotter.visualizeMachine();
    //let projector = new Projector();
    let connection = new Connection(pen, true);
    connection.connect();
    $transformLineInSceneNum(0);
    let updatedLineObj = getLineObjFromSceneNum(0);
    let updatedContour = lineObjToContour(updatedLineObj);
    return connection.execute((drawing) => {
        //projector.project(drawing);
        //$svg.scaleAndTranslate();
        drawContour(drawing);
    }, [updatedContour]);
}
main();
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

const reservedWords = [
    "break", "case", "catch", "continue", "debugger", "default", "delete",
    "do", "else", "finally", "for", "function", "if", "in", "instanceof",
    "new", "return", "switch", "this", "throw", "try", "typeof", "var", "void",
    "while", "with", "class", "const", "enum", "export", "extends", "import",
    "super", "implements", "interface", "let", "package", "private",
    "protected", "public", "static", "yield", "async", "await", "null",
    "undefined", "true", "false", "NaN", "Infinity"
];

const declarationWords = [
    "let", "const", "var"
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

// NOTE: +z is the "up" direction

THREE.Vector3.prototype.approxEqual = function(v) {
    return Math.abs(v.x - this.x) <= EPSILON
           && Math.abs(v.y - this.y) <= EPSILON
           && Math.abs(v.z - this.z) <= EPSILON;
};

/**
 * @param {Number[][]} coordsArr - array of coords, each coord [x, y]
 */
let API__sendAndPlotCoords = (coordsArr) => {
    let req = new XMLHttpRequest();
    let coordsObj = {
        'coords' : coordsArr
    };
    req.open('POST', '/plot');
    req.setRequestHeader('Content-Type', 'application/json');
    req.send(JSON.stringify({ "coordsObj" : coordsObj }));
};

let API__sendContourToProjection = (contour) => {
    let req = new XMLHttpRequest();
    req.open('POST', '/projection');
    req.setRequestHeader('Content-Type', 'application/json');
    req.send(JSON.stringify({ "contour" : contour }));
};

let API__getContourFromServer = (contour) => {
    let req = new XMLHttpRequest();
    req.open('get', '/projection');
    req.setRequestHeader('Content-Type', 'application/json');
    req.onload = () => {
        if (req.status !== 200) {
            console.log(`Error ${req.status} getting projection: ${req.statusText}`);
        }
        else {
            console.log(`Received ${req.response} from server`);
            pageProjectionContour = JSON.parse(req.response);
        }
    };
    req.send();
};

let setIntervalForProjectionPoll = (interval) => {
    return setInterval(() => {
        resetPanes();
        API__getContourFromServer();
        if (pageProjectionContour) {
            visualizeContours2d(pageProjectionContour);
        }
    }, interval);
};

/* 2D DRAWING STUFF */

let loadSvg = async (filepath) => {
    let loader = new THREE.SVGLoader();
    let isItGeom = await (() => {
        return new Promise((resolve) => {
            loader.load(filepath, (svgGeom) => {
                resolve(svgGeom);
            }, undefined, (errorMsg) => {
                console.log(errorMsg);
            });
        });
    })();
    return isItGeom;
};

let drawSvgToPane = (svg) => {
    addPaneDomWithType('blank2d');
    let group = new THREE.Group();
    svg.paths.forEach((path) => {
        let shapes = path.toShapes(true);
        shapes.forEach((shape) => {
            let geom = new THREE.ShapeBufferGeometry(shape);
            let edgeGeom = new THREE.EdgesGeometry(geom);
            let segments = new THREE.LineSegments(edgeGeom, LINE_MATERIAL);
            group.add(segments);
        });
    });
    scenes[activePaneIndex].add(group);
    group.rotateX(Math.PI);
};

let convertSvgToContours = (svg) => {
    let contours = [];
    svg.paths.forEach((path) => {
        let shapes = path.toShapes(true);
        let layerContours = [];
        shapes.forEach((shape) => {
            let points2d = shape.getPoints();
            let points3d = points2d.map((point) => {
                return new THREE.Vector3(point.x, point.y, 0);
            });
            layerContours.push(points3d);
        });
        contours.push(layerContours);
    });
    return contours;
}

let visualizeContours2d = (contoursPerLayer) => {
    addPaneDomWithType('blank2d');
    let group = new THREE.Group();
    contoursPerLayer.forEach((layerContours) => {
        let geom = new THREE.Geometry();
        layerContours.forEach((contour) => {
            contour.forEach((point) => geom.vertices.push(point));
            // geom.vertices.push(contour[0]);
            let line = new THREE.LineLoop(geom, LINE_MATERIAL);
            group.add(line);
        });
    });
    scenes[activePaneIndex].add(group);
    // TODO: this may cause the points to differ from points sent to GCode
    // keep an eye on this.
    // group.rotateX(Math.PI);
    return group;
};

let lineObjToContour = (lineObj) => {
    // Force update in case the renderer doesn't get to it first
    lineObj.updateMatrixWorld(true);
    let geom = lineObj.geometry;
    let vertices;
    if (geom instanceof THREE.Geometry) {
        vertices = lineObj.geometry.vertices;
    }
    else {
        let buffer = geom.attributes.position;
        let numVertices = buffer.count;
        vertices = [...Array(numVertices).keys()].map((vtxIdx) => {
            return new THREE.Vector3(buffer.getX(vtxIdx), buffer.getY(vtxIdx), 0);
        });
    }
    let newLineObj = new THREE.LineLoop(new THREE.Geometry(), LINE_MATERIAL);
    newLineObj.copy(lineObj);
    newLineObj.geometry.applyMatrix(newLineObj.matrixWorld);
    return [[newLineObj.geometry.vertices]];
};

let contourToPointArrays = (contoursByLayer, downscale) => {
    return contoursByLayer.map((layerContours) => {
        return layerContours.map((contour) => {
            if (downscale) {
                return contour.map((vec3) => [vec3.x * 0.1, vec3.y * 0.1]);
            }
            else {
                return contour.map((vec3) => [vec3.x, vec3.y]);
            }
        });
    });
};

let orderContourVec3s = (contoursByLayer) => {
    return contoursByLayer.map((layerContours) => {
        return layerContours.map((contour) => {
            let addNeighboringPointAndUpdateArrays
                    = (point, newContour, contour) => {
                if (contour.length === 0) {
                    return [null, newContour, contour]
                }
                let neighboringPoint;
                // TODO: probably not worth finishing this because it wouldn't
                // fix a corrupted vertex ordering
            };
            let contourCopy = contour.splice();
            let newContour = [];
            let point = contour[0];
            addNeighboringPointToNewContour(point, newContour, contourCopy);
        });
    });
};

let getLineObjFromSceneNum = (sceneNum) => {
    let maybeLineObj = scenes[sceneNum].children
        .find((obj) => obj.type === 'LineLoop');
    if (maybeLineObj) {
        return maybeLineObj;
    }
    else {
        let groups = scenes[sceneNum].children
            .filter((obj) => obj.type === 'Group');
        let groupObjs = groups.map((group) => group.children).flat();
        return groupObjs.find((obj) => obj.type === 'LineLoop');
    }
};

/* MESH STUFF */

class ModelMesh {
    // TODO
}

let loadStl = (filepath) => {
    addPaneDomWithType('blank3d');
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
       let geometry = meshToGeometry(mesh);
       return [mesh, geometry];
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
        nonBufferGeometry.computeBoundingBox();
        let planeHeight = nonBufferGeometry.boundingBox.min.y;
        let maxHeight = nonBufferGeometry.boundingBox.max.y;
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

    /**
     * Creates a new pane and draws contours.
     *
     * @param {Vector3[][]} contours - An array of layers, where each layer is
     *                                 an array of Vector3 points.
     * @return {void}
     */
    visualizeContours(contours) {
        addPaneDomWithType('blank3d');
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

let DEBUG__visualizePointOrderInScene = (line, scene) => {
    let geom = line.geometry;
    let pointsMaterial = new THREE.PointsMaterial({
        size: 5.0,
        color: 0xEA2027
    });
    let pointObjs;
    let numVertices;
    if (line.geometry instanceof THREE.Geometry) {
        let vertices = line.geometry.vertices;
        pointObjs = vertices.map((vtx) => {
            let singleGeom = new THREE.Geometry();
            singleGeom.vertices = [vtx];
            return new THREE.Points(singleGeom, pointsMaterial);
        });
        numVertices = pointObjs.length;
    }
    else {
        let buffer = geom.attributes.position;
        numVertices = buffer.count;
        pointObjs = [...Array(numVertices).keys()].map((vtxIdx) => {
            let vec3 = new THREE.Vector3(buffer.getX(vtxIdx), buffer.getY(vtxIdx), 0);
            let singleGeom = new THREE.Geometry();
            singleGeom.vertices = [vec3];
            return new THREE.Points(singleGeom, pointsMaterial);
        });
    }
    let currPtIdx = 0
    let interval = setInterval(() => {
        if (currPtIdx >= numVertices) {
            clearInterval(interval);
        }
        else {
            scene.add(pointObjs[currPtIdx]);
            currPtIdx += 1;
        }
    }, 100);
    return interval
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
 * <MOTOR_STATEMENT> ::= "(Motor(<IDEN>) [@ <STEP>])*"
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
        if (kvs['preset'] !== undefined) {
            if (kvs['preset'] === 'axidraw') {
                kvs['linear Axis(x)'] = 'Motor(x1) @ step -> 0.03048 mm, Motor(x2) @ step -> 0.03048 mm';
                kvs['linear Axis(y)'] = 'Motor(y) @ step -> ??? mm';
                kvs['binar ToolUpDown'] = 'Motor(t)';
                delete kvs['preset'];
            }
            else {
                console.error('Unrecognized machine preset.');
            }
        }
        this._root = {
            tools: [],
            drives: [],
            motors: []
        };
        this._kvs = kvs;
        this._initFromMomKvs(kvs);
        this._initDriveNames();
    }

    get tools() {
        return this._root.tools;
    }

    get drives() {
        return this._root.drives;
    }

    get driveNames() {
        return this._driveNames;
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

    getDriveWithName(driveName) {
        return this.drives.filter((drive) => drive.name === driveName)[0];
    }

    visualizeMachine() {
        // TODO: currently only works with cantilever + parallel 2D plotter
        // designs where y is on top. The problem is that it is difficult to
        // infer the visual layout of a machine from only what's provided
        // in the DSL. This is worth thinking through at a later point.
        addPaneDomWithType('blank3d');
        let paneIndex = pagePaneIndexCounter - 1;
        let scene = scenes[paneIndex];
        scene.machineScene = true;
        let camera = cameras[paneIndex];
        let offset = 120;
        let miniOffset = 5.5;
        let heightOffset = 75;

        this.drives.forEach((drive) => {
            let stage;
            let stageOffsetFactor = -1;
            if (drive.isAxis) {
                drive.motors.forEach((motor) => {
                    stage = addLinearStage(scene, camera);
                    if (drive.name === 'x') {
                        stage.position.x = stageOffsetFactor * offset;
                        stageOffsetFactor += 2;
                    }
                });
                if (drive.name === 'y') {
                    stage.position.x = miniOffset;
                    stage.position.z = heightOffset;
                    stage.rotateZ(Math.PI / 2);
                }
            }
        });

        let tool = addStraightTool(scene, camera);
        camera.zoom = 0.25;
        camera.updateProjectionMatrix();
        if (DEBUG_RENDER_ONCE) {
            render();
        }
    }

    visualizeMachineTest() {
        addPaneDomWithType('blank3d');
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
        let tool = addStraightTool(scene, camera);

        camera.zoom = 0.25;
        camera.updateProjectionMatrix();
        if (DEBUG_RENDER_ONCE) {
            render();
        }
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

    _initDriveNames() {
        let nonAxisDrives = this.drives.filter((drive) => !drive.isAxis);
        let axisDrives = this.drives.filter((drive) => drive.isAxis);
        let nonAxisDriveNames = nonAxisDrives.map((drive) => drive.name);
        let axisDriveNames = axisDrives.map((drive) =>
                                `Axis(${drive.name})`);
        this._driveNames = nonAxisDriveNames.concat(axisDriveNames);
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

    /**
     * Parses a motor statement, or a comma-delimited list thereof.
     */
    _parseMotorStatement(str) {
        let statements = str.split(',');
        return statements.map((statement) => {
            let tokens = statement.trim().split(' ');
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
        });
    }

    /** DM_PAIRS is an array of the e.g. following:
     * [['linear', 'axis', 'x'], ['x', 0.123]], or for multiple motors,
     * [['linear', 'axis', 'x'], ['x1', 0.6, 'x2', 0.6]]
     */
    _buildAstFromDriveMotorPairs(dmPairs) {
        dmPairs.forEach((dmPair) => {
            let driveTokens = dmPair[0];
            let motorTokenPairs = dmPair[1];
            let qual = driveTokens[0];
            let isAxis = driveTokens[1] === 'Axis';
            let driveIden;
            if (isAxis) {
                driveIden = driveTokens[2];
            }
            else {
                driveIden = driveTokens[1];
            }
            let driveNode = new Drive(qual, isAxis, driveIden);

            let motorNodes = motorTokenPairs.map((tokenPair) => {
                let motorIden = tokenPair[0];
                let motorTransfer;
                if (tokenPair.length == 2) {
                    motorTransfer = tokenPair[1];
                }
                let motorNode = new Motor(motorIden, motorTransfer);
                motorNode.setDrives([driveNode]);
                return motorNode;
            });

            driveNode.setMotors(motorNodes);
            this._root.motors.push(motorNodes);
            this._root.drives.push(driveNode);
        });
    }
}

class Tool {
    constructor(machine, actionsByName) {
        this.machine = machine;
        this.actionsByName = actionsByName;
        this.__inflateActionsToMethods();
    }

    _setConnection(connection) {
        this.connection = connection
    }

    /** Base actions **/

    moveToBeginning(drive) {
        console.log('Not yet implemented.')
    }

    moveToEnd(drive) {
        console.log('Not yet implemented.')
    }

    moveTo(point) {
        let axisValStrs = Object.keys(point).map((axisName) => {
            return `${axisName.toUpperCase()}${point[axisName]}`;
        });
        let gcodeLine = `G0 ${axisValStrs.join(' ')}`;
        let machineScene = scenes.find((scene) => scene.machineScene);
        return new Promise((resolve) => {
            if (this.connection && this.connection.isVirtual) {
                let position = new THREE.Vector3(point.x, point.y, point.z);
                console.log(gcodeLine);
                return animateObjToPosition(getTool(machineScene), position)
                    .then(() => resolve());
            }
            else if (this.connection && !this.connection.isVirtual) {
                // Send GCode over serial, get confirmation, resolve
            }
            else {
                console.error('No connection.');
            }
        });
    }

    sendContour(contour) {
        console.log('Not yet implemented.')
    }

    setOrigin() {
        console.log('Not yet implemented.')
    }

    /**
     * NOTE: by defining action methods within a class method, the keyword
     * 'this' gets bound to the Tool object in the closure.
     */
    __inflateActionsToMethods() {
        Object.keys(this.actionsByName).forEach((actionName) => {
            let methodText = this.actionsByName[actionName].toString();
            let newMethod = eval(LangUtil.injectScopeToMethodText(methodText, this));
            this[actionName] = newMethod;
        });
    }

}
/* LANGUAGE UTILS */

class LangUtil {

    static interactiveFunctionTexts = {
        '$interpreter' : (function $interpreter() {
            // TODO: just use debugger until we have a real REPL
            debugger;
        }).toString(),
        '$calibrateProjection' : (function $calibrateProjection() {
            console.log(machine);
        }).toString(),
        '$transformLineInSceneNum' : (function $transformLineInSceneNum(sceneNumber) {
            console.log('in transform');
            let tControl = generateTranslateControlsForSingleObjSceneNum(sceneNumber);
            let keepWaiting = true;
            window.addEventListener('keydown', (event) => {
                let escapeKeycode = 27;
                let sKeyCode = 83;
                let rKeyCode = 82;
                let tKeyCode = 84;
                let pKeyCode = 80;
                let dKeyCode = 68;
                if (event.keyCode === escapeKeycode) {
                    keepWaiting = false;
                }
                if (event.keyCode === sKeyCode) {
                    tControl.setMode('scale');
                }
                if (event.keyCode === rKeyCode) {
                    tControl.setMode('rotate');
                }
                if (event.keyCode === tKeyCode) {
                    tControl.setMode('translate');
                }
                if (event.keyCode === pKeyCode) {
                    computeAndSendToProjector();
                }
                if (event.keyCode === dKeyCode) {
                    draw();
                }
            });
            let lineContour;
            let computeAndSendToProjector = () => {
                let lineObj = getLineObjFromSceneNum(sceneNumber);
                lineContour = lineObjToContour(lineObj);
                API__sendContourToProjection(lineContour);
            };
            let draw = () => {
                API__sendAndPlotCoords(contourToPointArrays(lineContour, false)[0][0])
            }
            let spinLock = () => {
                if (keepWaiting) {
                    console.log('spinnin');
                    setTimeout(spinLock, 500);
                }
                else {
                    computeAndSendToProjector();
                    tControl.detach();
                }
            };
            spinLock();
        }).toString()
    };

    /**
     * Rebinds MoMScript calls with missing scope to valid Javascript
     *
     * @param {string} fnString - the string representing the function statement
     * @param {Object} rebindObj - the Object representing the keyword this that
     *                             will be rebound into the function
     * @returns {string} the function text with necessary expressions rebound
     */
    static injectScopeToMethodText(fnString, rebindObj) {
        let fnAst = esprima.parse(fnString, { range : true });
        let params = fnAst.body[0].expression.params;
        let bodyStatements = fnAst.body[0].expression.body.body;
        let idenNodes = [];
        bodyStatements.forEach((statement) => {
            LangUtil.traverse(statement, (node) => {
                if (node.type === 'Identifier') {
                    Array.prototype.push.call(idenNodes, node);
                }
            });
        });
        if (Tool.prototype.isPrototypeOf(rebindObj)) {
            idenNodes.forEach((node) =>
                LangUtil.rebindNodeIdenForAction(node, rebindObj));
        }
        return escodegen.generate(fnAst);
    }

    static preprocess(progText) {
        let ast = esprima.parse(progText);
        let injectedMainAst =
            LangUtil.injectInteractiveFunctionsIntoMain(ast);
        let newProgText = escodegen.generate(injectedMainAst);
        return newProgText;
    }

    /**
     * Adds $interactive function declarations at the beginning of main function
     */
    static injectInteractiveFunctionsIntoMain(ast) {
        //TODO: do this NOW. Assume program is written with a main function.
        let shallowFindMainFn = (ast) => {
            let bodyStatements = ast.body;
            return bodyStatements.find((statement) => {
                return statement.type === 'FunctionDeclaration' &&
                    statement.id && statement.id.type === 'Identifier'
                    && statement.id.name === 'main';
            });
        };
        let gatherInteractiveFnNamesInMain = (mainNode) => {
            let names = [];
            LangUtil.traverse(mainNode, (node) => {
                if (node.type === 'Identifier' && node.name[0] === '$') {
                    Array.prototype.push.call(names, node.name);
                }
            });
            return names;
        };
        let mainFnNode = shallowFindMainFn(ast);
        let interactiveFnNames = gatherInteractiveFnNamesInMain(mainFnNode);
        let injectFnAsts = interactiveFnNames.map((name) => {
            let fnText = LangUtil.interactiveFunctionTexts[name];
            let ast = esprima.parse(fnText);
            let fnDeclNode = ast.body[0];
            return fnDeclNode;
        });
        mainFnNode.body.body = injectFnAsts.concat(mainFnNode.body.body);
        return ast;
    }

    static rewriteExecFn(fnString) {
        let fnAst = esprima.parse(fnString, { range : true });
        let topFnExpression = fnAst.body[0].expression;
        topFnExpression.async = true;
        let bodyStatements = fnAst.body[0].expression.body.body;
        let innerCallNodes = [];
        bodyStatements.forEach((statement) => {
            LangUtil.traverse(statement, (node) => {
                if (node.type === 'ExpressionStatement'
                        && node.expression.type === 'CallExpression') {
                    Array.prototype.push.call(innerCallNodes, node);
                }
            });
        });
        innerCallNodes.forEach((node) => {
            LangUtil.addScopeToExecCall(node);
            LangUtil.makeExecCallAwait(node);
        });
        return escodegen.generate(fnAst);
    }

    /**
     * For rebinding nodes in Tool actions.
     * Given an AST node, look up whether we can rebind expressions in the node
     * based on whether valid fields exist in rebindObj, and if so, create a new
     * node representing rebound statements.
     *
     * @param {Object} node - the AST node
     * @param {Object} rebindObj - the Object representing the keyword this that
     *                             will be rebound into the function
     * @returns {undefined}
     */
    static rebindNodeIdenForAction(node, rebindObj) {
        let idenName = node.name;
        if (rebindObj[idenName] !== undefined) {
            node.type = 'MemberExpression';
            node.object = {
                type: 'ThisExpression'
            }
            node.property = {
                type: 'Identifier',
                name: idenName
            }
            delete node[name];
        }
        else if (rebindObj.machine.getDriveWithName(idenName) !== undefined) {
            node.type = 'CallExpression',
            node.callee = {
                type: 'MemberExpression',
                object: {
                    type: 'MemberExpression',
                    object: {
                        type: 'ThisExpression'
                    },
                    property: {
                        type: 'Identifier',
                        name: 'machine'
                    }
                },
                property: {
                    type: 'Identifier',
                    name: 'getDriveWithName'
                }
            };
            node.arguments = [{
                type: 'Literal',
                value: idenName,
                raw: `"${idenName}"`
            }];
            delete node[name];
        }
    }

    static makeExecCallAwait(node) {
        let origCallExpression = node.expression;
        node.expression = {
            type: 'AwaitExpression',
            argument: origCallExpression
        }
    }

    static addScopeToExecCall(node) {
        let origFnName = node.expression.callee.name;
        let callExpr = node.expression;
        callExpr.type = 'CallExpression',
        callExpr.callee = {
            type: 'MemberExpression',
            object: {
                type: 'MemberExpression',
                object: {
                    type: 'ThisExpression'
                },
                property: {
                    type: 'Identifier',
                    name: 'tool'
                }
            },
            property: {
                type: 'Identifier',
                name: `${origFnName}`
            }
        };
    }

    static traverse(node, func) {
        // TODO: don't rebind identifiers in properties, BUT still need to rebind
        // identifiers on the RHS of :
        if (node.type == 'Property') {
            return;
        }
        if (node !== undefined) {
            func(node);
        }
        for (var key in node) {
            if (node.hasOwnProperty(key)) {
                var child = node[key];
                if (typeof child === 'object' && child !== null) {

                    if (Array.isArray(child)) {
                        child.forEach((node) => {
                            LangUtil.traverse(node, func);
                        });
                    } else {
                        LangUtil.traverse(child, func);
                    }
                }
            }
        }
    }
}

/* CONNECTION */

class Connection {
    constructor(tool, isVirtual, port) {
        this.tool = tool;
        this.isVirtual = isVirtual;
        this.port = port || -1;
    }

    connect() {
        this.tool._setConnection(this);
    }

    // TODO: execFn only nullary? the style we passed in yeah.
    // this doesn't get around the fact that execFn needs to return
    // a promise. will want to rewrite "synch" code in exec fn to do this
    execute(execFn, args) {
        // let inflatedExecFn = execFn;
        let inflatedExecFn = this.__inflateExecFn(execFn);
        return new Promise(resolve => {
            return inflatedExecFn.apply(this, args).then(() => {
                resolve()
            });
        });
    }

    __inflateExecFn(execFn) {
        let fnText = execFn.toString();
        let newFnText = LangUtil.rewriteExecFn(fnText);
        return eval(newFnText);
    }
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
    if (DEBUG_RENDER_ONCE) {
        render();
    }
    return group;
};

let addStraightTool = (scene, camera) => {
    let group = _makeTool('straight', scene);
    // _addConnectionHandlesToGroup(group);
    _addGroupToScene(group, scene, camera);
    if (DEBUG_RENDER_ONCE) {
        render();
    }
    return group;
};

let _addGroupToScene = (group, scene, camera, adjustPosition=true) => {
    scene.add(group);
    // destroyControl(scene);
    // generateControlForGroup(group, scene, camera);

    if (adjustPosition) {
        group.position.y = 50;
        group.position.x = -35;
        group.position.z = 35;
    }

    // focus(group, scene);

};

let destroyControl = (scene) => {
    let control = getControl(scene);
    if (control !== undefined) {
        control.detach();
        scene.remove(control);
    }
};

let focus = (object, scene) => {
    scene.focusedStage = object;
};

let getFocus = (scene) => {
    return scene.focusedStage;
};

let unfocus = (scene) => {
    scene.focusedStage = null;
};

let getControl = (scene) => {
    let control = scene.children.find(obj => obj instanceof THREE.TransformControls);
    return control;
};

let swapControlMode = (scene) => {
    scene.controlMode = (controlMode === "translate") ? "rotate" : "translate";
    let controls = getControl(scene);
    if (controls) {
        controls.mode = scene.controlMode;
    }
};


const geometryFactories = {
    stageCase: () => new THREE.BoxBufferGeometry(200, 1000, 100, 2, 2, 2),
    stagePlatform: () => new THREE.BoxBufferGeometry(200, 200, 150, 2, 2, 2),
    rotaryStageCase: () => new THREE.BoxBufferGeometry(150, 150, 50, 2, 2, 2),
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
    let stageCaseLines = new THREE.LineSegments(stageCaseEdges,
            new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 5 } ));
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
    let stagePlatformLines = new THREE.LineSegments(stagePlatformEdges,
            new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 5 } ));
    let stagePlatformMesh = new THREE.Mesh(stagePlatform, group.color);
    stagePlatformMesh.name = 'stagePlatform';
    stagePlatformMesh.material.transparent = true;

    group.add(stageCaseLines);
    // group.add(stageCaseMesh);
    group.add(stagePlatformLines);
    // group.add(stagePlatformMesh);
    // scene.add(group);
    stagePlatformLines.translateZ(12.5);

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

let _makeTool = (toolType, scene) => {
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
    let toolLines = new THREE.LineSegments(toolEdges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 5 }));

    group.add(toolLines);

    let toolName = 'Pen';
    group.toolName = toolName;

    group.accepts = '(?)';

    // Attempt to center on grid helper's axis
    toolLines.translateZ(40);
    group.rotateX(Math.PI / 2);

    focus(group, scene);

    scene.tool = group;
    return group;
};

let generateControlForGroup = (group, sceneNumber) => {
    let scene = scenes[sceneNumber];
    let camera = cameras[sceneNumber];
    let domElem = sceneElements[sceneNumber].elem;
    // Add controls to the new mesh group
    let control = new THREE.TransformControls(camera, domElem);
    let offset = new THREE.Vector3();
    control.mode = scene.controlMode;
    scene.add(control);
    control.attach(group);
    scene.transformControls = control;
    return control;
};

let generateTranslateControlsForSingleObjSceneNum = (sceneNumber) => {
    let scene = scenes[sceneNumber];
    let group = scene.children.find((child) => child.type === 'Group');
    return generateControlForGroup(group, sceneNumber);
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

let getTool = (scene) => {
    return scene.tool;
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

let makeScene3d = (domElement) => {
    let scene = new THREE.Scene();
    let aspect = domElement.offsetWidth / domElement.offsetHeight;
    let viewSize = 50;
    let camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect,
        viewSize, -viewSize, -1000, 10000);
    camera.up.set(0, 0, 1);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.frustumCulled = false;
    camera.position.set(500, 500, 500); // I don't know why this works
    camera.lookAt(scene.position);
    scene.add(camera);
    scene.background = new THREE.Color(0x000000);
    let gridHelper = new THREE.GridHelper(2000, 50, 0xe5e6e8, 0x444444);
    scene.add(gridHelper);
    gridHelper.rotateX(Math.PI / 2);
    scene.controlMode = 'translate';
    let controls = new THREE.OrbitControls(camera, domElement);
    scene.orbitControls = controls
    return { scene, camera, controls };
}

let makeScene2d = (domElement) => {
    let scene = new THREE.Scene();
    let aspect = domElement.offsetWidth / domElement.offsetHeight;
    let viewSize = 50;
    let camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect,
        viewSize, -viewSize, -1000, 10000);
    camera.up.set(0, 0, 1);
    camera.zoom = 0.5;
    camera.updateProjectionMatrix();
    camera.frustumCulled = false;
    camera.position.set(0, 0, -500); // I don't know why this works
    camera.lookAt(scene.position);
    scene.add(camera);
    scene.background = new THREE.Color(0x000000);
    let gridHelper = new THREE.GridHelper(2000, 50, 0xe5e6e8, 0x444444);
    scene.add(gridHelper);
    gridHelper.rotateX(Math.PI / 2);
    scene.controlMode = 'translate';
    let controls = new THREE.OrbitControls(camera, domElement);
    controls.enableRotate = false;
    scene.orbitControls = controls
    return { scene, camera, controls };
};

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
        if (DEBUG_RENDER_ONCE) {
            render();
        }
    }
    return paneContainerDom;
};

let resetPanes = () => {
    document.querySelector('.panes-container').innerHTML= "";
    cameras.length = 0;
    scenes.length = 0;
    sceneElements.length = 0;
    activePaneIndex = 0;
    pagePaneIndexCounter = 0;
};

/**
 * PANE INFLATE FUNCTIONS
 * Add implementations here about how particular panes should be
 * implemented. */
const paneInflateFunctionsByName = {
    'blank3d': (elem) => {
        const {scene, camera, controls} = makeScene3d(elem);
        scenes.push(scene);
        cameras.push(camera);

        activePaneIndex = parseInt(elem.id);

        return () => {
            renderer.render(scene, camera);
        };
    },
    'blank2d': (elem) => {
        const {scene, camera, controls} = makeScene2d(elem);
        scenes.push(scene);
        cameras.push(camera);

        activePaneIndex = parseInt(elem.id);

        // Move the camera to focus on the lower right quadrant,
        // not sure why but the position setting must be done
        // after makeScene2d is called
        camera.position.setX(145);
        camera.position.setY(95);

        return () => {
            renderer.render(scene, camera);
        };
    },
    'mesh': (elem) => {
        const {scene, camera, controls} = makeScene3d(elem);
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
        const {scene, camera, controls} = makeScene3d(elem);
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
        const {scene, camera, controls} = makeScene3d(elem);
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

//// PANE TOUCH EVENT LOGIC /////

let onDocumentMouseDown = (event) => {
//TODO: how to get scene? should be getStages(scene). Also this only works for
// machine scenes. do scene type?
    if (scenes.length !== 3) {
        return;
    }
    let scene = scenes[2];
    let camera = cameras[2];
    let candidates = getStages(scene).concat(getTool(scene));
    let isectGroups = _getIntersectsFromClickWithCandidates(event, candidates, camera);
    console.log(isectGroups);
    let isectControl;
    if (getControl(scene) === undefined) {
        isectControl = [];
    }
    else {
        isectControl = _getIntersectsFromClickWithCandidates(event, [getControl(scene)], camera);
        console.log(isectControl);
    }
    // Kludge: isectControl length >= 3 means we are clicking the controls
    if (isectControl.length < 3 && isectGroups.length > 0) {
        let stage = getObjectGroup(isectGroups[0].object);
        // If we are holding shift, make a connection
        if (event.shiftKey) {
            if (getFocus().isTool) {
                connectToolToStage(getFocus(), stage);
            }
        }

        // Otherwise, just focus the new stage
        destroyControl(scene);
        generateControlForGroup(stage, scene);
        focus(stage, scene);
    }
    else if (isectControl.length < 3) {
        unfocus(scene);
        destroyControl(scene);
    }
};

let onDocumentMouseUp = (event) => {

};

let _getIntersectsFromClickWithCandidates = (event, candidates, camera) => {
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


// TODO: doesn't work with small panes--leave for now
// document.addEventListener('mousedown', onDocumentMouseDown, false);
// document.addEventListener('mouseup', onDocumentMouseUp, false);
// document.addEventListener('keydown', onDocumentKeyDown, false);

//// ANIMATION /////

let animateObjToPosition = (obj, position) => {
    return new Promise(resolve => {
        let mixerClipPair = makeAnimateObjToPositionMixerClipPair(obj, position);
        let mixer = mixerClipPair[0];
        let clip = mixerClipPair[1];
        let action = mixer.clipAction(clip);
        mixers.push(mixer);
        mixer.addEventListener('finished', (e) => {
            console.log(`Move to ${position.x}, ${position.y} finished.`);
            resolve(mixerClipPair);
        });
        action.loop = THREE.LoopOnce;
        action.timeScale = ANIMATION_TIMESCALE;
        action.play();
    });
};

let makeAnimateObjToPositionMixerClipPair = (obj, newPos) => {
    // TODO: check if an object is already being animated, if so, take existing
    // KF into account and add it to the new mixer-action.
    // Don't have time to currently implement this, so come back to it.
    // mixers.forEach((mixer) => {
    //     let mixerObj = mixer.getRoot();
    //     if (mixerObj === obj) {
    //         // TODO
    //     }
    // });

    let mixer = new THREE.AnimationMixer(obj);
    mixer.addEventListener('finished', (event) => {
        mixer.stopAllAction();
        let idx = mixers.indexOf(mixer);
        if (idx !== -1) {
            mixers.splice(idx, 1);
        }
        obj.position.set(newPos.x, newPos.y, newPos.z);
    });
    let currPos = obj.position;
    let positionKF = new THREE.VectorKeyframeTrack('.position', [1,2],
                        [currPos.x, currPos.y, currPos.z,
                         newPos.x, newPos.y, newPos.z], THREE.InterpolateLinear);
    let clip = new THREE.AnimationClip('Action', 2, [ positionKF ]);
    return [mixer, clip];
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
    updateAnimationMixers();

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
    if (!DEBUG_RENDER_ONCE) {
        requestAnimationFrame(render);
    }
};

let updateAnimationMixers = () => {
    let deltaSeconds = clock.getDelta();
    mixers.forEach((mixer) => {
        mixer.update(deltaSeconds);
    });
};

let main = () => {
    let programTextElem = document.querySelector('.program-container');
    if (programTextElem) {
        programTextToDivs(uistProgramText);
        // programTextToDivs(pikachuProgramText);
        programTextElem.spellcheck = false;
        programTextElem.focus();
        programTextElem.blur();
    }

    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
    renderer.setScissorTest(true);
    if (DEBUG_RENDER_ONCE) {
        render();
    }
    else {
        requestAnimationFrame(render);
    }
};

main();

