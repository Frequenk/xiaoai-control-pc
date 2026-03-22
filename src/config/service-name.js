const DEFAULT_SERVICE_NAME = "XiaoAi Control PC";
const SERVICE_NAME_PATTERN = /^[A-Za-z0-9 ]+$/;

function resolveServiceName(rawValue) {
  const serviceName = (rawValue || DEFAULT_SERVICE_NAME).trim();

  if (!serviceName) {
    throw new Error("SERVICE_NAME 不能为空");
  }

  if (!SERVICE_NAME_PATTERN.test(serviceName)) {
    throw new Error(
      "SERVICE_NAME 只能使用英文、数字、空格"
    );
  }

  return serviceName;
}

module.exports = {
  DEFAULT_SERVICE_NAME,
  resolveServiceName,
};
