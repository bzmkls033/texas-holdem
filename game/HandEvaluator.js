// HandEvaluator.js - 德州扑克牌型评估
class HandEvaluator {
  static evaluate(cards) {
    if (cards.length < 5) return { rank: 0, name: '无效', highCards: [] };
    
    // 生成所有5张牌的组合
    const combinations = this.getCombinations(cards, 5);
    let bestHand = { rank: 0, name: '高牌', highCards: [], score: 0 };
    
    for (const combo of combinations) {
      const hand = this.evaluateFive(combo);
      if (hand.score > bestHand.score) {
        bestHand = hand;
      }
    }
    
    return bestHand;
  }

  static getCombinations(arr, size) {
    if (size === 1) return arr.map(el => [el]);
    const result = [];
    for (let i = 0; i <= arr.length - size; i++) {
      const rest = this.getCombinations(arr.slice(i + 1), size - 1);
      for (const combo of rest) {
        result.push([arr[i], ...combo]);
      }
    }
    return result;
  }

  static evaluateFive(cards) {
    const values = cards.map(c => this.cardValue(c.value)).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.isStraight(values);
    const valueCounts = this.getValueCounts(values);
    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    
    let rank = 0;
    let name = '高牌';
    let score = 0;
    
    // 皇家同花顺
    if (isFlush && isStraight && values[0] === 14 && values[4] === 10) {
      rank = 10;
      name = '皇家同花顺';
      score = 10000000 + values[0];
    }
    // 同花顺
    else if (isFlush && isStraight) {
      rank = 9;
      name = '同花顺';
      score = 9000000 + values[0];
    }
    // 四条
    else if (counts[0] === 4) {
      rank = 8;
      name = '四条';
      const quadValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 4));
      score = 8000000 + quadValue * 100;
    }
    // 葫芦
    else if (counts[0] === 3 && counts[1] === 2) {
      rank = 7;
      name = '葫芦';
      const tripValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 3));
      const pairValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
      score = 7000000 + tripValue * 100 + pairValue;
    }
    // 同花
    else if (isFlush) {
      rank = 6;
      name = '同花';
      score = 6000000 + values.reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
    }
    // 顺子
    else if (isStraight) {
      rank = 5;
      name = '顺子';
      score = 5000000 + values[0];
    }
    // 三条
    else if (counts[0] === 3) {
      rank = 4;
      name = '三条';
      const tripValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 3));
      score = 4000000 + tripValue * 100;
    }
    // 两对
    else if (counts[0] === 2 && counts[1] === 2) {
      rank = 3;
      name = '两对';
      const pairs = Object.keys(valueCounts).filter(k => valueCounts[k] === 2).map(Number).sort((a, b) => b - a);
      score = 3000000 + pairs[0] * 1000 + pairs[1] * 10;
    }
    // 一对
    else if (counts[0] === 2) {
      rank = 2;
      name = '一对';
      const pairValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
      score = 2000000 + pairValue * 100;
    }
    // 高牌
    else {
      rank = 1;
      name = '高牌';
      score = 1000000 + values.reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
    }
    
    return { rank, name, highCards: values, score, cards };
  }

  static cardValue(value) {
    const valueMap = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11 };
    return valueMap[value] || parseInt(value);
  }

  static isStraight(values) {
    const sorted = [...new Set(values)].sort((a, b) => b - a);
    if (sorted.length < 5) return false;
    
    // 检查普通顺子
    for (let i = 0; i <= sorted.length - 5; i++) {
      if (sorted[i] - sorted[i + 4] === 4) return true;
    }
    
    // 检查 A-2-3-4-5 (轮子)
    if (sorted.includes(14) && sorted.includes(2) && sorted.includes(3) && 
        sorted.includes(4) && sorted.includes(5)) {
      return true;
    }
    
    return false;
  }

  static getValueCounts(values) {
    const counts = {};
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  }

  static compareHands(hand1, hand2) {
    return hand1.score - hand2.score;
  }
}

module.exports = HandEvaluator;
