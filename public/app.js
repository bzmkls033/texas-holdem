// app.js - 德州扑克前端逻辑

// 连接Socket.IO服务器
const socket = io();

// 游戏状态
let gameState = null;
let mySeatIndex = -1;
let isMyTurn = false;
let myPlayerId = null;

// DOM元素
const screens = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game')
};

const elements = {
  // 大厅
  playerName: document.getElementById('playerName'),
  roomId: document.getElementById('roomId'),
  joinBtn: document.getElementById('joinBtn'),
  createBtn: document.getElementById('createBtn'),
  
  // 游戏
  currentRoomId: document.getElementById('currentRoomId'),
  playerCount: document.getElementById('playerCount'),
  currentPhase: document.getElementById('currentPhase'),
  potAmount: document.getElementById('potAmount'),
  leaveBtn: document.getElementById('leaveBtn'),
  
  // 操作面板
  readyPanel: document.getElementById('readyPanel'),
  gamePanel: document.getElementById('gamePanel'),
  winnerPanel: document.getElementById('winnerPanel'),
  
  readyBtn: document.getElementById('readyBtn'),
  startBtn: document.getElementById('startBtn'),
  foldBtn: document.getElementById('foldBtn'),
  checkBtn: document.getElementById('checkBtn'),
  callBtn: document.getElementById('callBtn'),
  raiseBtn: document.getElementById('raiseBtn'),
  allInBtn: document.getElementById('allInBtn'),
  nextHandBtn: document.getElementById('nextHandBtn'),
  
  // 加注滑块
  raiseSlider: document.getElementById('raiseSlider'),
  raiseAmount: document.getElementById('raiseAmount'),
  raiseValue: document.getElementById('raiseValue'),
  confirmRaise: document.getElementById('confirmRaise'),
  cancelRaise: document.getElementById('cancelRaise'),
  
  // 我的牌
  myChips: document.getElementById('myChips'),
  currentBet: document.getElementById('currentBet'),
  
  // 提示
  toast: document.getElementById('messageToast')
};

// ========== 大厅逻辑 ==========

// 加入房间
elements.joinBtn.addEventListener('click', () => {
  const playerName = elements.playerName.value.trim();
  const roomId = elements.roomId.value.trim().toUpperCase();
  
  if (!playerName) {
    showToast('请输入昵称');
    return;
  }
  
  if (!roomId) {
    showToast('请输入房间号');
    return;
  }
  
  socket.emit('joinRoom', { roomId, playerName }, (result) => {
    if (result.success) {
      mySeatIndex = result.seatIndex;
      if (result.isSpectator) {
        showToast('游戏正在进行中，您将作为观战者等待下一局');
      }
      showGame();
    } else {
      showToast(result.message);
    }
  });
});

// 创建新房间
elements.createBtn.addEventListener('click', () => {
  const playerName = elements.playerName.value.trim();
  
  if (!playerName) {
    showToast('请输入昵称');
    return;
  }
  
  socket.emit('createRoom', (result) => {
    if (result.success) {
      elements.roomId.value = result.roomId;
      socket.emit('joinRoom', { roomId: result.roomId, playerName }, (joinResult) => {
        if (joinResult.success) {
          mySeatIndex = joinResult.seatIndex;
          if (joinResult.isSpectator) {
            showToast('游戏正在进行中，您将作为观战者等待下一局');
          }
          showGame();
        } else {
          showToast(joinResult.message);
        }
      });
    }
  });
});

// 离开房间
elements.leaveBtn.addEventListener('click', () => {
  socket.emit('leaveRoom');
  showLobby();
});

// ========== 游戏操作 ==========

// 准备游戏
elements.readyBtn.addEventListener('click', () => {
  socket.emit('setReady', true);
  elements.readyBtn.disabled = true;
  elements.readyBtn.textContent = '已准备';
});

// 开始游戏
elements.startBtn.addEventListener('click', () => {
  socket.emit('startGame', (result) => {
    if (!result.success) {
      showToast(result.message);
    }
  });
});

