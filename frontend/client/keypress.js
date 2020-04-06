import { stageGui } from './gui.js';
import { getStages, getTool, getControl, camera } from './script.js';
import { getConnectionHandles } from './gui.js';

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
    // redetermineAllStageAxes();
    // redetermineAccepts();
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

export { onDocumentKeyDown, onDocumentMouseUp, onDocumentMouseDown };

