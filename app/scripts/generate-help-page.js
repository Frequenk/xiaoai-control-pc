const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const rootDir = path.resolve(__dirname, "..", "..");
const readmePath = path.join(rootDir, "README.md");
const sourceImagesDir = path.join(rootDir, "docs", "images");
const helpDir = path.join(rootDir, "app", "desktop", "help");
const helpImagesDir = path.join(helpDir, "images");
const helpIndexPath = path.join(helpDir, "index.html");
const sourceGuideMarker = "\n## 源码使用教程";

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function buildHelpHtml(markdown) {
  const renderedHtml = marked
    .parse(markdown)
    .replace(/src="\.\/images\/([^"]+)"/g, (_, fileName) => {
      return `src="./images/${encodeURIComponent(fileName)}"`;
    });

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>XiaoAi Control PC README</title>
    <style>
      :root {
        --bg: #f6f3ed;
        --surface: #ffffff;
        --ink: #1f2623;
        --muted: #64706a;
        --line: rgba(31, 38, 35, 0.12);
        --accent: #0d6a53;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--ink);
      }
      .page {
        max-width: 980px;
        margin: 0 auto;
        padding: 28px 24px 48px;
      }
      .markdown-body {
        padding: 28px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 16px 40px rgba(24, 31, 28, 0.08);
        line-height: 1.75;
      }
      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3 {
        line-height: 1.25;
      }
      .markdown-body a {
        color: var(--accent);
        text-decoration: none;
      }
      .markdown-body a:hover {
        text-decoration: underline;
      }
      .markdown-body code {
        padding: 2px 6px;
        border-radius: 6px;
        background: rgba(13, 106, 83, 0.08);
      }
      .markdown-body pre {
        overflow: auto;
        padding: 16px;
        border-radius: 16px;
        background: #14201c;
        color: #d4f3ea;
      }
      .markdown-body pre code {
        padding: 0;
        background: transparent;
        color: inherit;
      }
      .markdown-body table {
        width: 100%;
        border-collapse: collapse;
      }
      .markdown-body th,
      .markdown-body td {
        padding: 12px;
        border: 1px solid var(--line);
        vertical-align: top;
      }
      .markdown-body img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <article class="markdown-body">${renderedHtml}</article>
    </main>
  </body>
</html>`;
}

function generateHelpPage() {
  const fullMarkdown = fs
    .readFileSync(readmePath, "utf8");
  const helpMarkdown = fullMarkdown.includes(sourceGuideMarker)
    ? fullMarkdown.split(sourceGuideMarker)[0].trimEnd()
    : fullMarkdown;
  const markdown = helpMarkdown
    .replaceAll("./docs/images/", "./images/");

  fs.rmSync(helpDir, { recursive: true, force: true });
  fs.mkdirSync(helpDir, { recursive: true });
  copyDir(sourceImagesDir, helpImagesDir);
  fs.writeFileSync(helpIndexPath, buildHelpHtml(markdown));

  console.log(`[help] README 页面已生成: ${helpIndexPath}`);
}

generateHelpPage();
