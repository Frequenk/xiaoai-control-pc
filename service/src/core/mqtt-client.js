const mqtt = require("mqtt");

function createMqttClient(mqttConfig, onMessage) {
  const client = mqtt.connect({
    clean: true,
    connectTimeout: mqttConfig.connectTimeout,
    clientId: mqttConfig.clientId,
    username: mqttConfig.username,
    password: mqttConfig.password,
    protocolVersion: 4,
    protocol: mqttConfig.protocol,
    rejectUnauthorized: mqttConfig.rejectUnauthorized,
    host: mqttConfig.host,
    port: mqttConfig.port,
  });

  client.on("connect", () => {
    console.log("[mqtt] 已连接到巴法云");
    client.subscribe(mqttConfig.topic, (error) => {
      if (error) {
        console.error("[mqtt] 订阅失败", error);
        return;
      }

      console.log(`[mqtt] 已订阅主题: ${mqttConfig.topic}`);
    });
  });

  client.on("reconnect", () => {
    console.log("[mqtt] 正在重连");
  });

  client.on("error", (error) => {
    console.error("[mqtt] 连接错误", error);
  });

  client.on("message", async (topic, message) => {
    const payload = message.toString().trim();
    console.log(`[mqtt] 收到消息: topic=${topic}, payload=${payload}`);

    try {
      await onMessage({ topic, payload, rawMessage: message });
    } catch (error) {
      console.error("[mqtt] 消息处理失败", error);
    }
  });

  return client;
}

module.exports = {
  createMqttClient,
};
