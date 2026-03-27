const os = require('os');
const QRCode = require('qrcode');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function generateQRData(roomId, port) {
  let url;
  if (process.env.RENDER_EXTERNAL_URL) {
    url = `${process.env.RENDER_EXTERNAL_URL}/room/${roomId}`;
  } else {
    const ip = getLocalIP();
    url = `http://${ip}:${port}/room/${roomId}`;
  }
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#F5F5F5', light: '#00000000' },
  });
  return { url, qrDataUrl };
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = { getLocalIP, generateQRData, generateRoomId };
