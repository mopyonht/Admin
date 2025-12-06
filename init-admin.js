// ===== SCRIPT D'INITIALISATION ADMIN =====

async function initializeAdmin() {
  const chiefEmail = 'jynnjaisy@gmail.com';
  const generalPassword = '@Izana2005';
  
  try {
    console.log('🔧 Initialisation du système admin...');
    
    const generalPasswordHash = btoa(generalPassword);
    
    await window.firebaseApp.db.collection('admin_config').doc('general').set({
      passwordHash: generalPasswordHash,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Mot de passe général configuré');
    
    if (window.firebaseApp.CHIEF_ADMIN_UID === 'TON_UID_ICI') {
      alert('❌ ERREUR: Remplace CHIEF_ADMIN_UID dans firebaseConfig.js avec ton vrai UID!');
      return;
    }
    
    await window.firebaseApp.db.collection('admins').doc(window.firebaseApp.CHIEF_ADMIN_UID).set({
      email: chiefEmail,
      fullName: 'Admin Chef',
      status: 'active',
      role: 'chief',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Admin chef créé avec UID:', window.firebaseApp.CHIEF_ADMIN_UID);
    
    const now = new Date();
    const hour = now.getHours();
    const tournamentKey = 'hourly-' + now.toISOString().split('T')[0] + '-' + hour + 'h';
    
    const startTime = new Date(now);
    startTime.setMinutes(0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1);
    
    await window.firebaseApp.db.collection('tournaments').doc(tournamentKey).set({
      type: 'hourly',
      name: 'Tournoi Test ' + hour + 'h',
      startTime: firebase.firestore.Timestamp.fromDate(startTime),
      endTime: firebase.firestore.Timestamp.fromDate(endTime),
      status: 'active',
      entryFee: 25,
      totalPot: 0,
      prize: 0,
      participantCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Tournoi test créé:', tournamentKey);
    
    alert('✅ INITIALISATION COMPLÈTE!\n\n' +
          'Email: ' + chiefEmail + '\n'+
          'Mot de passe personnel: (celui de ton compte Firebase)\n' +
          'Mot de passe général: ' + generalPassword + '\n\n' +
          'Tu peux maintenant te connecter!');
    
  } catch (error) {
    console.error('❌ Erreur initialisation:', error);
    alert('❌ Erreur: ' + error.message);
  }
}

// ===== INSTRUCTIONS =====
console.log('%c📋 INSTRUCTIONS D\'INITIALISATION', 'color: #2563eb; font-size: 18px; font-weight: bold');
console.log('%c1. Va sur Firebase Console > Authentication > Users', 'color: #16a34a; font-size: 14px');
console.log('%c2. Clique "Add User" et crée ton compte admin', 'color: #16a34a; font-size: 14px');
console.log('%c3. Copie ton UID et remplace CHIEF_ADMIN_UID dans firebaseConfig.js', 'color: #16a34a; font-size: 14px');
console.log('%c4. Remplace TON_EMAIL dans ce fichier (ligne 4)', 'color: #16a34a; font-size: 14px');
console.log('%c5. Tape dans la console: initializeAdmin()', 'color: #f59e0b; font-size: 16px; font-weight: bold');