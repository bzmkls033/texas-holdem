// server.js - 德州扑克服务器
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Game = require('./game/Game');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 存储所有游戏房间
const rooms = new Map();

// 生成房间号
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 静态文件服务
app.use(express.static('public'));

// 主页
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 获取房间信息
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const game = rooms.get(roomId);
  
  if (!game) {
    return res.status(404).json({ error: '房间不存在' });
  }
  
  res.json({
    roomId,
    playerCount: game.playerCount,
    maxPlayers: game.maxPlayers,
    isRunning: game.isRunning
  });
});

// 创建房间
app.post('/api/room', (req, res) => {
  let roomId;
  do {
    roomId = generateRoomId();
  } while (rooms.has(roomId));
  
  const game = new Game(roomId, io);
  rooms.set(roomId, game);
  
  res.json({ roomId });
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 创建房间
  socket.on('createRoom', (callback) => {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (rooms.has(roomId));
    
    const game = new Game(roomId, io);
    rooms.set(roomId, game);
    
    callback({ success: true, roomId });
  });

  // 加入房间
  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    const game = rooms.get(roomId);
    
    if (!game) {
      callback({ success: false, message: '房间不存在' });
      return;
    }

    const result = game.addPlayer(socket.id, playerName);
    
    if (result.success) {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerName = playerName;
      
      // 通知所有人有新玩家加入
      io.to(roomId).emit('playerJoined', {
        player: result.player.toJSON(),
        playerCount: game.playerCount
      });
      
      callback({ success: true, seatIndex: result.seatIndex });
    } else {
      callback(result);
    }
  });

  // 离开房间
  socket.on('leaveRoom', () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    
    const game = rooms.get(roomId);
    if (game) {
      game.removePlayer(socket.id);
      socket.leave(roomId);
      
      // 通知所有人有玩家离开
      io.to(roomId).emit('playerLeft', { playerId: socket.id });
      
      // 如果房间为空，删除房间
      if (game.playerCount === 0) {
        rooms.delete(roomId);
      }
    }
    
    socket.roomId = null;
  });

  // 准备/取消准备
  socket.on('setReady', (ready) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    
    const game = rooms.get(roomId);
    if (game) {
      game.setPlayerReady(socket.id, ready);
      io.to(roomId).emit('playerReady', { 
        playerId: socket.id, 
        ready 
      });
    }
  });

  // 开始游戏
  socket.on('startGame', (callback) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    
    const game = rooms.get(roomId);
    if (game) {
      const result = game.startGame();
      callback(result);
    }
  });

  // 玩家操作
  socket.on('playerAction', ({ action, amount }, callback) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    
    const game = rooms.get(roomId);
    if (game) {
      const result = game.playerAction(socket.id, action, amount);
      callback(result);
    }
  });

  // 获取游戏状态
  socket.on('getGameState', (callback) => {
    const roomId = socket.roomId;
    if (!roomId) {
      callback(null);
      return;
    }
    
    const game = rooms.get(roomId);
    if (game) {
      callback(game.getPlayerState(socket.id));
    } else {
      callback(null);
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    
    const roomId = socket.roomId;
    if (roomId) {
      const game = rooms.get(roomId);
      if (game) {
        game.removePlayer(socket.id);
        io.to(roomId).emit('playerLeft', { playerId: socket.id });
        
        if (game.playerCount === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

// 清理空闲房间（每5分钟检查一次）
setInterval(() => {
  const now = Date.now();
  for (const [roomId, game] of rooms) {
    if (now - game.lastActivity > 30 * 60 * 1000) { // 30分钟无活动
      rooms.delete(roomId);
      console.log('清理空闲房间:', roomId);
    }
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`德州扑克服务器已启动！`);
  console.log(`端口: ${PORT}`);
});
