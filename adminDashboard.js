// ===== DASHBOARD ADMIN - GESTION TOURNOIS =====

// ===== CONFIGURATION MULTI-JEU =====
const GAMES_CONFIG = {
  dino: {
    name: 'dino',
    id: 'dino',
    icon: '🦕'
  },
  puzzle: {
    name: 'puzzle',
    id: 'puzzle',
    icon: '🧩'
  },
  idantik: {
    name: 'idantik',
    id: 'idantik',
    icon: '🟢🟢🟢'
  }
};

let selectedGame = 'dino'; // Jeu sélectionné par défaut

// ===== CHARGER DONNÉES DASHBOARD =====
function loadDashboardData() {
  loadActiveTournaments(); 
  loadPendingTournaments();
  loadStatistics();
  loadTransactionsHistory();
  loadTournamentCreators();
  loadPendingDeposits();
}

// ===== CHARGER TOURNOIS EN ATTENTE =====
function loadPendingTournaments() {
  window.firebaseApp.db.collection('tournaments')
    .where('status', '==', 'pending_verification')
    .orderBy('closedAt', 'desc')
    .get()
    .then(function(tournamentsSnap) {
      const container = document.getElementById('pendingTournamentsList');
      container.innerHTML = '';
      
      if (tournamentsSnap.empty) {
        container.innerHTML = '<div class="empty-state">Okenn tounwa an atant</div>';
        return;
      }
      
      var promises = [];
      tournamentsSnap.forEach(function(doc) {
        promises.push(createPendingTournamentCard(doc.id, doc.data()));
      });
      
      Promise.all(promises).then(function(cards) {
        cards.forEach(function(card) {
          container.appendChild(card);
        });
      });
    })
    .catch(function(error) {
      console.error('Erreur chargement tournois:', error);
    });
}

// ===== CRÉER CARTE TOURNOI EN ATTENTE =====
function createPendingTournamentCard(tournamentId, tournament) {
  return new Promise(function(resolve) {
    const div = document.createElement('div');
    div.className = 'pending-tournament-card';
    
    window.firebaseApp.db.collection('tournaments')
      .doc(tournamentId)
      .collection('participants')
      .orderBy('bestScore', 'desc')
      .limit(3)
      .get()
      .then(function(scoresSnap) {
        const participants = [];
        scoresSnap.forEach(function(doc) {
          participants.push({ uid: doc.id, data: doc.data() });
        });
        
        if (participants.length === 0) {
          div.innerHTML =
            '<div class="tournament-header">' +
              '<h3>' + tournament.name + '</h3>' +
              '<span class="tournament-status status-empty">Okenn patisipan</span>' +
            '</div>' +
            '<div class="tournament-actions">' +
              '<button onclick="cancelTournament(\'' + tournamentId + '\')" class="btn-cancel">❌ Anile</button>' +
            '</div>';
          resolve(div);
          return;
        }
        
        if (participants.length === 1) {
          const prize = Math.floor(tournament.totalPot * window.firebaseApp.CONFIG.PRIZE_PERCENTAGE);
          
          div.innerHTML =
            '<div class="tournament-header">' +
              '<h3>' + tournament.name + '</h3>' +
              '<span class="tournament-status status-single">1 jwè sèlman</span>' +
            '</div>' +
            '<div class="tournament-info">' +
              '<div>💰 Prize: ' + window.firebaseApp.utils.formatGDS(prize) + '</div>' +
              '<div>🎮 ' + participants[0].data.totalGamesPlayed + ' pati jwe</div>' +
            '</div>' +
            '<div class="winner-info">' +
              '<div class="winner-badge">🏆 Genyen Otomatik</div>' +
              '<div>Skor: ' + participants[0].data.bestScore + ' pts</div>' +
            '</div>' +
            '<div class="tournament-actions">' +
              '<button onclick="paySinglePlayer(\'' + tournamentId + '\', \'' + participants[0].uid + '\', ' + prize + ')" class="btn-pay">' +
                '✅ Peye ' + window.firebaseApp.utils.formatGDS(prize) +
              '</button>' +
            '</div>';
          resolve(div);
          return;
        }
        
        const winner = participants[0];
        const ratio = window.firebaseApp.utils.calculateRatio(winner.data.bestScore, winner.data.bestGameDuration || 1000);
        const ratioStatus = window.firebaseApp.utils.getRatioStatus(ratio);
        
        const topScore = winner.data.bestScore;
        var tiedPlayers = [];
        participants.forEach(function(p) {
          if (p.data.bestScore === topScore) {
            tiedPlayers.push(p);
          }
        });
        const hasTie = tiedPlayers.length > 1;
        
        const prize = Math.floor(tournament.totalPot * window.firebaseApp.CONFIG.PRIZE_PERCENTAGE);
        const commission = tournament.totalPot - prize;
        
        var leaderboardHTML = '';
        participants.forEach(function(p, idx) {
          const pRatio = window.firebaseApp.utils.calculateRatio(p.data.bestScore, p.data.bestGameDuration || 1000);
          const pStatus = window.firebaseApp.utils.getRatioStatus(pRatio);
          const medals = ['🥇', '🥈', '🥉'];
          
          leaderboardHTML +=
            '<div class="leaderboard-row ' + (p.uid === winner.uid ? 'winner' : '') + '">' +
              '<span class="rank">' + (medals[idx] || '#' + (idx + 1)) + '</span>' +
              '<span class="score">' + p.data.bestScore + ' pts</span>' +
              '<span class="ratio ' + pStatus.status + '">' +
                pStatus.icon + ' ' + pRatio + ' p/s' +
              '</span>' +
              '<span class="duration">' + window.firebaseApp.utils.formatDuration(p.data.bestGameDuration || 0) + '</span>' +
            '</div>';
        });
        
        var actionsHTML = '';
        if (!hasTie) {
          actionsHTML =
            '<div class="verification-panel">' +
              '<div class="ratio-check">' +
                '<strong>Verifikasyon Rasyon:</strong>' +
                '<span class="ratio-badge ' + ratioStatus.status.toUpperCase() + '">' +
                  ratioStatus.icon + ' ' + ratioStatus.status.toUpperCase() +
                '</span>' +
                (ratioStatus.status === 'cheat' ? '<div class="warning">⚠️ Triche pwobab! Verifye manyèlman</div>' : '') +
              '</div>' +
            '</div>' +
            '<div class="tournament-actions">' +
              (ratioStatus.status !== 'cheat' 
                ? '<button onclick="payWinnerFunc(\'' + tournamentId + '\', \'' + winner.uid + '\', ' + prize + ')" class="btn-pay">' +
                    '✅ Peye Genyan (' + window.firebaseApp.utils.formatGDS(prize) + ')' +
                  '</button>'
                : '') +
              '<button onclick="disqualifyAndPayNext(\'' + tournamentId + '\')" class="btn-disqualify">' +
                '❌ Diskwalifye #1, Peye #2' +
              '</button>' +
              '<button onclick="viewTournamentDetails(\'' + tournamentId + '\')" class="btn-details">' +
                '👁️ Detay' +
              '</button>' +
            '</div>';
        } else {
          var tiedUids = tiedPlayers.map(function(p) { return p.uid; });
          actionsHTML =
            '<div class="tie-panel">' +
              '<div class="tie-info">' +
                '⚔️ <strong>' + tiedPlayers.length + ' jwè nan egalite</strong> avèk ' + topScore + ' pts' +
              '</div>' +
              '<div class="tournament-actions">' +
                '<button onclick="openTiebreakerCreator(\'' + tournamentId + '\', ' + JSON.stringify(tiedUids) + ')" class="btn-create-tiebreaker">' +
                  '🎮 Kreye Tounwa Depataj' +
                '</button>' +
              '</div>' +
            '</div>';
        }
        
        div.innerHTML =
          '<div class="tournament-header">' +
            '<h3>' + tournament.name + '</h3>' +
            '<span class="tournament-status ' + (hasTie ? 'status-tie' : 'status-normal') + '">' +
              (hasTie ? '⚔️ Egalite' : '✅ Prè pou peye') +
            '</span>' +
          '</div>' +
          '<div class="tournament-info">' +
            '<div>💰 Prize: ' + window.firebaseApp.utils.formatGDS(prize) + '</div>' +
            '<div>📊 Komisyon: ' + window.firebaseApp.utils.formatGDS(commission) + '</div>' +
            '<div>👥 ' + tournament.participantCount + ' patisipan</div>' +
          '</div>' +
          '<div class="leaderboard-mini">' +
            leaderboardHTML +
          '</div>' +
          actionsHTML;
        
        resolve(div);
      });
  });
}

