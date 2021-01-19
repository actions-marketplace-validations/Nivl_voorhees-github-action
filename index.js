const os = require("os");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const github = require("@actions/github");
const semver = require("semver");
const { request } = require("@octokit/request");

run();

const downloadBaseURL = "https://github.com/Nivl/voorhees/releases";

async function run() {
  try {
    const goListFile = core.getInput("goListFile");
    if (!fs.existsSync(goListFile)) {
      core.setFailed(`could not find ${goListFile}`);
      return;
    }

    const versionWanted = core.getInput("version");
    const matcher = getVersionNumber(versionWanted.toLowerCase());
    if (!matcher) {
      core.setFailed(
        `${versionWanted} is not a valid semver version number. expected one of x, x.y, or x.y.z`
      );
      return;
    }

    // Find the asset we need to download
    core.info(`Checking latest versions at /repos/Nivl/voorhees/releases`);
    const resp = await request("GET /repos/{owner}/{repo}/releases", {
      owner: "Nivl",
      repo: "voorhees",
    });
    if (resp.status != 200) {
      core.setFailed(`github returned an unexpected status: ${resp.status}`);
      return;
    }
    let versionToDownload = "";
    for (let i = 0; i < resp.data.length; i++) {
      const release = resp.data[i];
      // We skip pre-releases and such
      if (release.tag_name.indexOf("-") !== -1) {
        continue;
      }
      const version = semver.coerce(release.tag_name);
      if (semver.satisfies(version, matcher)) {
        versionToDownload = version;
        break;
      }
    }
    if (!versionToDownload) {
      core.setFailed(`no version found for ${versionWanted}`);
      return;
    }
    core.info(`found ${versionToDownload}`);

    // Download asset and extract it
    const assetURL = getDownloadURL(versionToDownload);
    if (!assetURL) {
      core.setFailed(
        `system no supported ${os.platform().toString()} ${os.arch()}`
      );
      return;
    }

    core.info(`Downloading asset at ${assetURL}`);
    const archivePath = await tc.downloadTool(assetURL);
    const extractedDir = await tc.extractTar(archivePath);

    const binPath = path.join(extractedDir, `voorhees`);
    const expectedBinPath = path.join(process.cwd(), `voorhees`);
    fs.renameSync(binPath, expectedBinPath);
    core.info(`Installed voorhees at into ${expectedBinPath}`);

    // Run voorhees
    const goListStream = fs.createReadStream(goListFile);
    const proc = spawn("./voorhees", { stdio: ["pipe", 1, 2, "ipc"] });
    goListStream.pipe(proc.stdin);

    proc.on("close", (code) => {
      if (code) {
        core.setFailed("");
      }
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

// getVersionNumber takes a string such as 1, 1.2, 1.2.3
// and returns 1.x, 1.2.x, 1.2.3, or null if the string is not valid
function getVersionNumber(partialVersion) {
  if (partialVersion == "latest") {
    return "x.x.x";
  }

  // matches full version such as 1.2.3
  if (semver.valid(partialVersion)) {
    return partialVersion;
  }

  const versionParts = versionWanted.split(".");
  const major = toNumber(versionParts[0]);
  if (major === null) {
    return null;
  }
  if (versionParts.length === 1) {
    return `${major}.x.x`;
  }

  const minor = toNumber(versionParts[1]);
  if (minor === null) {
    return null;
  }
  return `${major}.${minor}.x`;
}

// isNumber returns a number or null if the number is not valid
function toNumber(number) {
  const n = parseInt(number);
  if (Number.isNaN(n)) {
    return null;
  }
  if (n < 0) {
    return null;
  }
  return n;
}

// getDownloadURL return the download URL of the version, or null if
// the system is not supported
function getDownloadURL(version) {
  let arch = os.arch();
  switch (arch) {
    case "x64":
      arch = "x86_64";
      break;
    case "x32":
    case "ia32":
      arch = "i386";
      break;
  }

  let platform = os.platform().toString();
  switch (platform) {
    case "win32":
      platform = "Windows";
      if (arch !== "x86_64" && arch !== "i386") {
        return null;
      }
      break;
    case "darwin":
      platform = "Darwin";
      arch = "x86_64";
      break;
    case "linux":
      platform = "Linux";
      if (arch !== "x86_64" && arch !== "i386") {
        return null;
      }
      break;
    default:
      return null;
  }
  return `${downloadBaseURL}/download/v${version}/voorhees_${version}_${platform}_${arch}.tar.gz`;
}
