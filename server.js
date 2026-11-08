'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// ---------- HTTP (فحص الصحة + Render) ----------
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });

/** roomCode -> Set<WebSocket> */
const rooms = new Map();

function joinRoom(ws, room) {
  leaveRoom(ws);
  ws.room = room;
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  console.log(`[join] room=${room} total=${rooms.get(room).size}`);
}

function leaveRoom(ws) {
  if (!ws.room) return;
  const set = rooms.get(ws.room);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(ws.room);
  console.log(`[leave] room=${ws.room} total=${set.size}`);
}

function broadcast(ws, payload) {
  const set = rooms.get(ws.room);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const peer of set) {
    if (peer !== ws && peer.readyState === peer.OPEN) {
      try { peer.send(data); } catch (e) { /* ignore */ }
    }
  }
}

wss.on('connection', (ws) => {
  ws.room = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch (e) { return; }

    // انضمام لغرفة
    if (msg.type === 'join' && typeof msg.room === 'string') {
      joinRoom(ws, msg.room);
      // أعلم المنضم بعدد الموجودين (مفيد لمعرفة هل الطرف الآخر موجود)
      const set = rooms.get(msg.room) || new Set();
      ws.send(JSON.stringify({ type: 'room-info', peers: set.size }));
      return;
    }

    // الرسائل التي تُمرَّر للطرف الآخر: host-ready / guest-ready / offer / answer / ice
    if (['host-ready', 'guest-ready', 'offer', 'answer', 'ice'].includes(msg.type) ||
        msg.offer || msg.answer || msg.ice) {
      // تأكد أن الرسالة لها نوع واضح
      if (!msg.type) {
        if (msg.offer) msg.type = 'offer';
        else if (msg.answer) msg.type = 'answer';
        else if (msg.ice) msg.type = 'ice';
      }
      broadcast(ws, msg);
      return;
    }
  });

  ws.on('close', () => { leaveRoom(ws); });
  ws.on('error', () => { leaveRoom(ws); });
});

// تنظيف الاتصالات الميتة
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (e) {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`✅ Signaling server running on port ${PORT}`);
});
