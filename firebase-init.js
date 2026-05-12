// ==========================================
// FIREBASE INITIALIZATION - NexaIMAP (LOCAL MODE)
// ==========================================
// Skip Firebase, use local mode for testing
window.members = null;
window.jobs = [];
window.archivedJobs = [];
window.currentUser = { name: 'joy', role: 'Employee' };
// Skip all Firebase init
setTimeout(function() {
    document.getElementById('loadingScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('app').style.display = 'block';
    document.getElementById('currentUserDisplay').textContent = '👤 JOY (Employee)';
    document.getElementById('adminBtn').style.display = 'block';
    document.getElementById('resetBtn').style.display = 'block';
    initApp();
}, 1000);
// Stub functions
window.signInAnonymously = function() {};
window.signOutFromFirebase = function() {};
window.saveAppStateToFirestore = function() {};
window.startFirestoreListener = function() {};
window.showLoginScreen = function() {};
window.showAppScreen = function() {};
window.showError = function() {};