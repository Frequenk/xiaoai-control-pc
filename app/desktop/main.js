const { invoke } = window.__TAURI__.core;

const elements = {
  appVersion: document.querySelector("#app-version"),
  updateStatus: document.querySelector("#update-status"),
  bemfaUid: document.querySelector("#bemfa-uid"),
  bemfaTopic: document.querySelector("#bemfa-topic"),
  configBadge: document.querySelector("#config-badge"),
  serviceStatus: document.querySelector("#service-status"),
  serviceName: document.querySelector("#service-name"),
  installDir: document.querySelector("#install-dir"),
  inlineStatus: document.querySelector("#inline-status"),
  serviceProgressWrap: document.querySelector("#service-progress-wrap"),
  serviceProgress: document.querySelector("#service-progress"),
  serviceProgressBar: document.querySelector("#service-progress-bar"),
  serviceProgressValue: document.querySelector("#service-progress-value"),
  installService: document.querySelector("#install-service"),
  uninstallService: document.querySelector("#uninstall-service"),
  refreshStatus: document.querySelector("#refresh-status"),
  openHelp: document.querySelector("#open-help"),
  openRepo: document.querySelector("#open-repo"),
  openReleases: document.querySelector("#open-releases"),
  helpModal: document.querySelector("#help-modal"),
  closeHelp: document.querySelector("#close-help"),
  openHelpRepo: document.querySelector("#open-help-repo"),
  openHelpReleases: document.querySelector("#open-help-releases"),
};

const state = {
  busy: false,
  configComplete: false,
  serviceInstalled: false,
  serviceStatusLabel: "检查中",
  appVersion: "",
  repoUrl: "",
  releasesUrl: "",
  latestVersion: "",
  hasUpdate: false,
};

let progressTimer = null;

function setOutput(message) {
  elements.inlineStatus.textContent = message;
}

function setProgress(percent, label) {
  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
  elements.serviceProgressWrap.hidden = false;
  elements.serviceProgressWrap.setAttribute("aria-hidden", "false");
  elements.serviceProgressBar.style.width = `${clampedPercent}%`;
  elements.serviceProgressValue.textContent = `${clampedPercent}%`;
  setOutput(label);
}

function hideProgress() {
  clearInterval(progressTimer);
  progressTimer = null;
  elements.serviceProgressWrap.hidden = true;
  elements.serviceProgressWrap.setAttribute("aria-hidden", "true");
  elements.serviceProgressBar.style.width = "0%";
  elements.serviceProgressValue.textContent = "0%";
}

function startProgress(actionType) {
  clearInterval(progressTimer);

  const plans = {
    install: {
      start: 8,
      firstLabel: "正在准备安装操作",
      nextLabel: "正在安装或更新 Windows 服务",
      max: 86,
      step: 3,
      interval: 380,
    },
    uninstall: {
      start: 10,
      firstLabel: "正在准备卸载操作",
      nextLabel: "正在卸载 Windows 服务",
      max: 88,
      step: 4,
      interval: 360,
    },
    refresh: {
      start: 20,
      firstLabel: "正在刷新服务状态",
      nextLabel: "正在读取服务状态",
      max: 78,
      step: 12,
      interval: 240,
    },
  };

  const plan = plans[actionType];
  if (!plan) {
    hideProgress();
    return;
  }

  let current = plan.start;
  setProgress(current, plan.firstLabel);

  progressTimer = setInterval(() => {
    current = Math.min(current + plan.step, plan.max);
    setProgress(current, current < 30 ? plan.firstLabel : plan.nextLabel);

    if (current >= plan.max) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }, plan.interval);
}

function finishProgress(successLabel) {
  clearInterval(progressTimer);
  progressTimer = null;
  setProgress(100, successLabel);
  setTimeout(() => {
    if (!state.busy) {
      hideProgress();
    }
  }, 700);
}

function failProgress(errorLabel) {
  clearInterval(progressTimer);
  progressTimer = null;
  setProgress(100, errorLabel);
  setTimeout(() => {
    if (!state.busy) {
      hideProgress();
    }
  }, 1100);
}

function setBadgeState(element, type) {
  element.dataset.state = type;
}

