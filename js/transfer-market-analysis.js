/* eslint-disable no-undef */

const MARKET_TRENDS = {
  striker: {
    name: 'Stürmer',
    priceMultiplier: 1.0,
    demandLevel: 'high',
    volatility: 0.15
  },
  midfielder: {
    name: 'Mittelfeld',
    priceMultiplier: 0.85,
    demandLevel: 'very high',
    volatility: 0.12
  },
  defender: {
    name: 'Abwehr',
    priceMultiplier: 0.75,
    demandLevel: 'medium',
    volatility: 0.10
  },
  goalkeeper: {
    name: 'Torwart',
    priceMultiplier: 0.65,
    demandLevel: 'low',
    volatility: 0.08
  }
};

const transferMarketState = {
  marketAnalysis: null,
  watchlist: [],
  scoutReports: [],
  marketTrends: []
};

function initializeTransferMarket() {
  if (!game.transferMarket) {
    game.transferMarket = {
      watchlist: [],
      scoutReports: [],
      marketAnalysis: null,
      discoveredBargains: 0
    };
  }
}

function analyzeMarketTrends() {
  const analysis = {
    timestamp: game.matchday,
    season: game.season,
    trends: {},
    opportunities: []
  };
  
  Object.entries(MARKET_TRENDS).forEach(([positionKey, positionData]) => {
    const volatility = positionData.volatility;
    const baseMultiplier = positionData.priceMultiplier;
    const currentMultiplier = baseMultiplier * (0.9 + Math.random() * 0.2);
    
    analysis.trends[positionKey] = {
      position: positionData.name,
      demandLevel: positionData.demandLevel,
      priceIndex: Math.round(currentMultiplier * 100),
      trend: currentMultiplier > baseMultiplier ? 'rising' : 'falling',
      volatility: Math.round(volatility * 100)
    };
    
    if (currentMultiplier < baseMultiplier * 0.92) {
      analysis.opportunities.push({
        position: positionKey,
        description: `${positionData.name} unterbewertet`,
        discount: Math.round((1 - currentMultiplier / baseMultiplier) * 100)
      });
    }
  });
  
  if (!game.transferMarket) initializeTransferMarket();
  game.transferMarket.marketAnalysis = analysis;
  
  if (analysis.opportunities.length > 0 && game.inbox) {
    addInboxMessage(`📊 Marktanalyse`, `${analysis.opportunities.length} Gelegenheit(en) gefunden`);
  }
  
  return analysis;
}

function scoutPlayer(playerName, estimatedValue) {
  if (!game.transferMarket) initializeTransferMarket();
  
  const report = {
    id: (game.transferMarket.scoutReports || []).length,
    playerName: playerName,
    estimatedValue: estimatedValue,
    marketValue: Math.round(estimatedValue * (0.8 + Math.random() * 0.4)),
    scoutedMatchday: game.matchday,
    season: game.season,
    recommendation: '',
    status: 'active'
  };
  
  const marketValue = report.marketValue;
  const estimatedRatio = marketValue / estimatedValue;
  
  if (estimatedRatio < 0.9) {
    report.recommendation = 'Bargain - potentially undervalued';
    game.transferMarket.discoveredBargains = (game.transferMarket.discoveredBargains || 0) + 1;
  } else if (estimatedRatio > 1.1) {
    report.recommendation = 'Overpriced - avoid';
  } else {
    report.recommendation = 'Fair market price';
  }
  
  if (!game.transferMarket.scoutReports) game.transferMarket.scoutReports = [];
  game.transferMarket.scoutReports.push(report);
  
  if (game.inbox) {
    addInboxMessage(`🔍 Scout-Bericht`, `${playerName}: €${marketValue.toLocaleString()}`);
  }
  
  return report;
}

function addToWatchlist(playerId, playerName, currentValue) {
  if (!game.transferMarket) initializeTransferMarket();
  
  const watchEntry = {
    id: (game.transferMarket.watchlist || []).length,
    playerId: playerId,
    playerName: playerName,
    currentValue: currentValue,
    highestValue: currentValue,
    lowestValue: currentValue,
    addedMatchday: game.matchday,
    priceHistory: [{ matchday: game.matchday, value: currentValue }]
  };
  
  if (!game.transferMarket.watchlist) game.transferMarket.watchlist = [];
  game.transferMarket.watchlist.push(watchEntry);
  
  if (game.inbox) {
    addInboxMessage(`⭐ Merkliste`, `${playerName} hinzugefügt`);
  }
  
  return watchEntry;
}

