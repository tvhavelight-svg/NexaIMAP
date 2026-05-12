// ==========================================
// FIREBASE INITIALIZATION - NexaIMAP
// ==========================================

window.members = null;
window.jobs = [];
window.archivedJobs = [];
window.currentUser = { name: 'joy', role: 'Employee' };

// Wait for DOM + app.js to load
function startLocalMode() {
    var ls = document.getElementById('loadingScreen');
    if (!ls) {
        setTimeout(startLocalMode, 100);
        return;
    }
    
    ls.classList.remove('active');
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('app').style.display = 'block';
    document.getElementById('currentUserDisplay').textContent = '👤 JOY (Employee)';
    document.getElementById('adminBtn').style.display = 'block';
    document.getElementById('resetBtn').style.display = 'block';
    
    if (typeof initApp === 'function') {
        initApp();
    }
}

window.signInAnonymously = function() { startLocalMode(); };
window.signOutFromFirebase = function() { location.reload(); };
window.saveAppStateToFirestore = function() {};
window.startFirestoreListener = function() {};
window.showLoginScreen = function() {};
window.showAppScreen = function() {};
window.showError = function(m) { alert(m); };

// Auto-start after 1.5 seconds
setTimeout(startLocalMode, 1500);