/* eslint-disable no-undef */

const MEDIA_EVENTS = {
  pressConference: {
    name: 'Pressekonferenz',
    topics: ['Taktik', 'Spielerverletzungen', 'Transfermarkt'],
    positiveOutcome: 0.6,
    reputationImpact: 0.05,
    fanEngagementImpact: 0.08
  },
  interview: {
    name: 'Spielerinterview',
    topics: ['Karriere', 'Mannschaftsgeist', 'Ambitionen'],
    positiveOutcome: 0.7,
    reputationImpact: 0.03,
    fanEngagementImpact: 0.06
  },
  socialMedia: {
    name: 'Social Media Kampagne',
    topics: ['Erfolgsgeschichten', 'Behind-the-Scenes', 'Fankultur'],
    positiveOutcome: 0.8,
    reputationImpact: 0.02,
    fanEngagementImpact: 0.12
  }
};

const mediaState = {
  reputationScore: 50,
  mediaRelations: 50,
  lastCampaigns: [],
  mediaHistory: [],
  publicImage: 'neutral'
};

function initializeMediaManagement() {
  if (!game.mediaManagement) {
    game.mediaManagement = {
      reputationScore: 50,
      mediaRelations: 50,
      campaigns: [],
      publicImage: 'neutral'
    };
  }
}

function updateReputation(delta) {
  if (!game.mediaManagement) initializeMediaManagement();
  game.mediaManagement.reputationScore = Math.min(100, Math.max(0, game.mediaManagement.reputationScore + delta));
}

function updateMediaRelations(delta) {
  if (!game.mediaManagement) initializeMediaManagement();
  game.mediaManagement.mediaRelations = Math.min(100, Math.max(0, game.mediaManagement.mediaRelations + delta));
}

function getPublicImage() {
  if (!game.mediaManagement) return 'neutral';
  
  const reputation = game.mediaManagement.reputationScore || 50;
  if (reputation > 75) return 'excellent';
  if (reputation > 60) return 'positive';
  if (reputation > 40) return 'neutral';
  if (reputation > 25) return 'negative';
  return 'crisis';
}

function conductPressConference(topic) {
  if (!game.mediaManagement) initializeMediaManagement();
  
  const eventConfig = MEDIA_EVENTS.pressConference;
  const success = Math.random() < eventConfig.positiveOutcome;
  
  const result = {
    type: 'pressConference',
    topic: topic,
    success: success,
    date: game.matchday,
    season: game.season
  };
  
  if (success) {
    updateReputation(5);
    updateMediaRelations(3);
    if (game.inbox) {
      addInboxMessage(`📰 Pressekonferenz erfolgreich`, `Thema: ${topic}`);
    }
  } else {
    updateReputation(-3);
    updateMediaRelations(-2);
    if (game.inbox) {
      addInboxMessage(`⚠️ Pressekonferenz kritisch`, `Negative Reaktionen auf Aussagen`);
    }
  }
  
  if (!game.mediaManagement.campaigns) game.mediaManagement.campaigns = [];
  game.mediaManagement.campaigns.push(result);
  
  return result;
}

function launchSocialMediaCampaign(focusTopic) {
  if (!game.mediaManagement) initializeMediaManagement();
  
  const eventConfig = MEDIA_EVENTS.socialMedia;
  const success = Math.random() < eventConfig.positiveOutcome;
  
  const campaign = {
    type: 'socialMedia',
    topic: focusTopic,
    success: success,
    engagement: Math.floor(success ? 5000 + Math.random() * 10000 : 1000 + Math.random() * 3000),
    startMatchday: game.matchday,
    duration: 4,
    status: 'active'
  };
  
  if (success) {
    updateReputation(4);
    updateMediaRelations(2);
    if (game.fanSatisfaction) {
      game.fanSatisfaction = Math.min(100, game.fanSatisfaction + 3);
    }
  } else {
    updateReputation(-2);
    if (game.fanSatisfaction) {
      game.fanSatisfaction = Math.max(0, game.fanSatisfaction - 2);
    }
  }
  
  if (!game.mediaManagement.campaigns) game.mediaManagement.campaigns = [];
  game.mediaManagement.campaigns.push(campaign);
  
  if (game.inbox) {
    addInboxMessage(`📱 Social Media Kampagne`, `${focusTopic}: ${campaign.engagement} Engagement`);
  }
  
  return campaign;
}

function tickMediaCampaigns() {
  if (!game.mediaManagement || !game.mediaManagement.campaigns) return;
  
  game.mediaManagement.campaigns = game.mediaManagement.campaigns.filter((campaign) => {
    if (campaign.type === 'socialMedia' && campaign.status === 'active') {
      if (game.matchday >= campaign.startMatchday + campaign.duration) {
        campaign.status = 'completed';
        if (campaign.success) {
          updateReputation(2);
        }
        return false;
      }
    }
    return true;
  });
}

