/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hook loaded by electron-builder */
// Without a Developer ID certificate the app is signed ad hoc: unsigned arm64 code
// doesn't run at all, and macOS would call a downloaded unsigned app "damaged" instead
// of offering "Open Anyway" in System Settings → Privacy & Security.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function adHocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  // A universal build packs each architecture into a *-temp dir first; signing those
  // would make the two halves differ, so only the merged app is signed
  if (context.appOutDir.endsWith("-temp")) return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
};
