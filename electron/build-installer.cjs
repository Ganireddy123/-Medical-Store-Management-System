const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Arch, Platform, build } = require("electron-builder");
const { version } = require("../package.json");

async function main() {
  if (process.platform !== "win32") {
    throw new Error("The Windows installer can only be built on Windows.");
  }

  const stagingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "medistore-installer-"));
  const installerName = `MediStore-Setup-${version}-win-x64.exe`;
  const stagedInstaller = path.join(stagingDirectory, installerName);
  const releaseDirectory = path.resolve(__dirname, "..", "release");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const candidateName = installerName.replace(/\.exe$/i, `-candidate-${timestamp}.exe`);
  const candidateInstaller = path.join(releaseDirectory, candidateName);
  const retainStaging = process.env.MEDISTORE_KEEP_STAGING === "1";

  try {
    await build({
      targets: Platform.WINDOWS.createTarget("nsis", Arch.x64),
      config: { directories: { output: stagingDirectory } },
    });
    await fs.access(stagedInstaller);
    await fs.mkdir(releaseDirectory, { recursive: true });
    await fs.copyFile(stagedInstaller, candidateInstaller, constants.COPYFILE_EXCL);
    console.log(`Windows installer candidate created: ${candidateInstaller}`);
    if (retainStaging) console.log(`Packaged application staging directory: ${stagingDirectory}`);
  } finally {
    if (!retainStaging) await fs.rm(stagingDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("Windows installer build failed:", error);
  process.exitCode = 1;
});