function normalizeVersion(version) {
  return String(version || "")
    .trim()
    .replace(/^app-v/i, "")
    .replace(/^v/i, "");
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left).split(".").map((value) => Number(value) || 0);
  const rightParts = normalizeVersion(right).split(".").map((value) => Number(value) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function computeConfigComplete() {
  return Boolean(
    elements.bemfaUid.value.trim() && elements.bemfaTopic.value.trim()
  );
}

function syncConfigState() {
  state.configComplete = computeConfigComplete();
  elements.configBadge.textContent = state.configComplete ? "已填写" : "待填写";
  setBadgeState(
    elements.configBadge,
    state.configComplete ? "ready" : "pending"
  );
}

function syncServiceState(label) {
  state.serviceStatusLabel = label;
  state.serviceInstalled = label !== "未安装";
  elements.serviceStatus.textContent = label;

  const badgeStateMap = {
    运行中: "ready",
    已停止: "warn",
    未安装: "pending",
    查询失败: "danger",
    状态未知: "warn",
  };

  setBadgeState(
    elements.serviceStatus,
    badgeStateMap[label] || "neutral"
  );
}

function updateActionState() {
  elements.installService.disabled = state.busy || !state.configComplete;
  elements.uninstallService.disabled = state.busy || !state.serviceInstalled;
  elements.refreshStatus.disabled = state.busy;
  elements.openReleases.hidden = !state.hasUpdate;

  for (const button of [
    elements.installService,
    elements.uninstallService,
    elements.refreshStatus,
    elements.openRepo,
    elements.openHelp,
    elements.openReleases,
    elements.openHelpRepo,
    elements.openHelpReleases,
    elements.closeHelp,
  ]) {
    if (!button) {
      continue;
    }

    button.dataset.busy = state.busy ? "true" : "false";
    button.title = "";
  }

  if (!state.busy && !state.configComplete) {
    elements.installService.title = "请先填写 Private Key 和 Topic";
  }

  if (!state.busy && !state.serviceInstalled) {
    elements.uninstallService.title = "当前未安装服务";
  }
}

function setBusy(isBusy) {
  state.busy = isBusy;
  updateActionState();
}

async function refreshConfig() {
  const config = await invoke("load_config");

  elements.bemfaUid.value = config.bemfaUid;
  elements.bemfaTopic.value = config.bemfaTopic;
  syncConfigState();
}

async function refreshStatus() {
  const status = await invoke("get_service_status");
  syncServiceState(status.label);
  elements.serviceName.textContent = status.serviceName;
  elements.installDir.textContent = status.installDir;
  setOutput(`${status.serviceName}: ${status.label}`);
}

async function withAction(action, progressType, successLabel) {
  try {
    setBusy(true);
    if (progressType) {
      startProgress(progressType);
    }
    await action();
    if (progressType) {
      finishProgress(successLabel || "处理完成");
    }
  } catch (error) {
    if (progressType) {
      failProgress("处理失败");
    }
    setOutput(error);
  } finally {
    setBusy(false);
  }
}

async function loadAppMeta() {
  const meta = await invoke("get_app_meta");
  state.appVersion = normalizeVersion(meta.version);
  state.repoUrl = meta.repoUrl;
  state.releasesUrl = meta.releasesUrl;
  elements.appVersion.textContent = `当前版本 ${state.appVersion}`;
  setBadgeState(elements.appVersion, "neutral");
}

async function refreshUpdateStatus() {
  if (!state.appVersion) {
    elements.updateStatus.textContent = "版本未读取";
    setBadgeState(elements.updateStatus, "pending");
    state.hasUpdate = false;
    updateActionState();
    return;
  }

  const latestReleaseApi = state.repoUrl.replace(
    "https://github.com/",
    "https://api.github.com/repos/"
  ) + "/releases/latest";

  elements.updateStatus.textContent = "检查更新中";
  setBadgeState(elements.updateStatus, "pending");

  try {
    const response = await fetch(latestReleaseApi, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}`);
    }

    const latestRelease = await response.json();
    const latestVersion = normalizeVersion(latestRelease.tag_name);
    const hasUpdate = compareVersions(latestVersion, state.appVersion) > 0;
    state.latestVersion = latestVersion;
    state.hasUpdate = hasUpdate;

    if (hasUpdate) {
      elements.updateStatus.textContent = `发现新版本 ${latestVersion}`;
      setBadgeState(elements.updateStatus, "warn");
    } else {
      elements.updateStatus.textContent = "已是最新版本";
      setBadgeState(elements.updateStatus, "ready");
    }
  } catch (error) {
    state.hasUpdate = false;
    elements.updateStatus.textContent = "更新检查失败";
    setBadgeState(elements.updateStatus, "danger");
  }

  updateActionState();
}

function showHelp() {
  elements.helpModal.hidden = false;
}

function hideHelp() {
  elements.helpModal.hidden = true;
}

window.addEventListener("DOMContentLoaded", async () => {
  for (const input of [elements.bemfaUid, elements.bemfaTopic]) {
    input.addEventListener("input", () => {
      syncConfigState();
      updateActionState();
    });
  }

  elements.installService.addEventListener("click", () =>
    withAction(async () => {
      const result = await invoke("install_or_update_service", {
        config: {
          bemfaUid: elements.bemfaUid.value.trim(),
          bemfaTopic: elements.bemfaTopic.value.trim(),
        },
      });
      setOutput(result);
      await refreshConfig();
      await refreshStatus();
    }, "install", "安装或更新完成")
  );

  elements.uninstallService.addEventListener("click", () =>
    withAction(async () => {
      const result = await invoke("uninstall_service");
      setOutput(result);
      await refreshStatus();
    }, "uninstall", "卸载完成")
  );

  elements.refreshStatus.addEventListener("click", () =>
    withAction(async () => {
      await refreshStatus();
    }, "refresh", "状态已更新")
  );

  elements.openHelp.addEventListener("click", showHelp);
  elements.closeHelp.addEventListener("click", hideHelp);
  elements.helpModal.addEventListener("click", (event) => {
    if (event.target === elements.helpModal) {
      hideHelp();
    }
  });

  elements.openRepo.addEventListener("click", () =>
    withAction(async () => {
      await invoke("open_external", { url: state.repoUrl });
    })
  );

  elements.openReleases.addEventListener("click", () =>
    withAction(async () => {
      await invoke("open_external", { url: state.releasesUrl });
    })
  );

  elements.openHelpRepo.addEventListener("click", () =>
    withAction(async () => {
      await invoke("open_external", { url: state.repoUrl });
    })
  );

  elements.openHelpReleases.addEventListener("click", () =>
    withAction(async () => {
      await invoke("open_external", { url: state.releasesUrl });
    })
  );

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.helpModal.hidden) {
      hideHelp();
    }
  });

  syncConfigState();
  syncServiceState("检查中");
  elements.appVersion.textContent = "版本读取中";
  setBadgeState(elements.appVersion, "pending");
  elements.updateStatus.textContent = "检查更新中";
  setBadgeState(elements.updateStatus, "pending");
  hideProgress();
  updateActionState();

  await withAction(async () => {
    await loadAppMeta();
    await refreshConfig();
    await refreshUpdateStatus();
    await refreshStatus();
  });
});