// 弃牌
elements.foldBtn.addEventListener('click', () => {
  if (!isMyTurn) return;
  socket.emit('playerAction', { action: 'fold' }, (result) => {
    if (!result.success) showToast(result.message);
  });
});

// 过牌
elements.checkBtn.addEventListener('click', () => {
  if (!isMyTurn) return;
  socket.emit('playerAction', { action: 'check' }, (result) => {
    if (!result.success) showToast(result.message);
  });
});

// 跟注
elements.callBtn.addEventListener('click', () => {
  if (!isMyTurn) return;
  socket.emit('playerAction', { action: 'call' }, (result) => {
    if (!result.success) showToast(result.message);
  });
});

// 加注
elements.raiseBtn.addEventListener('click', () => {
  if (!isMyTurn) return;
  showRaiseSlider();
});

// 确认加注
elements.confirmRaise.addEventListener('click', () => {
  const amount = parseInt(elements.raiseAmount.value);
  socket.emit('playerAction', { action: 'raise', amount }, (result) => {
    if (!result.success) showToast(result.message);
    hideRaiseSlider();
  });
});

// 取消加注
elements.cancelRaise.addEventListener('click', () => {
  hideRaiseSlider();
});

// 全押
elements.allInBtn.addEventListener('click', () => {
  if (!isMyTurn) return;
  socket.emit('playerAction', { action: 'allin' }, (result) => {
    if (!result.success) showToast(result.message);
  });
});

// 下一局
elements.nextHandBtn.addEventListener('click', () => {
  socket.emit('setReady', true);
});

// 加注滑块
elements.raiseAmount.addEventListener('input', () => {
  elements.raiseValue.textContent = elements.raiseAmount.value;
});

// ========== Socket.IO 事件 ==========

socket.on('connect', () => {
  myPlayerId = socket.id;
  console.log('已连接服务器:', myPlayerId);
});

socket.on('gameState', (state) => {
  gameState = state;
  updateUI();
});

socket.on('playerJoined', (data) => {
  if (data.isSpectator && data.player.id === myPlayerId) {
    showToast('游戏正在进行中，您将作为观战者等待下一局');
  } else {
    showToast(`${data.player.name} 加入了房间`);
  }
  updatePlayerCount(data.playerCount);
});

socket.on('playerLeft', (data) => {
  showToast('有玩家离开了房间');
  // 立即刷新状态
  socket.emit('getGameState', (state) => {
    if (state) {
      gameState = state;
      updateUI();
    }
  });
});

socket.on('playerReady', (data) => {
  // 更新玩家准备状态 - 重新获取游戏状态
  socket.emit('getGameState', (state) => {
    if (state) {
      gameState = state;
      updateUI();
    }
  });
});

socket.on('disconnect', () => {
  showToast('与服务器断开连接');
  showLobby();
});

// ========== UI更新函数 ==========

function showLobby() {
  screens.lobby.classList.remove('hidden');
  screens.game.classList.add('hidden');
  gameState = null;
  mySeatIndex = -1;
}

function showGame() {
  screens.lobby.classList.add('hidden');
  screens.game.classList.remove('hidden');
  socket.emit('getGameState', (state) => {
    if (state) {
      gameState = state;
      updateUI();
    }
  });
}

function updateUI() {
  if (!gameState) return;

  // 更新房间信息
  elements.currentRoomId.textContent = gameState.roomId;
  elements.playerCount.textContent = gameState.playerCount;
  elements.currentPhase.textContent = getPhaseText(gameState.phase);
  elements.potAmount.textContent = gameState.pot;

  // 更新座位
  updateSeats();

  // 更新公共牌
  updateCommunityCards();

  // 更新我的信息
  updateMyInfo();

  // 更新操作面板
  updateActionPanel();

  // 更新赢家信息
  updateWinners();
}

