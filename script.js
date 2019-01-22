'use strict'

let container, stats, gui;
let camera, scene, renderer;
let topDirectionalLight, leftDirectionalLight, rightDirectionalLight;
let mesh, lines, geometry;

let geometries = [
    new THREE.BoxBufferGeometry( 1000, 100, 200, 2, 2, 2 ),
];

let options = {
    Geometry: 0
};

let material = new THREE.MeshLambertMaterial({ color: 0xbed346 });

let addMesh = () => {
    // if ( mesh !== undefined ) {
    //     scene.remove( mesh );
    //     geometry.dispose();
    // }
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

    // Add controls to the new mesh group
    let control = new THREE.TransformControls( camera, renderer.domElement );
    control.addEventListener('change', (event) => {
        render();
    });
    control.addEventListener('dragging-changed', (event) => {
        // console.log(event)
    });
    // control.setMode('rotate');
    control.attach(group);
    scene.add(control);

    // Update gui
    gui.add({ stageId: stageId }, 'StageId');

    return group;

};

let findGroups = () => {
    return scene.children.filter((child) => {
        return child.type === 'Group';
    });
};

let initGui = () => {
    gui = new dat.GUI( { width: 350 } );
    // gui.add( options, 'Geometry', geometries ).onChange( function () {
    //     addMesh();
    // } );
    gui.add({ AddStage: () => {
        addMesh();
    } }, 'AddStage');
};

let init = () => {
    container = document.getElementById( 'container' );

    let aspect = window.innerWidth / window.innerHeight;
    let viewSize = 150;
    camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect, viewSize, -viewSize, -1000, 10000);
    camera.zoom = 0.35;
    camera.updateProjectionMatrix();
    camera.position.set(-500, 500, 500); // I don't know why this works
    camera.frustumCulled = false;

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

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );
    stats = new Stats();
    container.appendChild( stats.dom );
    let geometries = {
        BoxBufferGeometry: 0,
    };

    let group = addMesh();

    camera.lookAt(scene.position);
    window.addEventListener( 'resize', onWindowResize, false );
    initGui();
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
