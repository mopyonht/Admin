// ===== SYSTÈME D'AUTHENTIFICATION ADMIN =====

let currentAdmin = null;

// ===== INITIALISATION =====
window.firebaseApp.auth.onAuthStateChanged(function(user) {
  console.log('🔵 Auth state changed:', user ? user.email : 'Déconnecté');
  
  if (user) {
    checkAdminAccess(user);
  } else {
    showLoginForm();
  }
});

// ===== VÉRIFIER ACCÈS ADMIN =====
function checkAdminAccess(user) {
  console.log('🔍 Vérification accès admin pour:', user.email);
  
  window.firebaseApp.db.collection('admins').doc(user.uid).get()
    .then(function(adminDoc) {
      if (adminDoc.exists) {
        const adminData = adminDoc.data();
        console.log('📄 Document admin trouvé:', adminData);
        
        if (adminData.status === 'active') {
          currentAdmin = {
            uid: user.uid,
            email: user.email,
            role: user.uid === window.firebaseApp.CHIEF_ADMIN_UID ? 'chief' : 'admin',
            fullName: adminData.fullName || user.email
          };
          
          console.log('✅ Admin connecté:', currentAdmin);
          
          // IMPORTANT: Mettre à jour window.adminAuth.currentAdmin dynamiquement
          window.adminAuth.currentAdmin = currentAdmin;
          
          window.firebaseApp.db.collection('admins').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          showAdminDashboard();
        } else if (adminData.status === 'pending') {
          console.log('⏳ Admin en attente');
          showPendingMessage();
        } else {
          console.log('❌ Admin bloqué');
          showAccessDenied('Kont ou bloke');
        }
      } else {
        console.log('❌ Pas de document admin');
        showAccessDenied('Ou pa gen aksè admin');
      }
    })
    .catch(function(error) {
      console.error('Erreur vérification admin:', error);
      showAccessDenied('Erè verifikasyon');
    });
}

// ===== AFFICHER FORMULAIRE LOGIN =====
function showLoginForm() {
  console.log('📝 Affichage formulaire login');
  document.getElementById('adminLoginForm').style.display = 'block';
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('adminPending').style.display = 'none';
}

// ===== AFFICHER MESSAGE EN ATTENTE =====
function showPendingMessage() {
  console.log('⏳ Affichage message en attente');
  document.getElementById('adminLoginForm').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('adminPending').style.display = 'block';
}

// ===== AFFICHER ACCÈS REFUSÉ =====
function showAccessDenied(message) {
  console.log('❌ Accès refusé:', message);
  alert('❌ ' + message);
  window.firebaseApp.auth.signOut();
  showLoginForm();
}

// ===== AFFICHER DASHBOARD =====
function showAdminDashboard() {
  console.log('🎉 Affichage dashboard');
  
  document.getElementById('adminLoginForm').style.display = 'none';
  document.getElementById('adminPending').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  
  document.getElementById('adminName').textContent = currentAdmin.fullName;
  document.getElementById('adminRole').textContent = currentAdmin.role === 'chief' ? 'Admin Chef' : 'Admin';
  
  if (currentAdmin.role === 'chief') {
    document.getElementById('adminManagementSection').style.display = 'block';
    var tab = document.getElementById('adminManagementTab');
    if (tab) tab.style.display = 'block';
    loadAdminsList();
  } else {
    document.getElementById('adminManagementSection').style.display = 'none';
    var tab = document.getElementById('adminManagementTab');
    if (tab) tab.style.display = 'none';
  }
  
  if (window.adminDashboard) {
    window.adminDashboard.loadDashboardData();
  }
}