function updateSeats() {
  const seats = document.querySelectorAll('.seat');
  
  seats.forEach((seat, index) => {
    const playerData = gameState.seats[index];
    const playerCard = seat.querySelector('.player-card');
    
    if (!playerData) {
      playerCard.classList.add('hidden');
      return;
    }
    
    playerCard.classList.remove('hidden');
    
    // 更新玩家信息
    const nameEl = seat.querySelector('.player-name');
    const chipsEl = seat.querySelector('.player-chips');
    const statusEl = seat.querySelector('.player-status');
    const betEl = seat.querySelector('.player-bet');
    const cardsEl = seat.querySelector('.player-cards');
    
    nameEl.textContent = playerData.name;
    chipsEl.textContent = `💰 ${playerData.chips}`;
    
    // 状态标记
    let status = '';
    if (playerData.isDealer) status = 'dealer';
    else if (playerData.isSmallBlind) status = 'sb';
    else if (playerData.isBigBlind) status = 'bb';
    statusEl.className = `player-status ${status}`;
    
    // 下注
    betEl.textContent = playerData.bet > 0 ? `下注: ${playerData.bet}` : '';
    
    // 牌
    if (playerData.cards && playerData.cards.length === 2) {
      cardsEl.innerHTML = playerData.cards.map(card => 
        `<div class="card card-front ${getCardColor(card)}">${card.value}${card.suit}</div>`
      ).join('');
    } else if (playerData.folded) {
      cardsEl.innerHTML = '<span style="color:#888;font-size:11px;">弃牌</span>';
    } else {
      cardsEl.innerHTML = `
        <div class="card card-back">?</div>
        <div class="card card-back">?</div>
      `;
    }
    
    // 高亮当前玩家
    if (gameState.currentPlayer === playerData.id) {
      playerCard.classList.add('active');
    } else {
      playerCard.classList.remove('active');
    }
    
    // 弃牌状态
    if (playerData.folded) {
      playerCard.classList.add('folded');
    } else {
      playerCard.classList.remove('folded');
    }
    
    // 标记自己
    if (playerData.id === myPlayerId) {
      playerCard.classList.add('is-me');
    } else {
      playerCard.classList.remove('is-me');
    }
  });
}

function updateCommunityCards() {
  const container = document.querySelector('.community-cards');
  const cards = gameState.communityCards || [];
  
  let html = '';
  for (let i = 0; i < 5; i++) {
    if (cards[i]) {
      html += `<div class="card card-front ${getCardColor(cards[i])}">${cards[i].value}${cards[i].suit}</div>`;
    } else {
      html += '<div class="card card-empty">-</div>';
    }
  }
  container.innerHTML = html;
}

function findMySeat() {
  // 通过 playerId 找到自己的座位
  if (!gameState || !gameState.seats) return null;
  for (let i = 0; i < gameState.seats.length; i++) {
    if (gameState.seats[i] && gameState.seats[i].id === myPlayerId) {
      mySeatIndex = i;  // 更新 mySeatIndex
      return gameState.seats[i];
    }
  }
  return null;
}

function updateMyInfo() {
  const mySeat = findMySeat();
  if (!mySeat) return;
  
  // 我的筹码
  elements.myChips.textContent = mySeat.chips;
  
  // 当前下注
  elements.currentBet.textContent = gameState.currentBet;
  
  // 是否轮到我
  isMyTurn = gameState.currentPlayer === myPlayerId;
  
  // 更新我的手牌显示（使用 myCards，而不是 seats 中的 cards）
  const myCardsContainer = document.querySelector('.my-cards .cards-container');
  const myCards = gameState.myCards || [];
  if (myCards.length === 2) {
    myCardsContainer.innerHTML = myCards.map(card => 
      `<div class="card card-front ${getCardColor(card)}">${card.value}${card.suit}</div>`
    ).join('');
  } else {
    myCardsContainer.innerHTML = `
      <div class="card card-back">?</div>
      <div class="card card-back">?</div>
    `;
  }
}

