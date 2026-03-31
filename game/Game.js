// Game.js - 德州扑克游戏逻辑
const Deck = require('./Deck');
const Player = require('./Player');
const HandEvaluator = require('./HandEvaluator');

class Game {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.players = new Map();
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.minRaise = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.phase = 'waiting'; // waiting, preflop, flop, turn, river, showdown
    this.isRunning = false;
    this.lastRaiseIndex = -1;
    this.actionCount = 0;
    this.maxPlayers = 8;
    this.minPlayers = 2;
    this.seats = new Array(8).fill(null); // 8个座位
    this.playerCount = 0;
    this.winners = [];
    this.lastActivity = Date.now();
  }

  addPlayer(socketId, playerName) {
    if (this.players.size >= this.maxPlayers) {
      return { success: false, message: '房间已满' };
    }

    if (this.players.has(socketId)) {
      return { success: false, message: '你已经在房间中' };
    }

    // 找一个空座位
    let seatIndex = -1;
    for (let i = 0; i < this.seats.length; i++) {
      if (this.seats[i] === null) {
        seatIndex = i;
        break;
      }
    }

    if (seatIndex === -1) {
      return { success: false, message: '没有空座位' };
    }

    const player = new Player(socketId, playerName, seatIndex);
    
    // 如果游戏正在进行中，标记为观战者
    if (this.isRunning) {
      player.isSpectator = true;
      player.isReady = false;
    }
    
    this.players.set(socketId, player);
    this.seats[seatIndex] = socketId;
    this.playerCount++;
    this.lastActivity = Date.now();

    return { success: true, player, seatIndex, isSpectator: player.isSpectator };
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return false;

    const wasCurrentPlayer = this.seats[this.currentPlayerIndex] === socketId;
    const wasLastRaiser = this.lastRaiseIndex === player.seatIndex;

    this.seats[player.seatIndex] = null;
    this.players.delete(socketId);
    this.playerCount--;
    this.lastActivity = Date.now();

    // 如果游戏进行中，标记玩家弃牌
    if (this.isRunning && player.isInHand()) {
      player.folded = true;
      player.sitOut = true;
      player.lastAction = 'fold';
      
      // 如果离开的是最后加注者，需要找到新的最后加注者
      if (wasLastRaiser) {
        this.updateLastRaiseIndex();
      }
      
      // 如果离开的是当前玩家，需要移动到下一个玩家
      if (wasCurrentPlayer) {
        this.moveToNextPlayer();
      }
      
      this.checkEndCondition();
      this.broadcastState();
    }

    // 如果玩家人数不足，结束游戏
    if (this.players.size < this.minPlayers && this.isRunning) {
      this.endGame();
    }

    return true;
  }

  updateLastRaiseIndex() {
    // 找到最近一个加注的玩家
    const playersInHand = this.getPlayersInHand();
    if (playersInHand.length === 0) return;
    
    // 如果没有加注者，设置为庄家位置
    this.lastRaiseIndex = this.dealerIndex;
  }

  setPlayerReady(socketId, ready) {
    const player = this.players.get(socketId);
    if (player) {
      // 观战者在游戏进行中不能准备
      if (player.isSpectator && this.isRunning) {
        return { success: false, message: '观战者需要等待下一局才能参与' };
      }
      player.isReady = ready;
      this.lastActivity = Date.now();
      return { success: true };
    }
    return { success: false, message: '玩家不存在' };
  }

  startGame() {
    if (this.isRunning) {
      return { success: false, message: '游戏已在进行中' };
    }

    const readyPlayers = [...this.players.values()].filter(p => p.isReady && p.chips > 0 && !p.isSpectator);
    if (readyPlayers.length < this.minPlayers) {
      return { success: false, message: '至少需要2名准备好的玩家' };
    }

    this.isRunning = true;
    this.phase = 'preflop';
    this.pot = 0;
    this.sidePots = [];
    this.communityCards = [];
    this.winners = [];
    this.actionCount = 0;

    // 重置所有玩家
    for (const player of this.players.values()) {
      player.resetForNewHand();
    }

    // 初始化牌组
    this.deck.reset();
    this.deck.shuffle();

    // 移动庄家位置
    this.moveDealer();

    // 发 blinds
    this.postBlinds();

    // 发手牌
    this.dealHoleCards();

    // 设置第一个行动玩家 (大盲位后第一个)
    this.setCurrentPlayerAfterBigBlind();

    this.lastActivity = Date.now();
    this.broadcastState();

    return { success: true };
  }

  moveDealer() {
    // 获取所有有筹码且可以参与的玩家
    const eligiblePlayers = [...this.players.values()].filter(p => p.chips > 0 && !p.sitOut && !p.isSpectator);
    if (eligiblePlayers.length < 2) return;

    // 重置所有庄家/盲注标记
    for (const player of this.players.values()) {
      player.isDealer = false;
      player.isSmallBlind = false;
      player.isBigBlind = false;
    }

    // 找到下一个庄家位置（顺时针移动）
    let newDealerIndex = this.dealerIndex;
    let found = false;
    
    for (let i = 0; i < 8; i++) {
      newDealerIndex = (newDealerIndex + 1) % 8;
      const player = this.players.get(this.seats[newDealerIndex]);
      if (player && player.chips > 0 && !player.sitOut && !player.isSpectator) {
        found = true;
        break;
      }
    }

    if (!found) return;

    // 设置庄家
    const dealerPlayer = this.players.get(this.seats[newDealerIndex]);
    if (dealerPlayer) {
      dealerPlayer.isDealer = true;
      this.dealerIndex = newDealerIndex;
    }

    // 设置小盲（庄家后第一个有筹码的玩家）
    let sbIndex = newDealerIndex;
    for (let i = 0; i < 8; i++) {
      sbIndex = (sbIndex + 1) % 8;
      const player = this.players.get(this.seats[sbIndex]);
      if (player && player.chips > 0 && !player.sitOut && !player.isSpectator) {
        player.isSmallBlind = true;
        break;
      }
    }

    // 设置大盲（小盲后第一个有筹码的玩家）
    let bbIndex = sbIndex;
    for (let i = 0; i < 8; i++) {
      bbIndex = (bbIndex + 1) % 8;
      const player = this.players.get(this.seats[bbIndex]);
      if (player && player.chips > 0 && !player.sitOut && !player.isSpectator) {
        player.isBigBlind = true;
        break;
      }
    }

    console.log(`[moveDealer] 庄家: 座位${newDealerIndex}, 小盲: 座位${sbIndex}, 大盲: 座位${bbIndex}`);
  }

  findNextActivePlayer(fromPos) {
    let pos = fromPos;
    for (let i = 0; i < 8; i++) {
      pos = (pos + 1) % 8;
      const playerId = this.seats[pos];
      if (playerId) {
        const player = this.players.get(playerId);
        if (player && player.chips > 0 && !player.sitOut && !player.isSpectator) {
          return pos;
        }
      }
    }
    return fromPos;
  }

  postBlinds() {
    // 小盲
    const sbPlayer = [...this.players.values()].find(p => p.isSmallBlind);
    if (sbPlayer) {
      const sbAmount = sbPlayer.betChips(this.smallBlind);
      this.pot += sbAmount;
    }

    // 大盲
    const bbPlayer = [...this.players.values()].find(p => p.isBigBlind);
    if (bbPlayer) {
      const bbAmount = bbPlayer.betChips(this.bigBlind);
      this.pot += bbAmount;
    }

    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;
  }

  dealHoleCards() {
    for (const player of this.players.values()) {
      // 只给有筹码、未离开座位、非观战者的玩家发牌
      if (player.chips > 0 && !player.sitOut && !player.isSpectator) {
        player.cards = this.deck.dealMultiple(2);
      }
    }
  }

  setCurrentPlayerAfterBigBlind() {
    const bbPlayer = [...this.players.values()].find(p => p.isBigBlind);
    if (bbPlayer) {
      this.currentPlayerIndex = this.findNextActivePlayer(bbPlayer.seatIndex);
      // 大盲是翻牌前阶段的最后加注者
      this.lastRaiseIndex = bbPlayer.seatIndex;
    }
  }

  getActivePlayers() {
    return [...this.players.values()].filter(p => p.chips > 0 && !p.sitOut && !p.isSpectator);
  }

  getPlayersInHand() {
    return [...this.players.values()].filter(p => p.isInHand());
  }

  getCurrentPlayer() {
    const playerId = this.seats[this.currentPlayerIndex];
    return playerId ? this.players.get(playerId) : null;
  }

  playerAction(socketId, action, amount = 0) {
    const player = this.players.get(socketId);
    if (!player || !this.isRunning) {
      return { success: false, message: '无效操作' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (player.id !== currentPlayer?.id) {
      return { success: false, message: '不是你的回合' };
    }

    this.lastActivity = Date.now();
    let result = { success: true };

    switch (action) {
      case 'fold':
        player.folded = true;
        player.lastAction = 'fold';
        break;

      case 'check':
        if (player.bet < this.currentBet) {
          return { success: false, message: '无法过牌，需要跟注或弃牌' };
        }
        player.lastAction = 'check';
        break;

      case 'call':
        const callAmount = this.currentBet - player.bet;
        if (callAmount <= 0) {
          player.lastAction = 'check';
        } else {
          const actualBet = player.betChips(callAmount);
          this.pot += actualBet;
          player.lastAction = 'call';
        }
        break;

      case 'raise':
        const minRaiseAmount = this.currentBet + this.minRaise;
        if (amount < minRaiseAmount && player.chips > minRaiseAmount - player.bet) {
          return { success: false, message: `最小加注金额为 ${minRaiseAmount}` };
        }
        
        const raiseTotal = Math.min(amount, player.chips + player.bet);
        const raiseBet = raiseTotal - player.bet;
        const actualRaise = player.betChips(raiseBet);
        this.pot += actualRaise;
        
        this.minRaise = raiseTotal - this.currentBet;
        this.currentBet = raiseTotal;
        this.lastRaiseIndex = player.seatIndex;
        player.lastAction = 'raise';
        break;

      case 'allin':
        const allInAmount = player.chips;
        player.betChips(allInAmount);
        this.pot += allInAmount;
        
        if (player.bet > this.currentBet) {
          this.minRaise = player.bet - this.currentBet;
          this.currentBet = player.bet;
          this.lastRaiseIndex = player.seatIndex;
        }
        player.lastAction = 'allin';
        break;

      default:
        return { success: false, message: '未知操作' };
    }

    this.actionCount++;
    this.broadcastState();

    // 检查是否进入下一阶段
    if (this.checkEndCondition()) {
      return result;
    }

    // 移动到下一个玩家
    this.moveToNextPlayer();

    return result;
  }

  moveToNextPlayer() {
    const playersInHand = this.getPlayersInHand();
    const activePlayers = playersInHand.filter(p => p.canAct());

    console.log(`[moveToNextPlayer] 当前玩家: ${this.currentPlayerIndex}, lastRaiseIndex: ${this.lastRaiseIndex}, 在局玩家: ${playersInHand.length}, 可行动: ${activePlayers.length}`);

    // 如果只剩一个玩家未弃牌
    if (playersInHand.length === 1) {
      console.log('[moveToNextPlayer] 只剩一个玩家，结束本局');
      this.endHand();
      return;
    }

    // 如果没有可行动的玩家（全部弃牌或全押），直接进入下一阶段
    if (activePlayers.length === 0) {
      console.log('[moveToNextPlayer] 没有可行动玩家，进入下一阶段');
      this.nextPhase();
      return;
    }

    // 找下一个可行动的玩家
    let nextIndex = this.currentPlayerIndex;
    let startIndex = nextIndex;
    let foundPlayer = false;

    for (let i = 0; i < 8; i++) {
      nextIndex = (nextIndex + 1) % 8;
      const nextPlayer = this.players.get(this.seats[nextIndex]);
      
      console.log(`[moveToNextPlayer] 检查座位 ${nextIndex}: 玩家=${nextPlayer?.name}, canAct=${nextPlayer?.canAct()}, isInHand=${nextPlayer?.isInHand()}, folded=${nextPlayer?.folded}`);
      
      // 严格检查：玩家必须存在、可行动、在局内
      if (nextPlayer && nextPlayer.canAct() && nextPlayer.isInHand() && !nextPlayer.folded) {
        // 检查是否已经所有人都行动完毕
        if (this.isRoundComplete(nextPlayer, nextIndex)) {
          console.log('[moveToNextPlayer] 回合完成，进入下一阶段');
          this.nextPhase();
          return;
        }
        
        console.log(`[moveToNextPlayer] 设置下一个玩家: ${nextPlayer.name} (座位 ${nextIndex})`);
        this.currentPlayerIndex = nextIndex;
        foundPlayer = true;
        this.broadcastState();
        return;
      }
    }

    // 如果没找到可行动的玩家，进入下一阶段
    if (!foundPlayer) {
      console.log('[moveToNextPlayer] 未找到可行动玩家，进入下一阶段');
      this.nextPhase();
    }
  }

  // 检查当前回合是否完成
  isRoundComplete(nextPlayer, nextIndex) {
    // 翻牌前特殊处理：大盲有优先权
    if (this.phase === 'preflop' && nextPlayer.isBigBlind && !nextPlayer.lastAction) {
      return false;
    }

    // 检查所有在局且未弃牌的玩家是否都已行动且下注相同
    const playersToCheck = this.getPlayersInHand();
    
    for (const player of playersToCheck) {
      // 全押玩家跳过
      if (player.allIn) continue;
      
      // 检查是否有玩家下注不足或未行动
      if (player.bet < this.currentBet) {
        return false;
      }
      
      // 如果玩家没有行动过（除了翻牌前的大盲）
      if (!player.lastAction) {
        if (this.phase === 'preflop' && player.isBigBlind) {
          continue; // 大盲在翻牌前可以没有lastAction
        }
        return false;
      }
    }

    return true;
  }

  allBetsEqual() {
    const playersInHand = this.getPlayersInHand();
    const maxBet = this.currentBet;
    
    for (const player of playersInHand) {
      if (!player.allIn && player.bet < maxBet) {
        return false;
      }
    }
    return true;
  }

  checkEndCondition() {
    const playersInHand = this.getPlayersInHand();
    
    if (playersInHand.length === 1) {
      // 只剩一个玩家，直接获胜
      this.endHand();
      return true;
    }
    
    return false;
  }

  nextPhase() {
    // 重置玩家本轮下注和行动记录
    for (const player of this.players.values()) {
      player.bet = 0;
      player.lastAction = null;  // 关键：重置行动记录
    }
    this.currentBet = 0;
    this.actionCount = 0;

    switch (this.phase) {
      case 'preflop':
        this.phase = 'flop';
        this.communityCards = this.deck.dealMultiple(3);
        break;
      case 'flop':
        this.phase = 'turn';
        this.communityCards.push(this.deck.deal());
        break;
      case 'turn':
        this.phase = 'river';
        this.communityCards.push(this.deck.deal());
        break;
      case 'river':
        this.phase = 'showdown';
        this.endHand();
        return;
    }

    // 设置第一个行动玩家（庄家后第一个在局内的玩家）
    this.currentPlayerIndex = this.findNextActivePlayer(this.dealerIndex);
    this.lastRaiseIndex = this.currentPlayerIndex;

    this.broadcastState();
  }

  endHand() {
    this.phase = 'showdown';
    
    const playersInHand = this.getPlayersInHand();
    
    if (playersInHand.length === 1) {
      // 只有一个玩家，直接获胜
      const winner = playersInHand[0];
      winner.chips += this.pot;
      this.winners = [{
        player: winner,
        hand: null,
        amount: this.pot
      }];
    } else {
      // 比较牌型
      this.winners = this.determineWinners(playersInHand);
    }

    this.isRunning = false;
    
    // 重置观战者状态，让他们可以参与下一局
    for (const player of this.players.values()) {
      if (player.isSpectator) {
        player.isSpectator = false;
      }
    }
    
    this.broadcastState();
  }

  determineWinners(playersInHand) {
    const hands = playersInHand.map(player => {
      const allCards = [...player.cards, ...this.communityCards];
      const hand = HandEvaluator.evaluate(allCards);
      return { player, hand };
    });

    // 按牌型分数排序
    hands.sort((a, b) => b.hand.score - a.hand.score);

    // 找出所有赢家（可能平分）
    const winners = [];
    const topScore = hands[0].hand.score;
    let totalPot = this.pot;

    for (const { player, hand } of hands) {
      if (hand.score === topScore) {
        winners.push({ player, hand, amount: 0 });
      } else {
        break;
      }
    }

    // 分配底池
    const shareAmount = Math.floor(this.pot / winners.length);
    for (const winner of winners) {
      winner.amount = shareAmount;
      winner.player.chips += shareAmount;
    }

    return winners;
  }

  endGame() {
    this.isRunning = false;
    this.phase = 'waiting';
    this.broadcastState();
  }

  broadcastState() {
    // 对每个玩家发送个性化状态（包含他们自己的手牌）
    for (const [socketId, player] of this.players) {
      const state = this.getPlayerState(socketId);
      this.io.to(socketId).emit('gameState', state);
    }
  }

  getState() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      pot: this.pot,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayer: this.getCurrentPlayer()?.id || null,
      isRunning: this.isRunning,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      playerCount: this.playerCount,
      seats: this.seats.map((playerId, index) => {
        if (!playerId) return null;
        const player = this.players.get(playerId);
        if (!player) return null;
        
        // 底牌逻辑：只在摊牌阶段且玩家未弃牌时才显示
        let visibleCards = [];
        if (this.phase === 'showdown' && !player.folded) {
          visibleCards = player.cards;
        }
        
        return {
          id: player.id,
          name: player.name,
          seatIndex: player.seatIndex,
          chips: player.chips,
          cards: visibleCards,  // 只有摊牌时才显示
          bet: player.bet,
          folded: player.folded,
          allIn: player.allIn,
          isReady: player.isReady,
          isSpectator: player.isSpectator,  // 添加观战者状态
          isDealer: player.isDealer,
          isSmallBlind: player.isSmallBlind,
          isBigBlind: player.isBigBlind,
          lastAction: player.lastAction
        };
      }),
      players: [...this.players.values()].map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        isReady: p.isReady,
        lastAction: p.lastAction,
        seatIndex: p.seatIndex
      })),
      winners: this.winners.map(w => ({
        playerId: w.player.id,
        playerName: w.player.name,
        hand: w.hand ? { name: w.hand.name, cards: w.hand.cards } : null,
        amount: w.amount
      }))
    };
  }

  getPlayerState(socketId) {
    const state = this.getState();
    const player = this.players.get(socketId);
    
    if (player) {
      // 观战者不显示手牌
      state.myCards = player.isSpectator ? [] : player.cards;
      state.myBet = player.bet;
      state.myChips = player.chips;
      state.isMyTurn = !player.isSpectator && this.getCurrentPlayer()?.id === socketId;
      state.isSpectator = player.isSpectator;
    }
    
    return state;
  }
}

module.exports = Game;
