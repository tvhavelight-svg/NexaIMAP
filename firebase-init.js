// ==========================================
// FIREBASE INITIALIZATION - NexaIMAP
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyCkWrNIBMXE2klMWEHDc-IVidylsBr3cac",
  authDomain: "nexaimap-997ff.firebaseapp.com",
  projectId: "nexaimap-997ff",
  storageBucket: "nexaimap-997ff.firebasestorage.app",
  messagingSenderId: "995290501799",
  appId: "1:995290501799:web:cc27a935ea92f79bdd8182"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// UI FUNCTIONS
// ==========================================

function showLoadingScreen() {
    document.getElementById('loadingScreen').classList.add('active');
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('app').style.display = 'none';
}

function showLoginScreen() {
    document.getElementById('loadingScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('app').style.display = 'none';
}

function showAppScreen() {
    document.getElementById('loadingScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('app').style.display = 'block';
}

function showError(message) {
    var el = document.getElementById('loadingScreen');
    if (el) {
        el.querySelector('.login-card').innerHTML = '<div style="color:#dc2626;text-align:center;"><h2>Error</h2><p>' + message + '</p><button class="btn btn-outline" onclick="location.reload()" style="margin-top:1rem;">Reload</button></div>';
        el.classList.add('active');
    }
}

// ==========================================
// AUTHENTICATION - Anonymous Sign-in
// ==========================================

function signInAnonymously() {
    var btn = document.getElementById('anonLoginBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'กำลังเข้าสู่ระบบ...';
    }
    
    auth.signInAnonymously()
        .then(function(result) {
            console.log('Signed in:', result.user.uid);
            loadAppStateFromFirestore();
        })
        .catch(function(error) {
            console.error('Sign-in error:', error);
            var err = document.getElementById('loginError');
            if (err) err.textContent = 'Error: ' + error.message;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'เข้าใช้งาน (ไม่ต้องสมัคร)';
            }
        });
}

function signOutFromFirebase() {
    auth.signOut().then(function() {
        stopFirestoreListener();
        showLoginScreen();
    });
}

// ==========================================
// FIRESTORE DATA FUNCTIONS
// ==========================================

var APP_DOC_ID = 'state';

function loadAppStateFromFirestore() {
    showLoadingScreen();
    
    db.collection('nexaimap').doc(APP_DOC_ID).get()
        .then(function(docSnap) {
            if (docSnap.exists) {
                var state = docSnap.data();
                if (state.members && state.jobs && state.archivedJobs) {
                    window.members = state.members;
                    window.jobs = state.jobs;
                    window.archivedJobs = state.archivedJobs;
                    if (state.currentUserName) {
                        window.currentUser = window.members.find(function(m) { return m.name === state.currentUserName; }) || null;
                    }
                }
            }
            showAppForCurrentUser();
            startFirestoreListener();
        })
        .catch(function(error) {
            console.error('Load error:', error);
            showError('โหลดข้อมูลไม่ได้: ' + error.message);
        });
}

function saveAppStateToFirestore() {
    var state = {
        members: window.members,
        jobs: window.jobs,
        archivedJobs: window.archivedJobs,
        currentUserName: window.currentUser ? window.currentUser.name : null
    };
    db.collection('nexaimap').doc(APP_DOC_ID).set(state, { merge: true })
        .catch(function(error) { console.error('Save error:', error); });
}

var unsubscribeFirestore = null;

function startFirestoreListener() {
    unsubscribeFirestore = db.collection('nexaimap').doc(APP_DOC_ID)
        .onSnapshot(function(doc) {
            if (doc.exists) {
                var state = doc.data();
                if (state.members && state.jobs && state.archivedJobs) {
                    var changed = JSON.stringify(state.members) !== JSON.stringify(window.members) ||
                                  JSON.stringify(state.jobs) !== JSON.stringify(window.jobs) ||
                                  JSON.stringify(state.archivedJobs) !== JSON.stringify(window.archivedJobs);
                    if (changed) {
                        console.log('Syncing data...');
                        window.members = state.members;
                        window.jobs = state.jobs;
                        window.archivedJobs = state.archivedJobs;
                        var activeTab = document.querySelector('.tab-btn.active');
                        if (activeTab) renderPage(activeTab.getAttribute('data-target'));
                    }
                }
            }
        });
}

function stopFirestoreListener() {
    if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
    }
}

// ==========================================
// AUTH STATE OBSERVER
// ==========================================

auth.onAuthStateChanged(function(user) {
    if (user) {
        console.log('User:', user.uid);
        loadAppStateFromFirestore();
    } else {
        console.log('No user - signing in anonymously');
        signInAnonymously();
    }
});

// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

window.signInAnonymously = signInAnonymously;
window.signOutFromFirebase = signOutFromFirebase;
window.loadAppStateFromFirestore = loadAppStateFromFirestore;
window.saveAppStateToFirestore = saveAppStateToFirestore;
window.startFirestoreListener = startFirestoreListener;
window.stopFirestoreListener = stopFirestoreListener;
window.showLoginScreen = showLoginScreen;
window.showAppScreen = showAppScreen;
window.showError = showError;

// ==========================================
// TIMEOUT (30 seconds)
// ==========================================

setTimeout(function() {
    var ls = document.getElementById('loadingScreen');
    if (ls && ls.classList.contains('active')) {
        ls.querySelector('.login-card').innerHTML = '<div style="color:#b45309;text-align:center;"><h2>โหลดนานเกินไป</h2><p>ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</p><button class="btn btn-primary" onclick="location.reload()" style="margin-top:1rem;">ลองใหม่</button></div>';
    }
}, 30000);