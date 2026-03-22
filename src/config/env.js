const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path:
    process.env.XIAOAI_CONTROL_PC_ENV_FILE ||
    path.resolve(process.cwd(), ".env"),
  quiet: true,
});

function readRequired(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`缺少必要环境变量: ${name}`);
  }

  return value.trim();
}

function readBoolean(name, defaultValue) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  return rawValue.toLowerCase() === "true";
}

function readNumber(name, defaultValue) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`环境变量 ${name} 不是有效数字`);
  }

  return parsedValue;
}

function loadEnvConfig() {
  const clientId = (
    process.env.BEMFA_MQTT_CLIENT_ID ||
    process.env.BEMFA_UID ||
    ""
  ).trim();

  if (!clientId) {
    throw new Error("缺少必要环境变量: BEMFA_UID");
  }

  return {
    mqtt: {
      host: (process.env.BEMFA_MQTT_HOST || "bemfa.com").trim(),
      port: readNumber("BEMFA_MQTT_PORT", 9503),
      protocol: (process.env.BEMFA_MQTT_PROTOCOL || "mqtts").trim(),
      clientId,
      username: (process.env.BEMFA_MQTT_USERNAME || "").trim(),
      password: (process.env.BEMFA_MQTT_PASSWORD || "").trim(),
      topic: readRequired("BEMFA_TOPIC"),
      connectTimeout: readNumber("BEMFA_MQTT_CONNECT_TIMEOUT", 4000),
      rejectUnauthorized: readBoolean(
        "BEMFA_MQTT_REJECT_UNAUTHORIZED",
        false
      ),
    },
  };
}

module.exports = {
  loadEnvConfig,
};
