// Player.js - 玩家类
class Player {
  constructor(id, name, seatIndex) {
    this.id = id;
    this.name = name;
    this.seatIndex = seatIndex;
    this.chips = 1000; // 初始筹码
    this.cards = [];   // 手牌
    this.bet = 0;      // 当前轮下注
    this.totalBet = 0; // 本局总下注
    this.folded = false;
    this.allIn = false;
    this.isReady = false;
    this.isDealer = false;
    this.isSmallBlind = false;
    this.isBigBlind = false;
    this.lastAction = null;
    this.sitOut = false; // 离开座位
    this.isSpectator = false; // 观战者（中途加入）
  }

  reset() {
    this.cards = [];
    this.bet = 0;
    this.totalBet = 0;
    this.folded = false;
    this.allIn = false;
    this.lastAction = null;
    this.isDealer = false;
    this.isSmallBlind = false;
    this.isBigBlind = false;
  }

  resetForNewHand() {
    this.cards = [];
    this.bet = 0;
    this.totalBet = 0;
    this.folded = false;
    this.allIn = false;
    this.lastAction = null;
  }

  canAct() {
    return !this.folded && !this.allIn && this.chips > 0 && !this.sitOut;
  }

  isInHand() {
    return !this.folded && !this.sitOut;
  }

  betChips(amount) {
    const actualBet = Math.min(amount, this.chips);
    this.chips -= actualBet;
    this.bet += actualBet;
    this.totalBet += actualBet;
    
    if (this.chips === 0) {
      this.allIn = true;
    }
    
    return actualBet;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      seatIndex: this.seatIndex,
      chips: this.chips,
      cards: this.cards,
      bet: this.bet,
      totalBet: this.totalBet,
      folded: this.folded,
      allIn: this.allIn,
      isReady: this.isReady,
      isDealer: this.isDealer,
      isSmallBlind: this.isSmallBlind,
      isBigBlind: this.isBigBlind,
      lastAction: this.lastAction,
      sitOut: this.sitOut,
      canAct: this.canAct()
    };
  }
}

module.exports = Player;
