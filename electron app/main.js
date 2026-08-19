const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, "cube_game_logo.ico")
    });

    win.loadURL("https://cubegame.club");
}

app.whenReady().then(createWindow);