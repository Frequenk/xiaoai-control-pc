const actionMap = require("./config/action-map");
const { SERVICE_NAME } = require("./config/app-constants");
const { loadEnvConfig } = require("./config/env");
const { createActionDispatcher } = require("./core/action-dispatcher");
const { createMqttClient } = require("./core/mqtt-client");

function startService() {
  const config = loadEnvConfig();
  const dispatchMessage = createActionDispatcher(actionMap);
  const client = createMqttClient(config.mqtt, dispatchMessage);

  console.log(`[service] ${SERVICE_NAME} 已启动`);

  const shutdown = () => {
    console.log("[service] 正在关闭 MQTT 连接");
    client.end(true, () => {
      console.log("[service] 已退出");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return client;
}

module.exports = {
  startService,
};

if (require.main === module) {
  startService();
}