function updateActionPanel() {
  const mySeat = findMySeat();
  if (!mySeat) return;
  
  // 观战者模式
  if (mySeat.isSpectator) {
    elements.readyPanel.classList.remove('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.winnerPanel.classList.add('hidden');
    elements.startBtn.classList.add('hidden');
    elements.readyBtn.disabled = true;
    elements.readyBtn.textContent = '观战中...等待下一局';
    return;
  }
  
  // 显示/隐藏面板
  if (!gameState.isRunning) {
    elements.readyPanel.classList.remove('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.winnerPanel.classList.add('hidden');
    
    // 重置准备按钮状态
    elements.readyBtn.disabled = false;
    elements.readyBtn.textContent = mySeat.isReady ? '已准备' : '准备游戏';
    
    // 检查是否可以开始游戏
    const readyCount = gameState.players.filter(p => p.isReady && !p.isSpectator).length;
    if (readyCount >= 2 && mySeat.isReady) {
      elements.startBtn.classList.remove('hidden');
    } else {
      elements.startBtn.classList.add('hidden');
    }
  } else if (gameState.phase === 'showdown') {
    elements.readyPanel.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.winnerPanel.classList.remove('hidden');
  } else {
    elements.readyPanel.classList.add('hidden');
    elements.gamePanel.classList.remove('hidden');
    elements.winnerPanel.classList.add('hidden');
    
    // 更新按钮状态
    const canAct = isMyTurn && !mySeat.folded && !mySeat.allIn;
    
    elements.foldBtn.disabled = !canAct;
    elements.checkBtn.disabled = !canAct || mySeat.bet < gameState.currentBet;
    elements.callBtn.disabled = !canAct || mySeat.bet >= gameState.currentBet;
    elements.raiseBtn.disabled = !canAct;
    elements.allInBtn.disabled = !canAct;
    
    // 更新加注范围
    const minRaise = gameState.currentBet + gameState.minRaise;
    const maxRaise = mySeat.chips + mySeat.bet;
    elements.raiseAmount.min = minRaise;
    elements.raiseAmount.max = maxRaise;
    elements.raiseAmount.value = minRaise;
    elements.raiseValue.textContent = minRaise;
    
    // 更新跟注按钮文字
    const callAmount = gameState.currentBet - mySeat.bet;
    if (callAmount > 0) {
      elements.callBtn.textContent = `跟注 ${callAmount}`;
    } else {
      elements.callBtn.textContent = '跟注';
    }
  }
}

function updateWinners() {
  if (gameState.phase !== 'showdown' || !gameState.winners) return;
  
  const winnerInfo = elements.winnerPanel.querySelector('.winner-info');
  
  if (gameState.winners.length === 1) {
    const w = gameState.winners[0];
    winnerInfo.innerHTML = `
      <div class="winner-name">🏆 ${w.playerName} 获胜!</div>
      <div class="winner-hand">${w.hand ? w.hand.name : ''}</div>
      <div>赢得 ${w.amount} 筹码</div>
    `;
  } else {
    winnerInfo.innerHTML = `
      <div class="winner-name">平局!</div>
      <div>${gameState.winners.map(w => w.playerName).join(', ')} 各获得 ${gameState.winners[0].amount} 筹码</div>
    `;
  }
}

function showRaiseSlider() {
  elements.raiseSlider.classList.remove('hidden');
  elements.raiseAmount.focus();
}

function hideRaiseSlider() {
  elements.raiseSlider.classList.add('hidden');
}

// ========== 工具函数 ==========

function getPhaseText(phase) {
  const phaseNames = {
    'waiting': '等待中',
    'preflop': '翻牌前',
    'flop': '翻牌',
    'turn': '转牌',
    'river': '河牌',
    'showdown': '摊牌'
  };
  return phaseNames[phase] || phase;
}

function getCardColor(card) {
  if (card.suit === '♥' || card.suit === '♦') {
    return 'red';
  }
  return 'black';
}

function showToast(message, duration = 3000) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, duration);
}

function updatePlayerCount(count) {
  elements.playerCount.textContent = count;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 从localStorage恢复昵称
  const savedName = localStorage.getItem('pokerPlayerName');
  if (savedName) {
    elements.playerName.value = savedName;
  }
  
  // 保存昵称
  elements.playerName.addEventListener('change', () => {
    localStorage.setItem('pokerPlayerName', elements.playerName.value);
  });
});
