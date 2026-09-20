const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, "cube_game_logo.ico")
    });

    // ?platform=electron tells the website it's running inside this desktop
    // app (see index.html's guard script), which shows a "Connect to
    // Website" button on the login screen.
    win.loadURL("https://cubegame.club/?platform=electron");

    // Any link that tries to open a new window (target="_blank", the
    // "Connect to Website" button, etc.) should open in the user's real
    // default browser, not a second chromeless Electron window.
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});