// ===== PAYER JOUEUR UNIQUE =====
function paySinglePlayer(tournamentId, playerId, prize) {
  if (!confirm('Peye ' + window.firebaseApp.utils.formatGDS(prize) + ' a jwè sa?')) return;
  payWinnerFunc(tournamentId, playerId, prize);
}

// ===== PAYER GAGNANT =====
function payWinnerFunc(tournamentId, winnerId, prize) {
  window.firebaseApp.db.collection('users').doc(winnerId).update({
    balance: firebase.firestore.FieldValue.increment(prize)
  })
  .then(function() {
    return window.firebaseApp.db.collection('transactions').add({
      userId: winnerId,
      type: 'tournament_win',
      amount: prize,
      tournamentId: tournamentId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  })
  .then(function() {
    return window.firebaseApp.db.collection('tournaments').doc(tournamentId).update({
      status: 'completed',
      winnerId: winnerId,
      prizePaid: prize,
      paidAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  })
  .then(function() {
    return window.firebaseApp.db.collection('users').doc(winnerId).update({
      totalWins: firebase.firestore.FieldValue.increment(1),
      totalEarned: firebase.firestore.FieldValue.increment(prize)
    });
  })
  .then(function() {
    alert('✅ ' + window.firebaseApp.utils.formatGDS(prize) + ' peye!');
    loadPendingTournaments();
  })
  .catch(function(error) {
    console.error('Erreur paiement:', error);
    alert('❌ Erè peman!');
  });
}

// ===== DISQUALIFIER ET PAYER SUIVANT =====
function disqualifyAndPayNext(tournamentId) {
  if (!confirm('Diskwalifye #1 epi peye #2?')) return;
  
  window.firebaseApp.db.collection('tournaments')
    .doc(tournamentId)
    .collection('participants')
    .orderBy('bestScore', 'desc')
    .limit(2)
    .get()
    .then(function(scoresSnap) {
      if (scoresSnap.size < 2) {
        alert('❌ Pa gen jwè #2!');
        return Promise.reject('Pas de joueur #2');
      }
      
      var docs = [];
      scoresSnap.forEach(function(doc) {
        docs.push(doc);
      });
      
      const cheater = docs[0];
      const winner = docs[1];
      
      return window.firebaseApp.db.collection('tournaments').doc(tournamentId).get()
        .then(function(tournamentDoc) {
          const prize = Math.floor(tournamentDoc.data().totalPot * window.firebaseApp.CONFIG.PRIZE_PERCENTAGE);
          
          // CORRECTION: Vérifier si currentAdmin existe
          var adminUid = 'system';
          if (window.adminAuth && window.adminAuth.currentAdmin) {
            adminUid = window.adminAuth.currentAdmin.uid;
          } else if (window.firebaseApp.auth.currentUser) {
            adminUid = window.firebaseApp.auth.currentUser.uid;
          }
          
          return window.firebaseApp.db.collection('tournaments')
            .doc(tournamentId)
            .collection('participants')
            .doc(cheater.id)
            .update({
              disqualified: true,
              disqualifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
              disqualifiedBy: adminUid
            })
            .then(function() {
              return payWinnerFunc(tournamentId, winner.id, prize);
            });
        });
    })
    .then(function() {
      alert('✅ #1 diskwalifye, #2 peye!');
      loadPendingTournaments();
    })
    .catch(function(error) {
      if (error !== 'Pas de joueur #2') {
        console.error('Erreur disqualification:', error);
        alert('❌ Erè!');
      }
    });
}

// ===== OUVRIR CRÉATEUR DÉPARTAGE =====
function openTiebreakerCreator(tournamentId, playerUids) {
  const modal = document.getElementById('tiebreakerCreatorModal');
  const form = document.getElementById('tiebreakerForm');
  
  window.firebaseApp.db.collection('tournaments').doc(tournamentId).get()
    .then(function(tournamentDoc) {
      const tournament = tournamentDoc.data();
      
      document.getElementById('tiebreakerOriginalTournament').textContent = tournament.name;
      document.getElementById('tiebreakerPlayerCount').textContent = playerUids.length;
      document.getElementById('tiebreakerPrize').value = Math.floor(tournament.totalPot * window.firebaseApp.CONFIG.PRIZE_PERCENTAGE);
      document.getElementById('tiebreakerDuration').value = 30;
      
      form.dataset.tournamentId = tournamentId;
      form.dataset.playerUids = JSON.stringify(playerUids);
      
      modal.classList.add('active');
    });
}

// ===== CRÉER TOURNOI DÉPARTAGE =====
function createTiebreakerTournament() {
  const form = document.getElementById('tiebreakerForm');
  const originalTournamentId = form.dataset.tournamentId;
  const playerUids = JSON.parse(form.dataset.playerUids);
  const prize = parseInt(document.getElementById('tiebreakerPrize').value);
  const duration = parseInt(document.getElementById('tiebreakerDuration').value);
  
  if (!prize || !duration) {
    alert('❌ Ranpli tout chan yo!');
    return;
  }
  
  const now = new Date();
  const endTime = new Date(now.getTime() + duration * 60000);
  
  const tiebreakerKey = 'tiebreaker-' + originalTournamentId + '-' + Date.now();
  
  // CORRECTION: Vérifier si currentAdmin existe
  var adminUid = 'system';
  if (window.adminAuth && window.adminAuth.currentAdmin) {
    adminUid = window.adminAuth.currentAdmin.uid;
  } else if (window.firebaseApp.auth.currentUser) {
    adminUid = window.firebaseApp.auth.currentUser.uid;
  }
  
  window.firebaseApp.db.collection('tournaments').doc(tiebreakerKey).set({
    type: 'tiebreaker',
    name: 'Depataj - ' + originalTournamentId,
    originalTournamentId: originalTournamentId,
    startTime: firebase.firestore.Timestamp.fromDate(now),
    endTime: firebase.firestore.Timestamp.fromDate(endTime),
    status: 'active',
    entryFee: 0,
    totalPot: prize,
    prize: prize,
    participantCount: 0,
    eligiblePlayers: playerUids,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: adminUid
  })
  .then(function() {
    var notificationPromises = playerUids.map(function(uid) {
      return window.firebaseApp.db.collection('notifications').add({
        userId: uid,
        type: 'tiebreaker',
        tournamentId: tiebreakerKey,
        tournamentName: 'Depataj - ' + originalTournamentId,
        prize: prize,
        message: 'Ou te nan egalite! Ou gen ' + duration + ' minit pou rejwe epi genyen ' + window.firebaseApp.utils.formatGDS(prize) + '!',
        read: false,
        shown: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromDate(endTime)
      });
    });
    
    return Promise.all(notificationPromises);
  })
  .then(function() {
    return window.firebaseApp.db.collection('tournaments').doc(originalTournamentId).update({
      status: 'tiebreaker_created',
      tiebreakerTournamentId: tiebreakerKey
    });
  })
  .then(function() {
    alert('✅ Tounwa depataj kreye! ' + playerUids.length + ' jwè notifye.');
    document.getElementById('tiebreakerCreatorModal').classList.remove('active');
    loadPendingTournaments();
  })
  .catch(function(error) {
    console.error('Erreur création départage:', error);
    alert('❌ Erè kreyasyon tounwa!');
  });
}

// ===== ANNULER TOURNOI =====
function cancelTournament(tournamentId) {
  if (!confirm('Anile tounwa sa? Tout lajan ap ranvwaye.')) return;
  
  var tournament;
  
  window.firebaseApp.db.collection('tournaments').doc(tournamentId).get()
    .then(function(tournamentDoc) {
      tournament = tournamentDoc.data();
      
      return window.firebaseApp.db.collection('tournaments')
        .doc(tournamentId)
        .collection('participants')
        .get();
    })
    .then(function(participantsSnap) {
      var refundPromises = [];
      
      participantsSnap.forEach(function(doc) {
        const participant = doc.data();
        
        refundPromises.push(
          window.firebaseApp.db.collection('users').doc(doc.id).update({
            balance: firebase.firestore.FieldValue.increment(participant.totalPaid)
          })
          .then(function() {
            return window.firebaseApp.db.collection('transactions').add({
              userId: doc.id,
              type: 'tournament_refund',
              amount: participant.totalPaid,
              tournamentId: tournamentId,
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
          })
        );
      });
      
      return Promise.all(refundPromises);
    })
    .then(function() {
      // CORRECTION: Vérifier si currentAdmin existe
      var adminUid = 'system';
      if (window.adminAuth && window.adminAuth.currentAdmin) {
        adminUid = window.adminAuth.currentAdmin.uid;
      } else if (window.firebaseApp.auth.currentUser) {
        adminUid = window.firebaseApp.auth.currentUser.uid;
      }
      
      return window.firebaseApp.db.collection('tournaments').doc(tournamentId).update({
        status: 'cancelled',
        cancelledBy: adminUid,
        cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(function() {
      alert('✅ Tounwa anile, lajan ranvwaye!');
      loadPendingTournaments();
    })
    .catch(function(error) {
      console.error('Erreur annulation:', error);
      alert('❌ Erè anilasyon!');
    });
}

// ===== VOIR DÉTAILS TOURNOI =====
function viewTournamentDetails(tournamentId) {
  const modal = document.getElementById('tournamentDetailsModal');
  const content = document.getElementById('tournamentDetailsContent');
  
  var tournament;
  
  window.firebaseApp.db.collection('tournaments').doc(tournamentId).get()
    .then(function(tournamentDoc) {
      tournament = tournamentDoc.data();
      
      return window.firebaseApp.db.collection('tournaments')
        .doc(tournamentId)
        .collection('participants')
        .orderBy('bestScore', 'desc')
        .get();
    })
    .then(function(participantsSnap) {
      return window.firebaseApp.db.collection('tournaments')
        .doc(tournamentId)
        .collection('scores')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get()
        .then(function(scoresSnap) {
          return { participantsSnap: participantsSnap, scoresSnap: scoresSnap };
        });
    })
    .then(function(result) {
      var html = '<h2>' + tournament.name + '</h2>';
      
      html += '<div class="tournament-details-info">';
      html += '<div class="detail-item"><span class="detail-label">💰 Cagnotte Total:</span><span class="detail-value">' + window.firebaseApp.utils.formatGDS(tournament.totalPot) + '</span></div>';
      html += '<div class="detail-item"><span class="detail-label">🏆 Prize (80%):</span><span class="detail-value">' + window.firebaseApp.utils.formatGDS(Math.floor(tournament.totalPot * 0.8)) + '</span></div>';
      html += '<div class="detail-item"><span class="detail-label">📊 Komisyon (20%):</span><span class="detail-value">' + window.firebaseApp.utils.formatGDS(Math.floor(tournament.totalPot * 0.2)) + '</span></div>';
      html += '<div class="detail-item"><span class="detail-label">👥 Patisipan:</span><span class="detail-value">' + tournament.participantCount + '</span></div>';
      html += '</div>';
      
      html += '<h3>📊 Klasman Konplè</h3>';
      html += '<div class="full-leaderboard">';
      
      var idx = 0;
      result.participantsSnap.forEach(function(doc) {
        const p = doc.data();
        const ratio = window.firebaseApp.utils.calculateRatio(p.bestScore, p.bestGameDuration || 1000);
        const status = window.firebaseApp.utils.getRatioStatus(ratio);
        
        html += '<div class="leaderboard-row-detailed">';
        html += '<span class="rank">#' + (idx + 1) + '</span>';
        html += '<span class="player-id">' + doc.id.substring(0, 8) + '...</span>';
        html += '<span class="score">' + p.bestScore + ' pts</span>';
        html += '<span class="games">' + p.totalGamesPlayed + ' pati</span>';
        html += '<span class="ratio ' + status.status + '">' + status.icon + ' ' + ratio + ' p/s</span>';
        html += '<span class="paid">' + window.firebaseApp.utils.formatGDS(p.totalPaid) + ' peye</span>';
        html += '</div>';
        idx++;
      });
      
      html += '</div>';
      
      html += '<h3>🎮 Dènye Pati Jwe</h3>';
      html += '<div class="recent-games">';
      
      result.scoresSnap.forEach(function(doc) {
        const s = doc.data();
        const status = window.firebaseApp.utils.getRatioStatus(s.ratio);
        
        var timestampText = 'N/A';
        if (s.timestamp) {
          timestampText = s.timestamp.toDate().toLocaleString('fr-FR');
        }
        
        html += '<div class="game-row">';
        html += '<span class="player-id">' + s.userId.substring(0, 8) + '...</span>';
        html += '<span class="score">' + s.score + ' pts</span>';
        html += '<span class="duration">' + window.firebaseApp.utils.formatDuration(s.duration) + '</span>';
        html += '<span class="ratio ' + status.status + '">' + status.icon + ' ' + s.ratio + ' p/s</span>';
        html += '<span class="timestamp">' + timestampText + '</span>';
        html += '</div>';
      });
      
      html += '</div>';
      
      content.innerHTML = html;
      modal.classList.add('active');
    })
    .catch(function(error) {
      console.error('Erreur chargement détails:', error);
      alert('❌ Erè chajman detay!');
    });
}

// ===== CHARGER STATISTIQUES =====
function loadStatistics() {
  const period = document.getElementById('statsPeriod').value;
  
  var startDate = new Date();
  
  switch(period) {
    case 'day':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;
  }
  
  window.firebaseApp.db.collection('transactions')
    .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startDate))
    .get()
    .then(function(transactionsSnap) {
      var stats = {
        totalGames: 0,
        totalDeposits: 0,
        depositCount: 0,
        totalWithdrawals: 0,
        withdrawalCount: 0,
        totalSubscriptions: 0,
        subscriptionCount: 0,
        totalPot: 0,
        totalCommission: 0,
        uniquePlayers: {}
      };
      
      transactionsSnap.forEach(function(doc) {
        const t = doc.data();
        
        stats.uniquePlayers[t.userId] = true;
        
        switch(t.type) {
          case 'tournament_entry':
            stats.totalGames++;
            stats.totalPot += Math.abs(t.amount);
            break;
          case 'deposit':
            stats.totalDeposits += t.amount;
            stats.depositCount++;
            break;
          case 'withdrawal':
            stats.totalWithdrawals += Math.abs(t.amount);
            stats.withdrawalCount++;
            break;
          case 'subscription':
            stats.totalSubscriptions += Math.abs(t.amount);
            stats.subscriptionCount++;
            break;
        }
      });
      
      stats.totalCommission = Math.floor(stats.totalPot * window.firebaseApp.CONFIG.COMMISSION_PERCENTAGE);
      
      document.getElementById('statTotalPot').textContent = window.firebaseApp.utils.formatGDS(stats.totalPot);
      document.getElementById('statTotalGames').textContent = stats.totalGames;
      document.getElementById('statUniquePlayers').textContent = Object.keys(stats.uniquePlayers).length;
      document.getElementById('statDeposits').textContent = window.firebaseApp.utils.formatGDS(stats.totalDeposits) + ' (' + stats.depositCount + ')';
      document.getElementById('statWithdrawals').textContent = window.firebaseApp.utils.formatGDS(stats.totalWithdrawals) + ' (' + stats.withdrawalCount + ')';
      document.getElementById('statSubscriptions').textContent = window.firebaseApp.utils.formatGDS(stats.totalSubscriptions) + ' (' + stats.subscriptionCount + ')';
      document.getElementById('statCommission').textContent = window.firebaseApp.utils.formatGDS(stats.totalCommission);
    })
    .catch(function(error) {
      console.error('Erreur chargement stats:', error);
    });
}

// ===== CHARGER HISTORIQUE TRANSACTIONS =====
function loadTransactionsHistory() {
  const type = document.getElementById('transactionType').value;
  const period = document.getElementById('transactionPeriod').value;
  
  var startDate = new Date();
  
  switch(period) {
    case 'day':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
  }
  
  var query = window.firebaseApp.db.collection('transactions')
    .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startDate))
    .orderBy('timestamp', 'desc')
    .limit(100);
  
  if (type !== 'all') {
    query = query.where('type', '==', type);
  }
  
  query.get()
    .then(function(transactionsSnap) {
      const container = document.getElementById('transactionsHistoryList');
      container.innerHTML = '';
      
      if (transactionsSnap.empty) {
        container.innerHTML = '<div class="empty-state">Okenn transaksyon</div>';
        return;
      }
      
      transactionsSnap.forEach(function(doc) {
        const t = doc.data();
        const item = createTransactionItem(t);
        container.appendChild(item);
      });
    })
    .catch(function(error) {
      console.error('Erreur chargement transactions:', error);
    });
}

// ===== CRÉER ITEM TRANSACTION =====
function createTransactionItem(transaction) {
  const div = document.createElement('div');
  div.className = 'transaction-item';
  
  const typeIcons = {
    'deposit': '💰',
    'withdrawal': '💳',
    'tournament_entry': '🎮',
    'tournament_win': '🏆',
    'tournament_refund': '↩️',
    'subscription': '📱'
  };
  
  const typeLabels = {
    'deposit': 'Depo',
    'withdrawal': 'Retrè',
    'tournament_entry': 'Pati',
    'tournament_win': 'Genyen',
    'tournament_refund': 'Ranbousman',
    'subscription': 'Abònman'
  };
  
  const isPositive = transaction.amount > 0;
  
  var timestampText = 'N/A';
  if (transaction.timestamp) {
    timestampText = transaction.timestamp.toDate().toLocaleString('fr-FR');
  }
  
  div.innerHTML =
    '<div class="transaction-time">' + timestampText + '</div>' +
    '<div class="transaction-type">' + (typeIcons[transaction.type] || '❓') + ' ' + (typeLabels[transaction.type] || transaction.type) + '</div>' +
    '<div class="transaction-user">' + transaction.userId.substring(0, 12) + '...</div>' +
    '<div class="transaction-amount ' + (isPositive ? 'positive' : 'negative') + '">' +
      (isPositive ? '+' : '') + window.firebaseApp.utils.formatGDS(transaction.amount) +
    '</div>';
  
  return div;
}

// ===== EXPORTER CSV =====
function exportTransactionsCSV() {
  window.firebaseApp.db.collection('transactions')
    .orderBy('timestamp', 'desc')
    .limit(1000)
    .get()
    .then(function(transactionsSnap) {
      var csv = 'Date,Heure,Type,User,Montant,TournamentID\n';
      
      transactionsSnap.forEach(function(doc) {
        const t = doc.data();
        var date = new Date();
        if (t.timestamp) {
          date = t.timestamp.toDate();
        }
        
        csv += date.toLocaleDateString('fr-FR') + ',';
        csv += date.toLocaleTimeString('fr-FR') + ',';
        csv += t.type + ',';
        csv += t.userId + ',';
        csv += t.amount + ',';
        csv += (t.tournamentId || '') + '\n';
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    })
    .catch(function(error) {
      console.error('Erreur export CSV:', error);
      alert('❌ Erè ekspòtasyon!');
    });
}

// ===== CRÉATEURS DE TOURNOIS =====
function loadTournamentCreators() {
  // Créateur Hourly - TOUJOURS AFFICHER
  document.getElementById('hourlyTournamentCreator').innerHTML = `
    <h3>⏰ Kreye Tounwa Orè</h3>
    <div class="creator-form">
      <div class="form-group">
        <label>Dat:</label>
        <input type="date" id="hourlyDate" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Lè (0-23):</label>
        <input type="number" id="hourlyHour" min="0" max="23" value="${new Date().getHours()}">
      </div>
      <div class="form-group">
        <label>Frè Antre:</label>
        <input type="number" id="hourlyFee" value="25" min="1">
      </div>
      <button onclick="createHourlyTournament()" class="btn-create">➕ Kreye Tounwa Orè</button>
    </div>
  `;
  
  // Créateur Daily - TOUJOURS AFFICHER
  document.getElementById('dailyTournamentCreator').innerHTML = `
    <h3>🌟 Kreye Jackpot Jounalyè</h3>
    <div class="creator-form">
      <div class="form-group">
        <label>Dat:</label>
        <input type="date" id="dailyDate" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Lè Fen (0-23):</label>
        <input type="number" id="dailyEndHour" value="22" min="0" max="23">
      </div>
      <div class="form-group">
        <label>Frè Antre:</label>
        <input type="number" id="dailyFee" value="5" min="1">
      </div>
      <button onclick="createDailyTournament()" class="btn-create">➕ Kreye Jackpot Jounalyè</button>
    </div>
  `;
}
// ===== CRÉER TOURNOI HORAIRE MANUELLEMENT =====
function createHourlyTournament() {
  const dateStr = document.getElementById('hourlyDate').value;
  const hour = parseInt(document.getElementById('hourlyHour').value);
  const fee = parseInt(document.getElementById('hourlyFee').value);
  
  if (!dateStr || isNaN(hour) || isNaN(fee)) {
    alert('❌ Ranpli tout chan yo!');
    return;
  }
  
  if (hour < 0 || hour > 23) {
    alert('❌ Lè dwe ant 0 ak 23!');
    return;
  }
  
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 3600000);
  
  // ✅ INCLURE LE JEU DANS LA CLÉ
  const tournamentKey = selectedGame + '-hourly-' + 
    new Date().toISOString().split('T')[0] + '-' + hour + 'h';
  
  var adminUid = 'system';
  if (window.adminAuth && window.adminAuth.currentAdmin) {
    adminUid = window.adminAuth.currentAdmin.uid;
  } else if (window.firebaseApp.auth.currentUser) {
    adminUid = window.firebaseApp.auth.currentUser.uid;
  }
  
  console.log('🎮 Jeu:', selectedGame);
  console.log('🔑 Clé tournoi:', tournamentKey);
  
  window.firebaseApp.db.collection('tournaments').doc(tournamentKey).get()
    .then(function(existingDoc) {
      if (existingDoc.exists) {
        alert('❌ Tounwa sa egziste deja!');
        throw new Error('Tournoi existe déjà');
      }
      
      return window.firebaseApp.db.collection('tournaments').doc(tournamentKey).set({
        game: selectedGame,  // ✅ AJOUTER LE JEU
        type: 'hourly',
        name: ' Tournoi '+ selectedGame + hour + 'h-' + (hour + 1) + 'h',
        startTime: firebase.firestore.Timestamp.fromDate(startTime),
        endTime: firebase.firestore.Timestamp.fromDate(endTime),
        status: 'active',
        entryFee: fee,
        totalPot: 0,
        prize: 0,
        participantCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: adminUid,
        createdManually: true
      });
    })
    .then(function() {
      alert('✅ Tounwa ' + hour + 'h-' + (hour + 1) + 'h kreye!');
      loadDashboardData();
    })
    .catch(function(error) {
      if (error.message !== 'Tournoi existe déjà') {
        console.error('❌ Erreur:', error);
        alert('❌ Erè kreyasyon: ' + error.message);
      }
    });
}

// ===== CRÉER JACKPOT JOURNALIER MANUELLEMENT =====
function createDailyTournament() {
  console.log('🔵 createDailyTournament() appelée');
  
  const dateStr = document.getElementById('dailyDate').value;
  const endHour = parseInt(document.getElementById('dailyEndHour').value);
  const fee = parseInt(document.getElementById('dailyFee').value);
  
  console.log('📅 Date:', dateStr, 'Heure fin:', endHour, 'Frais:', fee);
  
  if (!dateStr || isNaN(endHour) || isNaN(fee)) {
    alert('❌ Ranpli tout chan yo!');
    return;
  }
  
  if (endHour < 0 || endHour > 23) {
    alert('❌ Lè dwe ant 0 ak 23!');
    return;
  }
  
  const startTime = new Date();
  
  const endTime = new Date();
  endTime.setHours(endHour, 0, 0, 0);
  
  if (endTime < startTime) {
    endTime.setDate(endTime.getDate() + 1);
  }
  
  // ✅ INCLURE LE JEU DANS LA CLÉ
  const today = new Date().toISOString().split('T')[0];
  const tournamentKey = selectedGame + '-daily-' + today;
  
  console.log('🎮 Jeu:', selectedGame);
  console.log('🔑 Clé jackpot:', tournamentKey);
  console.log('⏰ Début:', startTime);
  console.log('⏰ Fin:', endTime);
  
  var adminUid = 'system';
  if (window.adminAuth && window.adminAuth.currentAdmin) {
    adminUid = window.adminAuth.currentAdmin.uid;
  } else if (window.firebaseApp.auth.currentUser) {
    adminUid = window.firebaseApp.auth.currentUser.uid;
  }
  
  console.log('👤 Admin UID:', adminUid);
  
  window.firebaseApp.db.collection('tournaments').doc(tournamentKey).get()
    .then(function(existingDoc) {
      console.log('✅ Vérification existence:', existingDoc.exists);
      
      if (existingDoc.exists) {
        const existingData = existingDoc.data();
        console.log('⚠️ Doc existant trouvé');
        console.log('   Status:', existingData.status);
        console.log('   CreatedAt:', existingData.createdAt);
        
        // Si le doc existe mais est complété/fermé, on peut en créer un nouveau
        if (existingData.status === 'completed' || existingData.status === 'cancelled') {
          console.log('✅ Ancien jackpot terminé, création d\'un nouveau');
          // Continue la création
        } else if (existingData.status === 'active') {
          alert('❌ Jackpot aktif egziste deja! Status: ' + existingData.status);
          throw new Error('Jackpot actif existe déjà');
        } else {
          alert('❌ Jackpot sa egziste deja! Status: ' + existingData.status);
          throw new Error('Jackpot existe déjà');
        }
      }
      
      console.log('🚀 Création du jackpot...');
      
      return window.firebaseApp.db.collection('tournaments').doc(tournamentKey).set({
        game: selectedGame,  // ✅ AJOUTER LE JEU
        type: 'daily',
        name: ' Jackpot ' + selectedGame + new Date().toLocaleDateString('fr-FR'),
        startTime: firebase.firestore.Timestamp.fromDate(startTime),
        endTime: firebase.firestore.Timestamp.fromDate(endTime),
        status: 'active',
        entryFee: fee,
        totalPot: 0,
        prize: 0,
        participantCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: adminUid,
        createdManually: true
      });
    })
    .then(function() {
      console.log('✅✅✅ Jackpot créé avec succès!');
      alert('✅ Jackpot ' + new Date().toLocaleDateString('fr-FR') + ' kreye pou ' + GAMES_CONFIG[selectedGame].name + '!');
      loadPendingTournaments();
      loadActiveTournaments();
    })
    .catch(function(error) {
      if (error.message !== 'Jackpot existe déjà') {
        console.error('❌ Erreur complète:', error);
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        alert('❌ Erè kreyasyon: ' + error.message);
      }
    });
}

// ===== FERMER MODAL =====
function closeAdminModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// ===== CHARGER TOURNOIS ACTIFS =====
function loadActiveTournaments() {
  window.firebaseApp.db.collection('tournaments')
    .where('status', '==', 'active')
    .orderBy('endTime', 'asc')
    .get()
    .then(function(tournamentsSnap) {
      const container = document.getElementById('activeTournamentsList');
      container.innerHTML = '';
      
      if (tournamentsSnap.empty) {
        container.innerHTML = '<div class="empty-state">Okenn tounwa aktif</div>';
        return;
      }
      
      tournamentsSnap.forEach(function(doc) {
        const card = createActiveTournamentCard(doc.id, doc.data());
        container.appendChild(card);
      });
    })
    .catch(function(error) {
      console.error('Erreur chargement tournois actifs:', error);
      document.getElementById('activeTournamentsList').innerHTML = 
        '<div class="empty-state">❌ Erè chajman</div>';
    });
}

// ===== CRÉER CARTE TOURNOI ACTIF =====
function createActiveTournamentCard(tournamentId, tournament) {
  const div = document.createElement('div');
  
  const now = new Date();
  const endTime = new Date(tournament.endTime.seconds * 1000);  // ✅ CORRECT
const diff = endTime - now;
  
  // Calculer le temps restant
  let timerText = '';
  let timerClass = 'safe';
  let cardClass = '';
  
  if (diff <= 0) {
    timerText = '⏰ TEMPS ÉCOULÉ';
    timerClass = 'danger';
    cardClass = 'danger';
  } else if (diff < 600000) { // Moins de 10 minutes
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    timerText = `${minutes}:${seconds.toString().padStart(2, '0')} restant`;
    timerClass = 'danger';
    cardClass = 'danger';
  } else if (diff < 1800000) { // Moins de 30 minutes
    const minutes = Math.floor(diff / 60000);
    timerText = `${minutes} min restant`;
    timerClass = 'warning';
    cardClass = 'warning';
  } else {
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    timerText = `${hours}h ${minutes}min restant`;
    timerClass = 'safe';
  }
  
  div.className = 'active-tournament-card ' + cardClass;
  
  div.innerHTML = `
    <div class="active-tournament-header">
      <h3>${tournament.name}</h3>
      <span class="timer-badge ${timerClass}">${timerText}</span>
    </div>
    
    <div class="active-tournament-stats">
      <div class="stat-item">
        <span class="stat-label">💰 Cagnotte</span>
        <span class="stat-value">${window.firebaseApp.utils.formatGDS(tournament.totalPot)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">👥 Participants</span>
        <span class="stat-value">${tournament.participantCount || 0}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">🎮 Frais</span>
        <span class="stat-value">${tournament.entryFee} GDS</span>
      </div>
    </div>
    
    <div class="active-tournament-actions">
      <button 
        onclick="window.adminDashboard.closeTournamentManually('${tournamentId}')" 
        class="btn-close-tournament"
      >
        🔒 Fermer Maintenant
      </button>
      <button 
        onclick="window.adminDashboard.viewActiveParticipants('${tournamentId}')" 
        class="btn-view-participants"
      >
        👁️ Voir
      </button>
    </div>
  `;
  
  // Mettre à jour le timer en temps réel
  if (diff > 0) {
    const timerId = setInterval(function() {
      const newDiff = tournament.endTime.toDate() - new Date();
      if (newDiff <= 0) {
        clearInterval(timerId);
        loadActiveTournaments(); // Recharger pour mettre à jour l'affichage
      }
    }, 30000); // Actualiser toutes les 30 secondes
  }
  
  return div;
}

// ===== FERMER TOURNOI MANUELLEMENT =====
function closeTournamentManually(tournamentId) {
  if (!confirm('⚠️ Fermer ce tournoi maintenant?\n\nAucun nouveau joueur ne pourra rejoindre.\nLes parties en cours ne seront plus comptabilisées.')) {
    return;
  }
  
  // Récupérer l'UID de l'admin
  var adminUid = 'system';
  if (window.adminAuth && window.adminAuth.currentAdmin) {
    adminUid = window.adminAuth.currentAdmin.uid;
  } else if (window.firebaseApp.auth.currentUser) {
    adminUid = window.firebaseApp.auth.currentUser.uid;
  }
  
  // Fermer le tournoi
  window.firebaseApp.db.collection('tournaments').doc(tournamentId).update({
    status: 'pending_verification',
    closedAt: firebase.firestore.FieldValue.serverTimestamp(),
    closedBy: adminUid,
    closedManually: true
  })
  .then(function() {
    alert('✅ Tournoi fermé!\n\nIl apparaît maintenant dans "En Attente de Vérification".');
    
    // Recharger les deux listes
    loadActiveTournaments();
    loadPendingTournaments();
  })
  .catch(function(error) {
    console.error('Erreur fermeture tournoi:', error);
    alert('❌ Erreur lors de la fermeture:\n' + error.message);
  });
}

// ===== VOIR PARTICIPANTS EN TEMPS RÉEL =====
function viewActiveParticipants(tournamentId) {
  window.firebaseApp.db.collection('tournaments').doc(tournamentId).get()
    .then(function(tournamentDoc) {
      const tournament = tournamentDoc.data();
      
      return window.firebaseApp.db.collection('tournaments')
        .doc(tournamentId)
        .collection('participants')
        .orderBy('bestScore', 'desc')
        .get()
        .then(function(participantsSnap) {
          return { tournament: tournament, participants: participantsSnap };
        });
    })
    .then(function(data) {
      showParticipantsModal(tournamentId, data.tournament, data.participants);
    })
    .catch(function(error) {
      console.error('Erreur chargement participants:', error);
      alert('❌ Erreur chargement participants');
    });
}

// ===== MODAL PARTICIPANTS =====
function showParticipantsModal(tournamentId, tournament, participantsSnap) {
  // Créer le modal s'il n'existe pas
  let modal = document.getElementById('participantsModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'participantsModal';
    modal.className = 'participants-modal';
    modal.innerHTML = `
      <div class="participants-modal-content">
        <div class="participants-modal-header">
          <h2 id="participantsModalTitle"></h2>
          <button onclick="window.adminDashboard.closeParticipantsModal()" class="btn-close-modal">×</button>
        </div>
        <div id="participantsModalBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Remplir le contenu
  document.getElementById('participantsModalTitle').textContent = 
    tournament.name + ' - ' + (participantsSnap.size || 0) + ' Participants';
  
  const body = document.getElementById('participantsModalBody');
  body.innerHTML = '';
  
  if (participantsSnap.empty) {
    body.innerHTML = '<div class="empty-state">Okenn patisipan ankò</div>';
  } else {
    participantsSnap.forEach(function(doc, index) {
      const p = doc.data();
      const ratio = window.firebaseApp.utils.calculateRatio(p.bestScore, p.bestGameDuration || 1000);
      const status = window.firebaseApp.utils.getRatioStatus(ratio);
      
      const row = document.createElement('div');
      row.className = 'participant-row';
      row.innerHTML = `
        <div class="participant-info">
          <div class="participant-id">#${index + 1} - ${doc.id.substring(0, 12)}...</div>
          <div class="participant-stats">
            <span>🏆 ${p.bestScore} pts</span>
            <span>🎮 ${p.totalGamesPlayed} parties</span>
            <span>💰 ${window.firebaseApp.utils.formatGDS(p.totalPaid)}</span>
            <span class="${status.status}">${status.icon} ${ratio} p/s</span>
          </div>
        </div>
      `;
      body.appendChild(row);
    });
  }
  
  modal.classList.add('active');
}

function closeParticipantsModal() {
  const modal = document.getElementById('participantsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ===== SÉLECTIONNER UN JEU =====
function selectGame(gameId) {
  selectedGame = gameId;
  
  // Mettre à jour les boutons
  document.querySelectorAll('.game-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Mettre à jour le titre
  const gameConfig = GAMES_CONFIG[gameId];
  document.getElementById('currentGameTitle').textContent = 
    gameConfig.icon + ' ' + gameConfig.name;
  
  // Recharger les données du jeu sélectionné
  loadDashboardData();
  
  console.log('✅ Jeu sélectionné:', gameId);
}

// ===== CHARGER DÉPÔTS EN ATTENTE =====
function loadPendingDeposits() {
  window.firebaseApp.db.collection('pending_deposits')
    .where('status', '==', 'pending_payment')
    .orderBy('createdAt', 'desc')
    .get()
    .then(function(depositsSnap) {
      const container = document.getElementById('pendingDepositsList');
      container.innerHTML = '';
      
      if (depositsSnap.empty) {
        container.innerHTML = '<div class="empty-state">Aucun dépôt en attente</div>';
        return;
      }
      
      depositsSnap.forEach(function(doc) {
        const deposit = doc.data();
        const card = createPendingDepositCard(doc.id, deposit);
        container.appendChild(card);
      });
    })
    .catch(function(error) {
      console.error('Erreur chargement dépôts:', error);
    });
}

function createPendingDepositCard(depositId, deposit) {
  const div = document.createElement('div');
  div.className = 'pending-tournament-card';
  
  const fees = deposit.amount * 0.06;
  const creditAmount = deposit.amount - fees;
  
  div.innerHTML =
    '<div class="tournament-header">' +
      '<h3>💰 Dépôt ' + deposit.amount + ' ' + deposit.currency + '</h3>' +
      '<span class="tournament-status">En attente</span>' +
    '</div>' +
    '<div class="tournament-info">' +
      '<div>👤 User: ' + deposit.userId.substring(0, 12) + '...</div>' +
      '<div>📅 ' + new Date(deposit.createdAt.seconds * 1000).toLocaleString() + '</div>' +
      '<div>💳 Grant ID: ' + deposit.grantId + '</div>' +
    '</div>' +
    '<div class="verification-panel">' +
      '<div><strong>À créditer:</strong> ' + creditAmount.toFixed(2) + ' ' + deposit.currency + ' (après frais 6%)</div>' +
    '</div>' +
    '<div class="tournament-actions">' +
      '<button onclick="window.adminDashboard.creditDeposit(\'' + depositId + '\', \'' + deposit.userId + '\', ' + creditAmount + ')" class="btn-pay">' +
        '✅ Créditer ' + creditAmount.toFixed(2) + ' ' + deposit.currency +
      '</button>' +
      '<button onclick="window.adminDashboard.rejectDeposit(\'' + depositId + '\')" class="btn-cancel">' +
        '❌ Rejeter' +
      '</button>' +
    '</div>';
  
  return div;
}

function creditDeposit(depositId, userId, amount) {
  if (!confirm('Créditer ' + amount + ' à cet utilisateur ?')) return;
  
  window.firebaseApp.db.collection('users').doc(userId).get()
    .then(function(userDoc) {
      const currentBalance = userDoc.data()?.balance || 0;
      const newBalance = currentBalance + amount;
      
      return window.firebaseApp.db.collection('users').doc(userId).update({
        balance: newBalance
      });
    })
    .then(function() {
      return window.firebaseApp.db.collection('transactions').add({
        userId: userId,
        type: 'deposit',
        amount: amount,
        status: 'completed',
        creditedBy: window.adminAuth.currentAdmin.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(function() {
      return window.firebaseApp.db.collection('pending_deposits').doc(depositId).update({
        status: 'credited',
        creditedAt: firebase.firestore.FieldValue.serverTimestamp(),
        creditedBy: window.adminAuth.currentAdmin.uid
      });
    })
    .then(function() {
      alert('✅ Solde crédité!');
      loadPendingDeposits();
    })
    .catch(function(error) {
      console.error('Erreur crédit:', error);
      alert('❌ Erreur!');
    });
}

function rejectDeposit(depositId) {
  if (!confirm('Rejeter ce dépôt ?')) return;
  
  window.firebaseApp.db.collection('pending_deposits').doc(depositId).update({
    status: 'rejected',
    rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
    rejectedBy: window.adminAuth.currentAdmin.uid
  })
  .then(function() {
    alert('✅ Dépôt rejeté!');
    loadPendingDeposits();
  })
  .catch(function(error) {
    console.error('Erreur rejet:', error);
    alert('❌ Erreur!');
  });
}


// Export global
window.adminDashboard = {
  loadDashboardData: loadDashboardData,
  loadActiveTournaments: loadActiveTournaments,           // NOUVEAU
  loadPendingTournaments: loadPendingTournaments,
  loadStatistics: loadStatistics,
  loadTransactionsHistory: loadTransactionsHistory,
  exportTransactionsCSV: exportTransactionsCSV,
  closeTournamentManually: closeTournamentManually,       // NOUVEAU
  viewActiveParticipants: viewActiveParticipants,         // NOUVEAU
  closeParticipantsModal: closeParticipantsModal,         // NOUVEAU
  paySinglePlayer: paySinglePlayer,
  disqualifyAndPayNext: disqualifyAndPayNext,
  cancelTournament: cancelTournament,
  viewTournamentDetails: viewTournamentDetails,
  openTiebreakerCreator: openTiebreakerCreator,
  createTiebreakerTournament: createTiebreakerTournament,
  createHourlyTournament: createHourlyTournament,
  createDailyTournament: createDailyTournament,
  closeAdminModal: closeAdminModal,
  loadPendingDeposits: loadPendingDeposits,
creditDeposit: creditDeposit,
rejectDeposit: rejectDeposit,
};