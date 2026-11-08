const http = require('http');
const { WebSocketServer } = require('ws');

// Render يفرض بورت معين عبر process.env.PORT ويجب الاستماع عليه
const port = process.env.PORT || 10000;

// إنشاء سيرفر HTTP أساسي لتبسيط الفحص وإبقاء العملية حية
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TurboWarp P2P Signaling Server is Running!\n');
});

// ربط سيرفر الـ WebSocket بسيرفر الـ HTTP
const wss = new WebSocketServer({ server });
const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // انضمام أو إنشاء غرف الربط
      if (data.type === 'join' && data.room) {
        currentRoom = data.room;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(ws);
        return;
      }

      // تمرير حزم إشارات WebRTC لباقي أطراف الغرفة
      if (currentRoom && rooms.has(currentRoom)) {
        for (const client of rooms.get(currentRoom)) {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify(data));
          }
        }
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});

// بدء الإنصات على المنفذ المطلوب لإعلام Render بأن التطبيق مستقر
server.listen(port, '0.0.0.0', () => {
  console.log(`Signaling server listening on port ${port}`);
});