// ===== LOGIN ADMIN EXISTANT =====
function loginExistingAdmin() {
  console.log('🔑 Tentative de connexion...');
  
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const generalPassword = document.getElementById('generalPassword').value;
  
  console.log('📧 Email:', email);
  
  if (!email || !password || !generalPassword) {
    alert('❌ Ranpli tout chan yo!');
    return;
  }
  
  window.firebaseApp.db.collection('admin_config').doc('general').get()
    .then(function(configDoc) {
      if (!configDoc.exists) {
        console.error('❌ Document admin_config/general n\'existe pas!');
        alert('❌ Sistèm pa konfigire! Kouri init-admin.js!');
        return Promise.reject('Config manquante');
      }
      
      const storedGeneralHash = configDoc.data().passwordHash;
      console.log('🔐 Hash stocké:', storedGeneralHash);
      console.log('🔐 Hash saisi:', btoa(generalPassword));
      
      if (btoa(generalPassword) !== storedGeneralHash) {
        console.error('❌ Mot de passe général incorrect');
        alert('❌ Modpas jeneral pa bon!');
        return Promise.reject('Mot de passe général incorrect');
      }
      
      console.log('✅ Mot de passe général OK, connexion Firebase Auth...');
      
      return window.firebaseApp.auth.signInWithEmailAndPassword(email, password);
    })
    .then(function() {
      console.log('✅ Connexion Firebase Auth réussie!');
    })
    .catch(function(error) {
      if (error !== 'Config manquante' && error !== 'Mot de passe général incorrect') {
        console.error('Erreur login:', error);
        if (error.code === 'auth/wrong-password') {
          alert('❌ Modpas pèsonèl pa bon!');
        } else if (error.code === 'auth/user-not-found') {
          alert('❌ Kont sa pa egziste!');
        } else {
          alert('❌ Erè koneksyon: ' + error.message);
        }
      }
    });
}

// ===== DEMANDER INSCRIPTION ADMIN =====
function requestAdminAccess() {
  const email = document.getElementById('requestEmail').value.trim();
  const password = document.getElementById('requestPassword').value;
  const confirmPassword = document.getElementById('requestConfirmPassword').value;
  const fullName = document.getElementById('requestFullName').value.trim();
  
  if (!email || !password || !confirmPassword || !fullName) {
    alert('❌ Ranpli tout chan yo!');
    return;
  }
  
  if (password !== confirmPassword) {
    alert('❌ Modpas yo pa menm!');
    return;
  }
  
  if (password.length < 6) {
    alert('❌ Modpas dwe gen omwen 6 karaktè!');
    return;
  }
  
  window.firebaseApp.auth.createUserWithEmailAndPassword(email, password)
    .then(function(userCredential) {
      const uid = userCredential.user.uid;
      
      return window.firebaseApp.db.collection('admins').doc(uid).set({
        email: email,
        fullName: fullName,
        status: 'pending',
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
        role: 'admin'
      });
    })
    .then(function() {
      return window.firebaseApp.auth.signOut();
    })
    .then(function() {
      alert('✅ Demann ou voye! Tann apwobasyon admin chef la.');
      showLoginForm();
    })
    .catch(function(error) {
      console.error('Erreur demande accès:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('❌ Email sa deja itilize!');
      } else {
        alert('❌ Erè pandan demann: ' + error.message);
      }
    });
}

// ===== CHARGER LISTE ADMINS =====
function loadAdminsList() {
  window.firebaseApp.db.collection('admins')
    .orderBy('requestedAt', 'desc')
    .get()
    .then(function(adminsSnap) {
      const pendingList = document.getElementById('pendingAdminsList');
      const activeList = document.getElementById('activeAdminsList');
      
      pendingList.innerHTML = '';
      activeList.innerHTML = '';
      
      let pendingCount = 0;
      let activeCount = 0;
      
      adminsSnap.forEach(function(doc) {
        const admin = doc.data();
        const item = createAdminItem(doc.id, admin);
        
        if (admin.status === 'pending') {
          pendingList.appendChild(item);
          pendingCount++;
        } else if (admin.status === 'active') {
          activeList.appendChild(item);
          activeCount++;
        }
      });
      
      if (pendingCount === 0) {
        pendingList.innerHTML = '<div class="empty-state">Okenn demann</div>';
      }
      
      if (activeCount === 0) {
        activeList.innerHTML = '<div class="empty-state">Okenn admin aktif</div>';
      }
      
      document.getElementById('pendingAdminsCount').textContent = pendingCount;
      document.getElementById('activeAdminsCount').textContent = activeCount;
    })
    .catch(function(error) {
      console.error('Erreur chargement admins:', error);
    });
}

