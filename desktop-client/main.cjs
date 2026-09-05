const { app, BrowserWindow, ipcMain, shell, clipboard, desktopCapturer } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    const hasDist = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev || (!hasDist && !app.isPackaged)) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handler Registrations
ipcMain.handle('get-platform', () => 'DESKTOP');
ipcMain.handle('get-local-ip', () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    return addresses.length > 0 ? addresses.join(', ') : '127.0.0.1';
});

ipcMain.handle('open-app', async (event, name) => {
    console.log('Request to open app:', name);
    if (name.toLowerCase().includes('chrome')) {
        exec('start chrome');
        return 'Opened Chrome browser';
    } else if (name.toLowerCase().includes('youtube')) {
        shell.openExternal('https://youtube.com');
        return 'Opened YouTube';
    }
    return `Application '${name}' is not in the whitelist. Request denied.`;
});

ipcMain.handle('open-file', async (event, filePath) => {
    console.log('Request to open path:', filePath);
    if (fs.existsSync(filePath)) {
        const err = await shell.openPath(filePath);
        if (err) {
            return 'Failed to open file: ' + err;
        }
        return 'Opened file: ' + path.basename(filePath);
    }
    return 'File does not exist: ' + filePath;
});

ipcMain.handle('search-file', async (event, query) => {
    console.log('Searching for files matching:', query);
    const searchRoot = 'C:\\Users\\Abhishek Singh\\.gemini\\antigravity\\scratch';
    const results = [];
    
    function scanDir(dir) {
        if (results.length >= 10) return;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    if (!file.startsWith('.') && file !== 'node_modules' && file !== 'tools') {
                        scanDir(fullPath);
                    }
                } else if (file.toLowerCase().includes(query.toLowerCase())) {
                    results.push({ name: file, path: fullPath.replace(/\\/g, '/'), size: stat.size });
                }
            }
        } catch (e) {}
    }

    scanDir(searchRoot);
    return results;
});

ipcMain.handle('take-screenshot', async () => {
    console.log('Taking screenshot...');
    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
        if (sources.length > 0) {
            return sources[0].thumbnail.toDataURL();
        }
        throw new Error('No screens detected');
    } catch (e) {
        return 'Error capturing screen: ' + e.message;
    }
});

ipcMain.handle('read-clipboard', () => clipboard.readText());

ipcMain.handle('write-clipboard', (event, text) => {
    clipboard.writeText(text);
    return 'Copied text to clipboard';
});
