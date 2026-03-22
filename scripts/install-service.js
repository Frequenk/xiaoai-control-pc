const path = require("path");
const dotenv = require("dotenv");
const Service = require("node-windows").Service;
const { resolveServiceName } = require("../src/config/service-name");

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
  quiet: true,
});

const serviceName = resolveServiceName(process.env.SERVICE_NAME);

const service = new Service({
  name: serviceName,
  description: "通过小爱同学、米家和巴法云 MQTT 控制电脑的本地服务",
  script: path.resolve(__dirname, "..", "src", "service.js"),
  workingDirectory: path.resolve(__dirname, ".."),
  wait: 2,
  grow: 0.5,
});

service.on("install", () => {
  console.log(`[service] 安装成功: ${serviceName}`);
  service.start();
});

service.on("alreadyinstalled", () => {
  console.log(`[service] 已安装: ${serviceName}`);
});

service.on("invalidinstallation", () => {
  console.log("[service] 安装失败：无效安装");
});

service.on("error", (error) => {
  console.error("[service] 安装异常", error);
});

console.log(`[service] 正在安装: ${serviceName}`);
service.install();
