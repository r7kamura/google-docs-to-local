const fsPromises = require("fs/promises");
const { google } = require("googleapis");
const core = require("@actions/core");

async function main({ googleDriveFolderId, outputDirectoryPath }) {
  const drive = google.drive({
    auth: new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    }),
    version: "v3",
  });

  const exportedFiles = exportFiles({
    drive,
    files: await listFiles({ drive, googleDriveFolderId }),
  });

  await createDirectory({ outputDirectoryPath });

  await writeExportedFiles({ exportFiles });
}

async function createDirectory({ outputDirectoryPath }) {
  await fsPromises.stat(outputDirectoryPath).catch((err) => {
    if (err.code === "ENOENT") {
      fsPromises.mkdir(outputDirectoryPath, { recursive: true });
    }
  });
}

async function exportFile({ drive, fileId }) {
  const response = await drive.files.export({
    fileId,
    mimeType: "text/html",
  });
  return response.data;
}

async function exportFiles({ drive, files }) {
  return files.map(async (file) => {
    return {
      ...file,
      html: await exportFile({
        drive,
        fileId: file.id,
      }),
    };
  });
}

async function listFiles({ drive, googleDriveFolderId }) {
  const response = await drive.files.list({
    fields: "nextPageToken, files(id, name, createdTime, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 1000,
    q: `'${googleDriveFolderId}' in parents and mimeType = 'application/vnd.google-apps.document'`,
  });
  return response.data.files;
}

async function writeExportedFiles({ exportFiles }) {
  exportedFiles.forEach(async (exportedFile) => {
    await fsPromises.writeFile(
      `${outputDirectoryPath}/${exportedFile.id}.json`,
      JSON.stringify(exportedFile)
    );
  });
}

main({
  googleDriveFolderId: core.getInput("google_drive_folder_id"),
  outputDirectoryPath: core.getInput("output_directory_path"),
}).catch(core.setFailed);
