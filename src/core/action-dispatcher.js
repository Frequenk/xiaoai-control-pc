const { executeAction } = require("../actions/system");

function createActionDispatcher(actionMap) {
  return async function dispatchMessage({ topic, payload }) {
    const actionConfig = actionMap[payload];

    if (!actionConfig) {
      console.log(`[dispatcher] 未匹配到动作: topic=${topic}, payload=${payload}`);
      return;
    }

    console.log(
      `[dispatcher] 命中动作: topic=${topic}, payload=${payload}, description=${actionConfig.description || "未命名动作"}`
    );
    await executeAction(actionConfig);
  };
}

module.exports = {
  createActionDispatcher,
};
