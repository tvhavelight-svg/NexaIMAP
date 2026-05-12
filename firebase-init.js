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
// Initialize Firebase
let firebaseInitialized = false;
try {
    firebase.initializeApp(firebaseConfig);
    firebaseInitialized = true;
} catch (e) {
    console.error('Firebase init error:', e);
}
// Initialize Auth and Firestore
const auth = firebaseInitialized ? firebase.auth() : null;
const db = firebaseInitialized ? firebase.firestore() : null;
// ==========================================
// UI FUNCTIONS
// ==========================================
function showLoadingScreen() {
    const loading = document.getElementById('loadingScreen');
    const login = document.getElementById('loginScreen');
    if (loading) loading.classList.add('active');
    if (login) login.classList.remove('active');
    const app = document.getElementById('app');
    if (app) app.style.display = 'none';
}
function showLoginScreen() {
    const loading = document.getElementById('loadingScreen');
    const login = document.getElementById('loginScreen');
    if (loading) loading.classList.remove('active');
    if (login) login.classList.add('active');
    const app = document.getElementById('app');
    if (app) app.style.display = 'none';
}
function showAppScreen() {
    const loading = document.getElementById('loadingScreen');
    const login = document.getElementById('loginScreen');
    if (loading) loading.classList.remove('active');
    if (login) login.classList.remove('active');
    const app = document.getElementById('app');
    if (app) app.style.display = 'block';
}
function showError(message) {
    const loading = document.getElementById('loadingScreen');
    if (loading) {
        loading.querySelector('.login-card').innerHTML = `
            <div style="color: #dc2626;">
                <h2>⚠️ Error</h2>
                <p>${message}</p>
                <button class="btn btn-outline" onclick="location.reload()" style="margin-top: 1rem;">
                    ลองใหม่อีกครั้ง
                </button>
            </div>
        `;
        loading.classList.add('active');
    }
    console.error(message);
}
// ==========================================
// AUTHENTICATION - Anonymous Sign-in
// ==========================================
function signInAnonymously() {
    if (!auth) {
        console.error('Firebase auth not available');
        showError('Firebase ไม่พร้อมใช้งาน');
        return;
    }
    
    const btn = document.getElementById('anonLoginBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'กำลังเข้าสู่ระบบ...';
    }
    
    auth.signInAnonymously()
        .then((result) => {
            console.log('Anonymous Sign-in successful:', result.user.uid);
            loadAppStateFromFirestore();
        })
        .catch((error) => {
            console.error('Anonymous Sign-in error:', error);
            const errorDiv = document.getElementById('loginError');
            if (errorDiv) {
                errorDiv.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + error.message;
            }
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'เข้าใช้งาน (ไม่ต้องสมัคร)';
            }
        });
}
function signOutFromFirebase() {
    auth.signOut()
        .then(() => {
            stopFirestoreListener();
            showLoginScreen();
        })
        .catch((error) => {
            console.error('Sign-out error:', error);
        });
}
// ==========================================
// FIRESTORE DATA FUNCTIONS
// ==========================================
const APP_DOC_ID = 'state';
async function loadAppStateFromFirestore() {
    try {
        showLoadingScreen();
        
        if (!db) {
            showError('Firestore ไม่พร้อมใช้งาน');
            return;
        }
        
        const docRef = db.collection('nexaimap').doc(APP_DOC_ID);
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 10000);
        });
        
        const docSnap = await Promise.race([docRef.get(), timeoutPromise]);
        
        if (docSnap.exists) {
            const state = docSnap.data();
            
            if (Array.isArray(state.members) && Array.isArray(state.jobs) && Array.isArray(state.archivedJobs)) {
                window.members = state.members;
                window.jobs = state.jobs;
                window.archivedJobs = state.archivedJobs;
                
                normalizeMemberRoles();
                
                if (state.currentUserName) {
                    window.currentUser = window.members.find(m => m.name === state.currentUserName) || null;
                }
            }
        } else {
            console.log('No existing data, using default members');
            saveAppStateToFirestore();
        }
        
        showAppForCurrentUser();
        
    } catch (error) {
        console.error('Error loading from Firestore:', error);
        showError('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
    }
}
async function saveAppStateToFirestore() {
    try {
        const state = {
            members: window.members,
            jobs: window.jobs,
            archivedJobs: window.archivedJobs,
            currentUserName: window.currentUser?.name || null,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('nexaimap').doc(APP_DOC_ID).set(state, { merge: true });
        console.log('State saved to Firestore');
        
    } catch (error) {
        console.error('Error saving to Firestore:', error);
    }
}
let unsubscribeFirestore = null;
function startFirestoreListener() {
    unsubscribeFirestore = db.collection('nexaimap').doc(APP_DOC_ID)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const state = doc.data();
                
                if (Array.isArray(state.members) && Array.isArray(state.jobs) && Array.isArray(state.archivedJobs)) {
                    if (JSON.stringify(state.members) !== JSON.stringify(window.members) ||
                        JSON.stringify(state.jobs) !== JSON.stringify(window.jobs) ||
                        JSON.stringify(state.archivedJobs) !== JSON.stringify(window.archivedJobs)) {
                        
                        console.log('Syncing data from Firestore...');
                        
                        window.members = state.members;
                        window.jobs = state.jobs;
                        window.archivedJobs = state.archivedJobs;
                        
                        normalizeMemberRoles();
                        
                        const activeTab = document.querySelector('.tab-btn.active');
                        if (activeTab) {
                            renderPage(activeTab.getAttribute('data-target'));
                        }
                    }
                }
            }
        }, (error) => {
            console.error('Firestore listener error:', error);
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
function initFirebaseAuth() {
    if (!auth) {
        console.error('Firebase not initialized');
        showLoginScreen();
        return;
    }
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User is signed in:', user.uid);
            loadAppStateFromFirestore();
        } else {
            console.log('No user signed in - triggering anonymous sign-in');
            signInAnonymously();
        }
    }, (error) => {
        console.error('Auth state error:', error);
        showError('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
    });
}
// Start auth listener when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseAuth);
} else {
    initFirebaseAuth();
}
// ==========================================
// TIMEOUT PROTECTION (30 seconds)
// ==========================================
setTimeout(() => {
    const loginScreen = document.getElementById('loginScreen');
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    
    if (loadingScreen && loadingScreen.classList.contains('active')) {
        loadingScreen.querySelector('.login-card').innerHTML = `
            <div style="color: #b45309;">
                <h2>⏱️ โหลดนานเกินไป</h2>
                <p>กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">
                    ลองใหม่
                </button>
            </div>
        `;
    }
}, 30000);
// Make functions globally available
window.signInAnonymously = signInAnonymously;
window.signOutFromFirebase = signOutFromFirebase;
window.loadAppStateFromFirestore = loadAppStateFromFirestore;
window.saveAppStateToFirestore = saveAppStateToFirestore;
window.startFirestoreListener = startFirestoreListener;
window.stopFirestoreListener = stopFirestoreListener;
window.showLoginScreen = showLoginScreen;
window.showAppScreen = showAppScreen;
window.showError = showError;
