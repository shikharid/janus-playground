const { app, BrowserWindow } = require("electron");

const urls = [
  "https://ec2-3-7-218-198.ap-south-1.compute.amazonaws.com:1443/vc101/index.html"
]

const createWindow = () =>{
  win = new BrowserWindow({
    center: true,
    resizable: true,
    webPreferences:{
      nodeIntegration: false,
      show: false
    }
  });
  win.maximize();
  //win.webContents.
  console.log(urls[0]);

  win.loadURL(urls[0]);
  // win.loadURL(url.format({
  //     pathname: path.join(__dirname,"index.html"),
  //     protocol: 'file',
  //     slashes: true
  // }));
  win.once('ready-to-show',()=>{
    win.show()
  });

  win.on('closed',()=>{
    win = null;
  });
}

app.on('ready', createWindow);

// https://stackoverflow.com/questions/38986692/how-do-i-trust-a-self-signed-certificate-from-an-electron-app
// SSL/TSL: this is the self signed certificate support
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // On certificate error we disable default behaviour (stop loading the page)
  // and we then say "it is all fine - true" to the callback
  event.preventDefault();
  callback(true);
});