function respondToMediaCrisis(responseType) {
  if (!game.mediaManagement) initializeMediaManagement();
  
  let reputationChange = 0;
  let relationshipChange = 0;
  
  if (responseType === 'apologize') {
    reputationChange = 8;
    relationshipChange = 5;
  } else if (responseType === 'defend') {
    reputationChange = -2;
    relationshipChange = -3;
  } else if (responseType === 'ignore') {
    reputationChange = -5;
    relationshipChange = -2;
  }
  
  updateReputation(reputationChange);
  updateMediaRelations(relationshipChange);
  
  if (game.inbox) {
    addInboxMessage(`🎙️ Medienkrise ${responseType}`, `Reputation ${reputationChange > 0 ? '+' : ''}${reputationChange}`);
  }
  
  return { reputationChange, relationshipChange };
}

function tickRandomMediaEvent() {
  if (!game.mediaManagement) initializeMediaManagement();
  
  if (Math.random() > 0.05) return;
  
  const currentImage = getPublicImage();
  let eventChance = 0.1;
  
  if (currentImage === 'crisis') eventChance = 0.5;
  else if (currentImage === 'negative') eventChance = 0.3;
  else if (currentImage === 'excellent') eventChance = 0.05;
  
  if (Math.random() < eventChance) {
    updateReputation(-8);
    if (game.inbox) {
      const issues = ['Spieler meldet sich krank', 'Negative Berichterstattung', 'Fanproteste im Stadion'];
      addInboxMessage(`⚠️ Medienkrise`, issues[Math.floor(Math.random() * issues.length)]);
    }
  }
}

function renderMediaManagementPanel() {
  const panel = document.getElementById('media-management-panel');
  if (!panel) return;
  
  initializeMediaManagement();
  
  const reputation = game.mediaManagement.reputationScore || 50;
  const mediaRelations = game.mediaManagement.mediaRelations || 50;
  const publicImage = getPublicImage();
  const imageColors = {
    'excellent': '#4CAF50',
    'positive': '#8BC34A',
    'neutral': '#FFC107',
    'negative': '#FF9800',
    'crisis': '#FF5252'
  };
  const imageLabels = {
    'excellent': '⭐⭐⭐',
    'positive': '⭐⭐',
    'neutral': '⭐',
    'negative': '⚠️',
    'crisis': '🆘'
  };
  
  let html = '<div class="panel-content">';
  html += `<h3>Medien & PR-Management</h3>`;
  
  html += '<div class="media-stats">';
  html += `<div class="stat-box">Ruf: ${Math.round(reputation)}% | <span style="color:${imageColors[publicImage]}; font-weight:bold;">${imageLabels[publicImage]} ${publicImage}</span></div>`;
  html += `<div class="stat-box">Medienbeziehungen: ${Math.round(mediaRelations)}%</div>`;
  html += `<div class="stat-box">Kampagnen: ${(game.mediaManagement.campaigns || []).length}</div>`;
  html += '</div>';
  
  html += '<h4>PR-Maßnahmen:</h4>';
  html += '<div class="media-actions">';
  html += `<button onclick="conductPressConference('Taktik')" style="background:#2196F3; color:white; border:none; padding:6px 12px; margin-right:4px; margin-bottom:4px; border-radius:3px; font-size:10px;">📰 Pressekonferenz</button>`;
  html += `<button onclick="launchSocialMediaCampaign('Spielergeschichte')" style="background:#4CAF50; color:white; border:none; padding:6px 12px; margin-right:4px; margin-bottom:4px; border-radius:3px; font-size:10px;">📱 Social Media</button>`;
  if (publicImage === 'crisis' || publicImage === 'negative') {
    html += `<button onclick="respondToMediaCrisis('apologize')" style="background:#FF9800; color:white; border:none; padding:6px 12px; margin-right:4px; margin-bottom:4px; border-radius:3px; font-size:10px;">🎙️ Entschuldigung</button>`;
  }
  html += '</div>';
  
  html += '<h4>Aktuelle Kampagnen:</h4>';
  const activeCampaigns = (game.mediaManagement.campaigns || []).filter(c => c.status === 'active' || (c.type !== 'socialMedia'));
  if (activeCampaigns.length > 0) {
    activeCampaigns.slice(-5).forEach((campaign) => {
      const statusIcon = campaign.success ? '✅' : '❌';
      html += `<div class="campaign-item">`;
      html += `<strong>${statusIcon} ${campaign.type === 'pressConference' ? '📰' : '📱'} ${campaign.topic}</strong>`;
      if (campaign.engagement) {
        html += `<div class="campaign-info">Engagement: ${campaign.engagement.toLocaleString()}</div>`;
      }
      html += '</div>';
    });
  } else {
    html += '<div style="font-size:11px; color:#999;">Keine aktuellen Kampagnen</div>';
  }
  
  html += '</div>';
  panel.innerHTML = html;
}