function updateWatchlistPrices() {
  if (!game.transferMarket || !game.transferMarket.watchlist) return;
  
  game.transferMarket.watchlist.forEach((entry) => {
    const priceChange = entry.currentValue * (0.95 + Math.random() * 0.1);
    entry.currentValue = Math.round(priceChange);
    entry.highestValue = Math.max(entry.highestValue, entry.currentValue);
    entry.lowestValue = Math.min(entry.lowestValue, entry.currentValue);
    
    entry.priceHistory.push({
      matchday: game.matchday,
      value: entry.currentValue
    });
    
    if (entry.priceHistory.length > 20) {
      entry.priceHistory.shift();
    }
  });
}

function tickTransferMarketAnalysis() {
  if (game.matchday % 4 === 0) {
    analyzeMarketTrends();
    updateWatchlistPrices();
  }
}

function getMarketInsight() {
  if (!game.transferMarket || !game.transferMarket.marketAnalysis) {
    return analyzeMarketTrends();
  }
  return game.transferMarket.marketAnalysis;
}

function removeFromWatchlist(entryId) {
  if (!game.transferMarket || !game.transferMarket.watchlist) return;
  game.transferMarket.watchlist = game.transferMarket.watchlist.filter(e => e.id !== entryId);
}

function renderTransferMarketAnalysisPanel() {
  const panel = document.getElementById('transfer-market-panel');
  if (!panel) return;
  
  initializeTransferMarket();
  
  const analysis = getMarketInsight();
  const watchlist = (game.transferMarket.watchlist || []).sort((a, b) => b.currentValue - a.currentValue);
  const scoutReports = (game.transferMarket.scoutReports || []).slice(-5);
  
  let html = '<div class="panel-content">';
  html += `<h3>Transfer-Markt-Analyse</h3>`;
  
  html += '<div class="market-stats">';
  html += `<div class="stat-box">Beobachtete Spieler: ${watchlist.length}</div>`;
  html += `<div class="stat-box">Scout-Berichte: ${(game.transferMarket.scoutReports || []).length}</div>`;
  html += `<div class="stat-box">Gefundene Schnäppchen: ${game.transferMarket.discoveredBargains || 0}</div>`;
  html += '</div>';
  
  if (analysis && analysis.trends) {
    html += '<h4>Markt-Trends:</h4>';
    html += '<div class="market-trends">';
    Object.entries(analysis.trends).forEach(([key, trend]) => {
      const trendIcon = trend.trend === 'rising' ? '📈' : '📉';
      html += `<div class="trend-item">`;
      html += `<strong>${trend.position}</strong> ${trendIcon}`;
      html += `<div class="trend-info">Index: ${trend.priceIndex} | Nachfrage: ${trend.demandLevel}</div>`;
      html += '</div>';
    });
    html += '</div>';
    
    if (analysis.opportunities && analysis.opportunities.length > 0) {
      html += '<h4>Markt-Chancen:</h4>';
      analysis.opportunities.forEach((opp) => {
        html += `<div class="opportunity-item" style="background:#E8F5E9; padding:6px; border-left:3px solid #4CAF50; margin-bottom:4px;">`;
        html += `<strong style="color:#2E7D32;">${opp.description}</strong>`;
        html += `<div style="font-size:10px; color:#558B2F;">Rabatt: -${opp.discount}%</div>`;
        html += '</div>';
      });
    }
  }
  
  if (scoutReports.length > 0) {
    html += '<h4>Letzte Scout-Berichte:</h4>';
    scoutReports.forEach((report) => {
      const recommendColor = report.recommendation.includes('Bargain') ? '#4CAF50' : 
                            report.recommendation.includes('Overpriced') ? '#FF5252' : '#FFC107';
      html += `<div class="scout-report-item">`;
      html += `<strong>${report.playerName}</strong>`;
      html += `<div class="report-info">Marktwert: €${report.marketValue.toLocaleString()}</div>`;
      html += `<div class="report-info" style="color:${recommendColor}; font-size:10px; font-weight:bold;">${report.recommendation}</div>`;
      html += '</div>';
    });
  }
  
  if (watchlist.length > 0) {
    html += '<h4>Merkliste (Top 5):</h4>';
    watchlist.slice(0, 5).forEach((entry) => {
      const valueTrend = entry.priceHistory.length > 1 ? 
        (entry.priceHistory[entry.priceHistory.length - 1].value >= entry.priceHistory[entry.priceHistory.length - 2].value ? '📈' : '📉') : '';
      html += `<div class="watchlist-item">`;
      html += `<strong>${entry.playerName}</strong> ${valueTrend}`;
      html += `<div class="watchlist-info">Aktuell: €${entry.currentValue.toLocaleString()} | High: €${entry.highestValue.toLocaleString()} | Low: €${entry.lowestValue.toLocaleString()}</div>`;
      html += `<button onclick="removeFromWatchlist(${entry.id})" style="background:#FF5252; color:white; border:none; padding:3px 6px; border-radius:2px; font-size:9px;">✕</button>`;
      html += '</div>';
    });
  }
  
  html += '</div>';
  panel.innerHTML = html;
}
