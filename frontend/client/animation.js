/* TODO: mixer-based animation logic for moving stages. In the future,
 * we would like to have a controller determine positions and then
 * we can animate platform positions here. */

let clock;
let mixers = [];
let testExport = 42;

let animateStagePlatformToDispl = (stage, displ) => {
    let stagePlatformMeshes = getStagePlatformMeshes(stage);
    let targetPos = new THREE.Vector3(0, 0, displ);
    let mixerClipA = makeAnimateObjToPositionMixerClipPair(stagePlatformMeshes[0], targetPos);
    let mixerClipB = makeAnimateObjToPositionMixerClipPair(stagePlatformMeshes[1], targetPos);
    let mixerClipPairs = [mixerClipA, mixerClipB];

    let mixersOnly = mixerClipPairs.map((pair) => pair[0]);
    mixersOnly.forEach((mixer) => {
        mixers.push(mixer);
    });

    mixerClipPairs.forEach((pair) => {
        let mixer = pair[0];
        let clip = pair[1];
        let action = mixer.clipAction(clip);
        action.loop = THREE.LoopOnce;
        action.play();
    });

    return mixerClipPairs;
};

let animateStageToPosition = (stage, position) => {
    let mixerClipPair = makeAnimateObjToPositionMixerClipPair(stage, position);
    let mixer = mixerClipPair[0];
    let clip = mixerClipPair[1];
    let action = mixer.clipAction(clip);
    mixers.push(mixer);
    action.loop = THREE.LoopOnce;
    action.play();

    return mixerClipPair;
};

let animateTranslateStageByDisplOnAxis = (stage, displ, axis) => {
    let displOnAxis = new THREE.Vector3().copy(axis).multiplyScalar(displ);
    let translatedPos = new THREE.Vector3().addVectors(displOnAxis,
                                                       stage.position);
    return animateStageToPosition(stage, translatedPos);
};

let moveStagePlatform = (stage, displ) => {
    let siblingStages = getStageSiblings(stage);
    animateStagePlatformToDispl(stage, displ);
    siblingStages.forEach((stage) => {
        animateStagePlatformToDispl(stage, displ);
    });

    let displDelta = displ - getPlatformDisplacementForStage(stage);
    let stagePath = getPathToToolForStage(stage);
    let parentStages = stagePath.slice(1);
    let baseAxis = getStageWorldDirection(stage);
    parentStages.forEach((stage) => {
        animateTranslateStageByDisplOnAxis(stage, displDelta, baseAxis);
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

let animate = () => {
    cappedFramerateRequestAnimationFrame(30);
    render();
    // stats.update();
    // TODO: remove when animation is working, uncomment to go back to the
    // bad old days
    // incrementPlatforms();
};

let render = () => {
    let deltaSeconds = clock.getDelta();
    mixers.forEach((mixer) => {
        mixer.update(deltaSeconds);
    });
    renderer.render( scene, camera );
};

export { testExport };

