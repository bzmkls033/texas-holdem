# 🃏 德州扑克 Texas Hold'em

一个完整的在线德州扑克游戏，支持多人实时对战。

## 功能特点

- ✅ 完整的德州扑克规则
- ✅ 2-8人游戏
- ✅ 实时多人对战
- ✅ 无需登录，输入房间号即可加入
- ✅ 响应式设计，支持移动端
- ✅ 牌型自动计算和比较

## 快速开始

### 安装依赖

```bash
cd texas-holdem
npm install
```

### 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

### 游戏流程

1. 打开浏览器访问 `http://localhost:3000`
2. 输入昵称
3. 输入房间号加入现有房间，或点击"创建新房间"
4. 等待其他玩家加入（至少2人）
5. 点击"准备游戏"
6. 所有玩家准备好后，点击"开始游戏"

## 游戏规则

### 基本规则

- 每位玩家发2张底牌
- 5张公共牌（翻牌3张、转牌1张、河牌1张）
- 用最佳5张牌组成牌型
- 可以选择：弃牌、过牌、跟注、加注、全押

### 盲注

- 小盲：10筹码
- 大盲：20筹码
- 庄家位置按顺时针轮换

### 牌型大小（从大到小）

1. 皇家同花顺 - 同花色的A-K-Q-J-10
2. 同花顺 - 同花色的连续五张牌
3. 四条 - 四张相同点数的牌
4. 葫芦 - 三张相同加一对
5. 同花 - 五张同花色的牌
6. 顺子 - 五张连续的牌
7. 三条 - 三张相同点数的牌
8. 两对 - 两组对子
9. 一对 - 一组对子
10. 高牌 - 以最大的单牌比较

## 技术栈

- **后端**: Node.js + Express + Socket.IO
- **前端**: 原生HTML/CSS/JavaScript
- **实时通信**: WebSocket (Socket.IO)

## 项目结构

```
texas-holdem/
├── server.js          # 服务器入口
├── package.json       # 项目配置
├── game/
│   ├── Deck.js        # 扑克牌组
│   ├── Player.js      # 玩家类
│   ├── Game.js        # 游戏主逻辑
│   └── HandEvaluator.js # 牌型评估
├── public/
│   ├── index.html     # 主页面
│   ├── style.css      # 样式文件
│   └── app.js         # 前端逻辑
└── README.md          # 说明文档
```

## 局域网访问

如果想在同一网络下让其他设备访问，需要修改服务器监听地址：

```javascript
// server.js
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
```

然后其他设备可以通过 `http://你的IP:3000` 访问。

## 自定义配置

可以在 `game/Game.js` 中修改：

- `smallBlind` - 小盲金额
- `bigBlind` - 大盲金额  
- `maxPlayers` - 最大玩家数
- 初始筹码数量 (在 `Player.js` 的 `constructor` 中)

## License

MIT
