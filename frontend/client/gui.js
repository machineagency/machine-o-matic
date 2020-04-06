import { addLinearStage, addRotaryStage, getStages,
         getTool } from './script.js';

let stageGui, connectionGui;
let connectionHandlesVisible = false;

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

let toggleConnectionHandles = () => {
    let handles = getConnectionHandles();
    let meshes = getMeshes();
    connectionHandlesVisible = !connectionHandlesVisible;
    handles.forEach((handle) => { handle.visible = connectionHandlesVisible; });
    meshes.forEach((mesh) => {
        mesh.material.opacity = connectionHandlesVisible ? 0.5 : 1.0;
    });
};

let getConnectionHandles = () => {
    let groups = getStages();
    let tool = getTool();
    let groupsAndTool = groups.concat(tool);
    return groupsAndTool.map((group) => group.children)
               .flat()
               .filter((obj) => obj.name === 'connectionHandle');
};

export { stageGui, initGui, toggleConnectionHandles, connectionHandlesVisible,
         getConnectionHandles };