// ===== CRÉER ITEM ADMIN =====
function createAdminItem(uid, admin) {
  const div = document.createElement('div');
  div.className = 'admin-item';
  
  const isChief = uid === window.firebaseApp.CHIEF_ADMIN_UID;
  
  let lastLoginText = 'Jamè';
  if (admin.lastLogin) {
    lastLoginText = admin.lastLogin.toDate().toLocaleDateString('fr-FR');
  }
  
  let requestedAtText = 'N/A';
  if (admin.requestedAt) {
    requestedAtText = admin.requestedAt.toDate().toLocaleDateString('fr-FR');
  }
  
  div.innerHTML = 
    '<div class="admin-info">' +
      '<div class="admin-name">' +
        admin.fullName + (isChief ? ' 👑' : '') +
        (admin.status === 'pending' ? ' <span class="badge-pending">En attente</span>' : '') +
      '</div>' +
      '<div class="admin-email">' + admin.email + '</div>' +
      '<div class="admin-meta">' +
        (admin.status === 'pending' 
          ? 'Demann: ' + requestedAtText
          : 'Dènye koneksyon: ' + lastLoginText) +
      '</div>' +
    '</div>' +
    '<div class="admin-actions">' +
      (admin.status === 'pending' && !isChief 
        ? '<button onclick="approveAdmin(\'' + uid + '\')" class="btn-approve">✅ Aksepte</button>' +
          '<button onclick="rejectAdmin(\'' + uid + '\')" class="btn-reject">❌ Refize</button>'
        : '') +
      (admin.status === 'active' && !isChief 
        ? '<button onclick="removeAdmin(\'' + uid + '\')" class="btn-remove">🗑️ Retire</button>'
        : '') +
      (isChief ? '<span class="chief-badge">Admin Chef</span>' : '') +
    '</div>';
  
  return div;
}

// ===== APPROUVER ADMIN =====
function approveAdmin(uid) {
  if (!confirm('Aksepte admin sa?')) return;
  
  window.firebaseApp.db.collection('admins').doc(uid).update({
    status: 'active',
    approvedBy: currentAdmin.uid,
    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(function() {
    alert('✅ Admin aksepte!');
    loadAdminsList();
  })
  .catch(function(error) {
    console.error('Erreur approbation:', error);
    alert('❌ Erè!');
  });
}

// ===== REFUSER ADMIN =====
function rejectAdmin(uid) {
  if (!confirm('Refize demann sa?')) return;
  
  window.firebaseApp.db.collection('admins').doc(uid).delete()
    .then(function() {
      alert('✅ Demann refize!');
      loadAdminsList();
    })
    .catch(function(error) {
      console.error('Erreur rejet:', error);
      alert('❌ Erè!');
    });
}

// ===== RETIRER ADMIN =====
function removeAdmin(uid) {
  if (!confirm('Retire admin sa? Li pap gen aksè ankò.')) return;
  
  window.firebaseApp.db.collection('admins').doc(uid).update({
    status: 'removed',
    removedBy: currentAdmin.uid,
    removedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(function() {
    alert('✅ Admin retire!');
    loadAdminsList();
  })
  .catch(function(error) {
    console.error('Erreur retrait:', error);
    alert('❌ Erè!');
  });
}

// ===== DÉCONNEXION =====
function logoutAdmin() {
  window.firebaseApp.auth.signOut()
    .then(function() {
      currentAdmin = null;
      window.adminAuth.currentAdmin = null; // IMPORTANT
      showLoginForm();
    })
    .catch(function(error) {
      console.error('Erreur déconnexion:', error);
    });
}

// ===== TOGGLE FORMULAIRES =====
function toggleRequestForm() {
  const loginForm = document.getElementById('existingAdminForm');
  const requestForm = document.getElementById('newAdminRequestForm');
  
  if (requestForm.style.display === 'none' || !requestForm.style.display) {
    loginForm.style.display = 'none';
    requestForm.style.display = 'block';
  } else {
    loginForm.style.display = 'block';
    requestForm.style.display = 'none';
  }
}

// Export global - CORRECTION ICI
window.adminAuth = {
  get currentAdmin() { return currentAdmin; }, // ← GETTER DYNAMIQUE
  loginExistingAdmin: loginExistingAdmin,
  requestAdminAccess: requestAdminAccess,
  approveAdmin: approveAdmin,
  rejectAdmin: rejectAdmin,
  removeAdmin: removeAdmin,
  logoutAdmin: logoutAdmin,
  toggleRequestForm: toggleRequestForm
};

console.log('✅ adminAuth.js chargé');