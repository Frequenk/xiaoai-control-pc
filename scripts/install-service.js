const Service = require("node-windows").Service;
const {
  buildServiceBundle,
  getInstalledServiceScriptPath,
  publishRuntimeFiles,
  SERVICE_INSTALL_DIR,
  SERVICE_NAME,
} = require("./service-installation");

const service = new Service({
  name: SERVICE_NAME,
  description: "通过小爱同学、米家和巴法云 MQTT 控制电脑的本地服务",
  script: getInstalledServiceScriptPath(),
  workingDirectory: SERVICE_INSTALL_DIR,
  wait: 2,
  grow: 0.5,
});

service.on("install", () => {
  console.log(`[service] 安装成功: ${SERVICE_NAME}`);
  service.start();
});

service.on("alreadyinstalled", () => {
  console.log(`[service] 已安装: ${SERVICE_NAME}`);
});

service.on("invalidinstallation", () => {
  console.log("[service] 安装失败：无效安装");
});

service.on("error", (error) => {
  console.error("[service] 安装异常", error);
});

buildServiceBundle();
publishRuntimeFiles();

console.log(`[service] 运行文件已发布到: ${SERVICE_INSTALL_DIR}`);
console.log(`[service] 正在安装: ${SERVICE_NAME}`);
service.install();
