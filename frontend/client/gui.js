let stageGui, connectionGui;

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

export { stageGui, initGui };

