// ==========================================
// FIREBASE CONFIG
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyD0aZ-XXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "nexaimap-997ff.firebaseapp.com",
    projectId: "nexaimap-997ff",
    storageBucket: "nexaimap-997ff.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
};

let db;
let notifications = [];

function initFirebase() {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('Firebase initialized');
    
    loadFromFirestore();
}

function loadFromFirestore() {
    if(!db) {
        console.log('Firestore: db not ready');
        initApp();
        return;
    }
    
    console.log('Firestore: Loading with realtime listener...');
    
    // Use onSnapshot for realtime sync
    const unsubscribe = db.collection('state').doc('appState')
    .onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            members = data.members || initialMembers;
            jobs = data.jobs || [];
            archivedJobs = data.archivedJobs || [];
            notifications = Array.isArray(data.notifications) ? data.notifications : [];

            // Backfill officer defaults (do not override non-empty custom settings).
            members = members.map(member => {
                if(member.role !== 'Officer') return member;
                const allowed = Array.isArray(member.allowed) ? member.allowed : [];
                if(allowed.length > 0) return { ...member, allowed };
                return { ...member, allowed: ['QC', ...PROCESS_KEYS] };
            });

            // Backfill acceptJobs default (do not override explicit false).
            members = members.map(member => {
                if(typeof member.acceptJobs === 'boolean') return member;
                return { ...member, acceptJobs: true };
            });
            
            // Ensure admin user exists
            const adminExists = members.some(m => m.name === 'admin');
            if(!adminExists) {
                members.unshift({ name: 'admin', role: 'Admin', allowed: [...PROCESS_KEYS], status: 'Available', mins: 0, forceStatus: null });
            }

            // Ensure sales users exist (requesters)
            const ensureUser = (name) => {
                if(members.some(m => m.name === name)) return;
                members.push({ name, role: 'User', allowed: [], acceptJobs: false, status: 'Available', mins: 0, forceStatus: null });
            };
            ['sale1','sale2','sale3','sale4','sale5'].forEach(ensureUser);
            
            // Restore current user
            if(data.currentUserName) {
                currentUser = members.find(m => m.name === data.currentUserName) || null;
            }
            if(!currentUser) {
                const defaultEmployee = members.find(m => m.role === 'Employee');
                if(defaultEmployee) currentUser = defaultEmployee;
            }
            
            console.log('✓ Synced from Firestore:', jobs.length, 'jobs');
            
            // Re-render if app is already loaded
            if(window.appReady) {
                renderDashboard();
                renderMyWork();
                renderCalendar();
                renderNotificationsUI();
            }
        } else {
            console.log('No data in Firestore, saving initial state...');
            saveToFirestore();
        }
    }, err => {
        console.error('✗ Firestore listen error:', err);
    });
    
    // Store unsubscribe function
    window.firestoreUnsubscribe = unsubscribe;
    
    // Mark app as ready after initial load
    setTimeout(() => {
        window.appReady = true;
        if(window.firestoreLoadedResolve) {
            window.firestoreLoadedResolve();
            firestoreLoaded = true;
        }
        
        // Show app if user exists
        if(currentUser) {
            showAppForCurrentUser();
        } else {
            // Show login screen if no user
            loginScreen.classList.add('active');
            appScreen.style.display = 'none';
        }
        
        initApp();
    }, 1000);
}

function saveToFirestore() {
    if(!db) {
        console.log('Firestore: db not ready, skipping save');
        return;
    }
    
    const state = {
        members: members,
        jobs: jobs,
        archivedJobs: archivedJobs,
        notifications: notifications,
        currentUserName: currentUser?.name || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('Firestore: Saving', jobs.length, 'jobs...');
    
    db.collection('state').doc('appState').set(state, { merge: true })
    .then(() => console.log('✓ Saved to Firestore successfully'))
    .catch(err => console.error('✗ Error saving to Firestore:', err));
}

// ==========================================
// DATA & STATE
// ==========================================
const SATELLITE_SPECS = [
    { name: 'EarthScanner', category: 'HRS', processes: { PAN: 300, MS: 300, PSP: 30, ENH: 120, MOS: 240 } },
    { name: 'Geoeye-1', category: 'HRS', processes: { DEM: 180, RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'Ikonos-2', category: 'HRS', processes: { RPC: 40, PAN: 180, MS: 180, PSP: 30, ENH: 120, MOS: 240 } },
    { name: 'Jilin-1', category: 'HRS', processes: { RPC: 40, PAN: 180, MS: 180, PSP: 30, ENH: 120, MOS: 240 } },
    { name: 'Pleiades', category: 'HRS', processes: { DEM: 180, RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'PleiadesNeo', category: 'HRS', processes: { RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'Quickbird-2', category: 'HRS', processes: { RPC: 40, PAN: 180, MS: 180, PSP: 30, ENH: 120, MOS: 240 } },
    { name: 'Spot-6', category: 'HRS', processes: { RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'Spot-7', category: 'HRS', processes: { RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'THEOS-2', category: 'HRS', processes: { ORT: 240, ENH: 120, MOS: 240 } },
    { name: 'Worldview-2', category: 'HRS', processes: { DEM: 180, RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'Worldview-3', category: 'HRS', processes: { DEM: 180, RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'WorldView Legion', category: 'HRS', processes: { RPC: 40, ORT: 180, ENH: 120, MOS: 240 } },
    { name: 'Gaofen-1', category: '2M', processes: { ORT: 180, ENH: 120, MOS: 210 } },
    { name: 'Thaichote-1', category: '2M', processes: { DEM: 4500, ORT: 240, ENH: 120, MOS: 217.5 } },
    { name: 'ZiYuan-3', category: '2M', processes: { DEM: 4500, ORT: 180, ENH: 120, MOS: 210 } }
];

const PROCESS_KEYS = ['DEM', 'RPC', 'ORT', 'PAN', 'MS', 'PSP', 'ENH', 'MOS', 'REPORT'];
const REPORT_RATE_MINUTES = 1260;
const WORKDAY_MINUTES = 7 * 60;
const OFFICER_QC_MINUTES_PER_IMAGE = 40;
const SPECIAL_OFFICER_SENT_MINUTES = 20;
const SATELLITE_BY_NAME = Object.fromEntries(SATELLITE_SPECS.map(spec => [spec.name, spec]));

function getStepRate(satellite, step) {
    if(step === 'REPORT') return REPORT_RATE_MINUTES;
    const rate = SATELLITE_BY_NAME[satellite]?.processes?.[step];
    return Number.isFinite(rate) ? rate : null;
}

function calculateStepMins(satellite, step, imgCount) {
    const rate = getStepRate(satellite, step);
    if(rate === null) throw new Error(`${step} is not available for ${satellite}`);
    return step === 'REPORT' ? rate : rate * imgCount;
}

function calculateStepsMins(satellite, steps, imgCount) {
    return steps.reduce((sum, step) => sum + calculateStepMins(satellite, step, imgCount), 0);
}

function unsupportedSteps(satellite, steps) {
    return steps.filter(step => !PROCESS_KEYS.includes(step) || getStepRate(satellite, step) === null);
}

function formatMins(mins) {
    return Number.isInteger(mins) ? mins.toLocaleString() : mins.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function getSelectedProcessesFromForm() {
    const taskType = document.querySelector('input[name="taskType"]:checked')?.value || null;
    const processTypes = Array.from(document.querySelectorAll('input[name="processType"]:checked')).map(cb => cb.value);
    const enhType = document.querySelector('input[name="enhType"]:checked')?.value || 'None';
    const mosType = document.querySelector('input[name="mosType"]:checked')?.value || 'None';
    const reportType = document.querySelector('input[name="reportType"]:checked')?.value || 'None';
    const selected = [];

    if(taskType) selected.push(taskType);
    selected.push(...processTypes);
    if(enhType !== 'None') selected.push(enhType);
    if(mosType !== 'None') selected.push(mosType);
    if(reportType !== 'None') selected.push(reportType);

    return selected;
}

function updateEstimatePreview() {
    const preview = document.getElementById('estimatePreview');
    if(!preview) return;

    const satellite = document.getElementById('orderSat')?.value;
    const sceneCount = parseInt(document.getElementById('orderImgCount')?.value, 10);
    const selectedProcesses = getSelectedProcessesFromForm();

    if(selectedProcesses.length === 0) {
        preview.textContent = 'Estimated time: -';
        return;
    }

    const sceneBasedProcesses = selectedProcesses.filter(step => step !== 'REPORT');
    if(sceneBasedProcesses.length > 0 && (!satellite || !sceneCount)) {
        preview.textContent = 'Estimated time: -';
        return;
    }

    const unavailable = unsupportedSteps(satellite, selectedProcesses);
    if(unavailable.length) {
        preview.textContent = `Unsupported: ${unavailable.join(', ')}`;
        return;
    }

    const estimatedMinutes = calculateStepsMins(satellite, selectedProcesses, sceneCount);
    preview.textContent = `Estimated time: ${formatMins(estimatedMinutes)} mins (${selectedProcesses.join(' + ')})`;
}

function updateRateAvailability() {
    const satellite = document.getElementById("orderSat")?.value;
    const rateSummary = document.getElementById("rateSummary");
    const optionInputs = document.querySelectorAll("#orderForm input[type='radio'], #orderForm input[type='checkbox']");

    optionInputs.forEach(input => {
        // Do not disable non-process controls.
        if(input.name === 'rawdataReady') {
            input.disabled = false;
            input.closest("label")?.classList.remove("option-disabled");
            return;
        }

        if(input.value === "None") {
            input.disabled = false;
            input.closest("label")?.classList.remove("option-disabled");
            return;
        }

        if(input.value === "REPORT") {
            input.disabled = false;
            const label = input.closest("label");
            label?.classList.remove("option-disabled");
            if(label) label.title = `${formatMins(REPORT_RATE_MINUTES)} mins/order`;
            return;
        }

        const rate = satellite ? getStepRate(satellite, input.value) : null;
        const isAvailable = rate !== null;
        input.disabled = !isAvailable;
        if(!isAvailable) input.checked = false;

        const label = input.closest("label");
        label?.classList.toggle("option-disabled", !isAvailable);
        if(label) {
            const unit = input.value === 'REPORT' ? 'order' : 'scene';
            label.title = isAvailable ? `${formatMins(rate)} mins/${unit}` : "Not supported by this satellite";
        }
    });

    if(!rateSummary) return;
    if(!satellite) {
        rateSummary.innerHTML = "เลือกดาวเทียมเพื่อดูเรทเวลาจากตาราง";
        updateEstimatePreview();
        return;
    }

    const entries = Object.entries(SATELLITE_BY_NAME[satellite]?.processes || {})
        .map(([step, rate]) => `<span><strong>${step}</strong> ${formatMins(rate)} mins/scene</span>`)
        .concat(`<span><strong>REPORT</strong> ${formatMins(REPORT_RATE_MINUTES)} mins/order</span>`)
        .join("");
    rateSummary.innerHTML = entries;
    updateEstimatePreview();
}

// Process list follows agent.md. MAP and QC are not part of time estimation.
const allSteps = [...PROCESS_KEYS];
const empSteps = [...PROCESS_KEYS];

const initialMembers = [
    // Admin
    { name: 'admin', role: 'Admin', allowed: [...PROCESS_KEYS], status: 'Available', mins: 0, forceStatus: null },

    // Requesters (Sales users) - can order but will never be assigned work
    { name: 'sale1', role: 'User', allowed: [], acceptJobs: false, status: 'Available', mins: 0, forceStatus: null },
    { name: 'sale2', role: 'User', allowed: [], acceptJobs: false, status: 'Available', mins: 0, forceStatus: null },
    { name: 'sale3', role: 'User', allowed: [], acceptJobs: false, status: 'Available', mins: 0, forceStatus: null },
    { name: 'sale4', role: 'User', allowed: [], acceptJobs: false, status: 'Available', mins: 0, forceStatus: null },
    { name: 'sale5', role: 'User', allowed: [], acceptJobs: false, status: 'Available', mins: 0, forceStatus: null },
    
    // Employees (7) - start with no permissions; must be ticked in Manage Permissions.
    { name: 'joy', role: 'Employee', allowed: [], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'bboy', role: 'Employee', allowed: [], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'oil', role: 'Employee', allowed: [], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'june', role: 'Employee', allowed: [], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'phaifah', role: 'Employee', allowed: [], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'aunaun', role: 'Employee', allowed: [], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'nine', role: 'Employee', allowed: [], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    
    // Special Officer for QC:SENT
    { name: 'toom', role: 'Special Officer', allowed: ['QC:SENT'], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    
    // Officers - default to all permissions + QC.
    { name: 'x', role: 'Officer', allowed: ['QC', ...allSteps], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'first', role: 'Officer', allowed: ['QC', ...allSteps], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'chain', role: 'Officer', allowed: ['QC', ...allSteps], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'pla', role: 'Officer', allowed: ['QC', ...allSteps], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'gib', role: 'Officer', allowed: ['QC', ...allSteps], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'nee', role: 'Officer', allowed: ['QC', ...allSteps], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null },
    { name: 'puki', role: 'Officer', allowed: ['QC', ...allSteps], acceptJobs: true, status: 'Available', mins: 0, forceStatus: null }
];

let members = JSON.parse(JSON.stringify(initialMembers));
let jobs = [];
let archivedJobs = [];
let currentUser = null;
const APP_STORAGE_KEY = 'satops-dashboard-state-v1';
let suppressStateSave = false;
let currentCalendarDate = new Date();
let calendarControlsBound = false;

function saveAppState() {
    if(suppressStateSave) return;
    saveToFirestore();
}

// loadAppState removed - using Firestore instead

function normalizeMemberRoles() {
    members = members.map(member => {
        if(member.name !== 'toom') return member;
        return {
            ...member,
            role: 'Special Officer',
            allowed: ['QC:SENT']
        };
    });
}

normalizeMemberRoles();
if(currentUser) {
    currentUser = members.find(m => m.name === currentUser.name) || currentUser;
}

// ==========================================
// AUTHENTICATION
// ==========================================
const loginForm = document.getElementById('loginForm');
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('app');

function showAppForCurrentUser() {
    if(!currentUser) return;
    document.getElementById('currentUserDisplay').textContent = `👤 ${currentUser.name.toUpperCase()} (${currentUser.role})`;
    loginScreen.classList.remove('active');
    appScreen.style.display = 'block';
    
    // Only show Admin/Reset buttons for Admin role
    if(currentUser.role === 'Admin') {
        document.getElementById('adminBtn').style.display = 'block';
        document.getElementById('resetBtn').style.display = 'block';
    } else {
        document.getElementById('adminBtn').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'none';
    }
    
    initApp();
    renderNotificationsUI();
}

function resetAllData() {
    const ok = confirm('รีเซทข้อมูลทั้งหมด? (ลบ jobs ทั้งหมด)');
    if(!ok) return;
    
    jobs = [];
    archivedJobs = [];
    notifications = [];
    saveToFirestore();
    alert('รีเซทสำเร็จ');
    renderDashboard();
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('usernameInput').value.trim().toLowerCase();
    const password = document.getElementById('passwordInput').value;
    
    if(password !== '1234') {
        document.getElementById('loginError').textContent = 'Invalid password (use 1234)';
        return;
    }
    
    const user = members.find(m => m.name.toLowerCase() === username);
    if(!user) {
        document.getElementById('loginError').textContent = 'User not found.';
        return;
    }
    
    currentUser = user;
    saveAppState();
    showAppForCurrentUser();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    saveAppState();
    appScreen.style.display = 'none';
    loginScreen.classList.add('active');
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
});

document.getElementById('resetBtn').addEventListener('click', resetAllData);

// Auto logout after 10 minutes of inactivity
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function resetInactivityTimer() {
    if(inactivityTimer) clearTimeout(inactivityTimer);
    if(currentUser) {
        inactivityTimer = setTimeout(() => {
            console.log('Auto logout after 10 minutes of inactivity');
            currentUser = null;
            saveToFirestore();
            appScreen.style.display = 'none';
            loginScreen.classList.add('active');
            document.getElementById('usernameInput').value = '';
            document.getElementById('passwordInput').value = '';
        }, INACTIVITY_TIMEOUT);
    }
}

// Reset timer on user activity
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, { passive: true });
});

resetInactivityTimer();

// Wait for Firestore to load before showing app (don't show login on refresh)
let firestoreLoaded = false;
window.firestoreLoadedResolve = null;

window.waitForFirestore = new Promise(resolve => {
    window.firestoreLoadedResolve = resolve;
});

window.addEventListener('beforeunload', () => {
    if(suppressStateSave) return;
    saveAppState();
});

// ==========================================
// CORE LOGIC & SMART QUEUE
// ==========================================
function recalculateMembers() {
    // Reset all
    members.forEach(m => { m.mins = 0; if(!m.forceStatus) m.status = 'Available'; });
    
    jobs.forEach(job => {
        const worker = members.find(m => m.name === job.worker);
        const qc = members.find(m => m.name === (job.qcOfficer || job.qc));
        const special = members.find(m => m.name === (job.specialOfficer || job.specialQc));
        
        if(worker) {
            worker.mins += job.workerMins;
            if(!worker.forceStatus) worker.status = 'Busy';
        }
        if(qc) {
            qc.mins += job.qcImageMins || job.qcMins || 0;
            if(!qc.forceStatus) qc.status = 'Busy';
        }
        if(special) {
            special.mins += job.qcSentMins || job.specialMins || 0;
            if(!special.forceStatus) special.status = 'Busy';
        }
    });
}

function queueWorker(step, excludeName = null, isQC = false) {
    let candidates = members.filter(m => 
        (m.role === 'Employee' || m.role === 'Officer') &&
        m.status !== 'Offline' && 
        m.acceptJobs !== false &&
        m.allowed.includes(step) &&
        m.name !== excludeName // No self-QC
    );

    if(!candidates.length) return null;

    if(isQC) {
        // For QC, prioritize Available, then fallback to Busy
        let availableQC = candidates.filter(m => m.status === 'Available');
        if(availableQC.length > 0) candidates = availableQC;
    } else {
        // For Worker, MUST be Available
        candidates = candidates.filter(m => m.status === 'Available');
    }

    if(!candidates.length) return null;

    // Tie-breaker logic: sort by mins ASC, then random if equal
    candidates.sort((a, b) => {
        if(a.mins === b.mins) return Math.random() - 0.5;
        return a.mins - b.mins;
    });

    return candidates[0].name;
}

function queueWorkerForSteps(steps, excludeName = null) {
    const requiredSteps = Array.isArray(steps) ? steps.filter(Boolean) : [];
    if(requiredSteps.length === 0) return null;

    let candidates = members.filter(member =>
        (member.role === 'Employee' || member.role === 'Officer') &&
        member.status === 'Available' &&
        member.status !== 'Offline' &&
        member.acceptJobs !== false &&
        member.name !== excludeName &&
        requiredSteps.every(step => member.allowed.includes(step))
    );

    if(!candidates.length) return null;

    candidates.sort((a, b) => {
        if(a.mins === b.mins) return Math.random() - 0.5;
        return a.mins - b.mins;
    });

    return candidates[0].name;
}

function calculateDeadline(totalMins, startDate = new Date()) {
    const workDays = Math.ceil(totalMins / WORKDAY_MINUTES) + 1;
    return addWorkingDays(moveToNextWorkday(startDate), workDays);
}

function addMinutes(date, mins) {
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + mins);
    return next;
}

function isWeekend(value) {
    const day = new Date(value).getDay();
    return day === 0 || day === 6;
}

function moveToNextWorkday(value) {
    const next = new Date(value);
    while(isWeekend(next)) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

function addWorkingDays(date, days) {
    const next = new Date(date);
    let remaining = days;
    while(remaining > 0) {
        next.setDate(next.getDate() + 1);
        if(!isWeekend(next)) remaining -= 1;
    }
    return next;
}

function getJobAssignmentRole(job, name) {
    if(job.worker === name) return 'Worker';
    if(job.qcOfficer === name || job.qc === name) return 'Officer QC';
    if(job.specialOfficer === name || job.specialQc === name) return 'Special Officer';
    return null;
}

function jobMentionsMember(job, name) {
    return Boolean(getJobAssignmentRole(job, name));
}

function getJobMemberMinutes(job, name) {
    let mins = 0;
    if(job.worker === name) mins += Number(job.workerMins || job.estimatedMinutes || 0);
    if(job.qcOfficer === name || job.qc === name) mins += Number(job.qcMins || job.qcImageMins || 0);
    if(job.specialOfficer === name || job.specialQc === name) mins += Number(job.specialMins || job.qcSentMins || 0);
    return mins;
}

function getMemberBusyIntervals(name) {
    const sourceJobs = [...jobs, ...archivedJobs];
    const intervals = [];

    sourceJobs.forEach(job => {
        if(job.worker === name) {
            const start = new Date(job.workerStart || job.createdAt || job.startedAt || job.deadline || Date.now());
            const end = new Date(job.workerDeadline || job.deadline || job.completedAt || job.createdAt || Date.now());
            intervals.push({ start, end });
        }

        if((job.qcOfficer === name || job.qc === name) && job.qcImageStart && job.qcImageEnd) {
            intervals.push({
                start: new Date(job.qcImageStart),
                end: new Date(job.qcImageDeadline || job.qcImageEnd)
            });
        }

        if((job.specialOfficer === name || job.specialQc === name) && job.qcSentStart && job.qcSentEnd) {
            intervals.push({
                start: new Date(job.qcSentStart),
                end: new Date(job.qcSentEnd)
            });
        }
    });

    return intervals.sort((a, b) => a.start - b.start);
}

function findNextFreeStart(intervals, desiredStart, durationMins) {
    const durationMs = durationMins * 60 * 1000;
    let nextStart = new Date(desiredStart);
    let moved = true;

    while(moved) {
        moved = false;
        for(const interval of intervals) {
            const nextEnd = new Date(nextStart.getTime() + durationMs);
            const overlaps = nextStart < interval.end && nextEnd > interval.start;
            if(overlaps) {
                nextStart = new Date(interval.end);
                moved = true;
                break;
            }
        }
    }

    return nextStart;
}

function assignRoleTask(role, desiredStart, durationMins, excludeNames = [], requiredSteps = []) {
    const needed = Array.isArray(requiredSteps) ? requiredSteps.filter(Boolean) : [];
    const candidates = members.filter(member => {
        if(member.role !== role || member.status === 'Offline' || excludeNames.includes(member.name)) return false;
        if(member.acceptJobs === false) return false;
        if(!Array.isArray(member.allowed) || member.allowed.length === 0) return false; // must be ticked
        if(needed.length === 0) return true;
        return needed.every(step => member.allowed.includes(step));
    });

    if(!candidates.length) return null;

    let best = null;

    candidates.forEach(member => {
        const intervals = getMemberBusyIntervals(member.name);
        const start = findNextFreeStart(intervals, desiredStart, durationMins);
        const end = addMinutes(start, durationMins);
        const candidate = {
            name: member.name,
            start,
            end,
            currentLoad: member.mins || 0
        };

        if(!best) {
            best = candidate;
            return;
        }

        if(candidate.start < best.start) {
            best = candidate;
            return;
        }

        if(candidate.start.getTime() === best.start.getTime()) {
            if(candidate.currentLoad < best.currentLoad) {
                best = candidate;
                return;
            }

            if(candidate.currentLoad === best.currentLoad) {
                // When everything is equal, pick randomly to avoid sticking to the same person.
                if(Math.random() < 0.5) best = candidate;
            }
        }
    });

    return best;
}

function normalizeQueuePositions() {
    jobs
        .filter(job => job.status === 'pending')
        .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
        .forEach((job, index) => {
            job.queuePosition = index + 1;
        });
}

function parseOrderNumber(name) {
    const match = /^IMAP-(\d+)-(\d{4})$/.exec(name || '');
    return match ? { year: match[1], num: match[2] } : null;
}

function getUsedOrderNums(year) {
    const allOrders = [...jobs, ...archivedJobs];
    return new Set(
        allOrders
            .map(job => parseOrderNumber(job.name))
            .filter(Boolean)
            .filter(order => order.year === year)
            .map(order => order.num)
    );
}

function getNextAvailableOrderNum(year, preferredNum) {
    const used = getUsedOrderNums(year);
    if(preferredNum && !used.has(preferredNum)) return preferredNum;

    for(let i = 1; i <= 9999; i += 1) {
        const candidate = String(i).padStart(4, '0');
        if(!used.has(candidate)) return candidate;
    }

    throw new Error(`No available order numbers left for IMAP-${year}`);
}

// ==========================================
// NAVIGATION
// ==========================================
function navigateToPage(targetId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const tab = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
    if(tab) tab.classList.add('active');
    const page = document.getElementById(targetId);
    if(page) page.classList.add('active');

    renderPage(targetId);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        navigateToPage(targetId);
    });
});

const myWorkTopBtn = document.getElementById('myWorkTopBtn');
if(myWorkTopBtn) {
    myWorkTopBtn.addEventListener('click', () => navigateToPage('myWorkPage'));
}

const notifBtn = document.getElementById('notifBtn');
if(notifBtn) {
    notifBtn.addEventListener('click', () => openNotifications());
}
const notifMarkAllBtn = document.getElementById('notifMarkAllBtn');
if(notifMarkAllBtn) {
    notifMarkAllBtn.addEventListener('click', () => markAllNotificationsRead());
}

function initApp() {
    renderDashboard();
    setupOrderForm();
    setupCalendarControls();
    renderNotificationsUI();
}

function renderPage(pageId) {
    if(pageId === 'dashboardPage') renderDashboard();
    if(pageId === 'myWorkPage') renderMyWork();
    if(pageId === 'statusPage') renderStatus();
    if(pageId === 'calendarPage') renderCalendar();
    if(pageId === 'archivePage') renderArchive();
    if(pageId === 'summaryPage') renderSummary();
}

// ==========================================
// DASHBOARD
// ==========================================
function renderDashboard() {
    recalculateMembers();

    // Inbox: show rejected jobs for requester (คนสั่งงาน)
    const inbox = document.getElementById('inboxPanel');
    if(inbox) {
        const rejected = [...jobs, ...archivedJobs].filter(j => j.status === 'rejected' && j.requestedBy === currentUser.name);
        if(rejected.length === 0) {
            inbox.style.display = 'none';
        } else {
            inbox.style.display = 'block';
            inbox.innerHTML = `
              <div class="inbox-title">แจ้งเตือน</div>
              ${rejected.map(j => `
                <div class="inbox-item" onclick="openCalendarJobDetail('${j.id}')">
                  <strong>${escapeHtml(j.name)}</strong>
                  <div class="small">Rejected by ${escapeHtml(j.rejectedBy || j.worker || '-')} • ${escapeHtml(new Date(j.rejectedAt || j.completedAt || Date.now()).toLocaleString('th-TH'))}</div>
                  <div class="small">${escapeHtml(j.rejectReason || '-')}</div>
                </div>
              `).join('')}
            `;
        }
    }
    
    // Stats
    const avail = members.filter(m => m.status === 'Available').length;
    const busy = members.filter(m => m.status === 'Busy').length;
    const offline = members.filter(m => m.status === 'Offline').length;
    
    document.getElementById('statAvail').textContent = avail;
    document.getElementById('statBusy').textContent = busy;
    document.getElementById('statOffline').textContent = offline;
    document.getElementById('statJobs').textContent = jobs.length;

    // Admin Sidebar (only show if currentUser is Officer)
    const sidebar = document.getElementById('adminJobsSidebar');
    sidebar.style.display = currentUser.role === 'Officer' ? 'block' : 'none';
    
    if(currentUser.role === 'Officer') {
        const jobsList = document.getElementById('activeJobsList');
        jobsList.innerHTML = '';
        jobs.forEach((job, index) => {
            jobsList.innerHTML += `
                <div class="work-item" style="padding: 1rem; margin-bottom: 0.5rem; border-left-color: var(--accent2);">
                    <strong>${job.name}</strong><br>
                    <small>Worker: ${job.worker || '-'} | Officer: ${job.qcOfficer || job.qc || '-'} | Special: ${job.specialOfficer || job.specialQc || '-'} | Queue: ${job.queuePosition || '-'}</small>
                    <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
                        <button class="btn btn-primary" onclick="finishJob(${index})" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">จบงาน</button>
                        <button class="btn btn-outline" onclick="deleteJob(${index})" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; color: var(--red-text);">ลบ</button>
                    </div>
                </div>
            `;
        });
    }

    // Grids
    const empGrid = document.getElementById('employeesGrid');
    const offGrid = document.getElementById('officersGrid');
    const specialGrid = document.getElementById('specialOfficersGrid');
    empGrid.innerHTML = '';
    offGrid.innerHTML = '';
    if(specialGrid) specialGrid.innerHTML = '';

    members.forEach(m => {
        const proc = getMemberActiveProcess(m.name);
        const procHtml = proc
            ? `<div class="member-process" title="${escapeHtml(proc.jobName)}">${escapeHtml(proc.label)}</div>`
            : `<div class="member-process text-muted">ไม่มีงานที่กำลังทำ</div>`;
        const cardHtml = `
            <div class="member-card" onclick="openProfile('${m.name}')">
                <div class="member-header">
                    <span class="member-name">${m.name}</span>
                    <span class="status-badge ${m.status.toLowerCase()}">${m.status}</span>
                </div>
                <div class="member-role">${m.role}</div>
                <div style="margin-top:0.5rem; font-size:0.85rem; color:var(--text-muted);">
                    Load: ${m.mins} mins
                </div>
                ${procHtml}
                ${currentUser.role === 'Officer' ? `
                    <div class="admin-card-controls" onclick="event.stopPropagation()">
                        <button class="btn btn-outline" onclick="forceStatus('${m.name}', 'Offline')">ออฟไลน์</button>
                        <button class="btn btn-outline" onclick="forceStatus('${m.name}', null)">ออนไลน์</button>
                        <button class="btn btn-outline" onclick="clearMemberJobs('${m.name}')">Clear Jobs</button>
                    </div>
                ` : ''}
            </div>
        `;
        if(m.role === 'Employee') empGrid.innerHTML += cardHtml;
        else if(m.role === 'Special Officer' && specialGrid) specialGrid.innerHTML += cardHtml;
        else offGrid.innerHTML += cardHtml;
    });
}

// ==========================================
// MY WORK
// ==========================================
function renderMyWork() {
    const list = document.getElementById('myWorkList');
    list.innerHTML = '';
    
    const myJobs = currentUser.role === 'Employee'
        ? jobs.filter(j => j.worker === currentUser.name)
        : currentUser.role === 'Officer'
            ? jobs.filter(j => j.worker === currentUser.name || j.qcOfficer === currentUser.name || j.qc === currentUser.name)
            : currentUser.role === 'Special Officer'
                ? jobs.filter(j => j.specialOfficer === currentUser.name || j.specialQc === currentUser.name)
                : [];
    if(myJobs.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);">You have no active tasks.</p>';
        return;
    }

    myJobs.forEach((job, index) => {
        let notesHtml = (job.notes || []).map(n => `<div class="work-note">โน้ต: ${n}</div>`).join('');
        let qcFeedbackHtml = (job.qcFeedback || []).map(f => `<div class="work-note" style="border-left-color:var(--red-text);">QC ไม่ผ่าน: ${f.message} (${new Date(f.date).toLocaleString()})</div>`).join('');
        
        const roleLabel = currentUser.role === 'Employee'
            ? 'Worker'
            : currentUser.role === 'Officer'
                ? 'Officer QC'
                : 'Special Officer';
        const mins = currentUser.role === 'Employee'
            ? (job.workerMins || job.estimatedMinutes || 0)
            : currentUser.role === 'Officer'
                ? (job.qcMins || job.qcImageMins || 0)
                : (job.qcSentMins || job.specialMins || 0);
        
        const statusLabel = getStatusLabel(job.status);
        const statusColor = getStatusColor(job.status);
        
        let actionButtons = '';
        let bodyBlock = '';
        if(currentUser.role === 'Employee') {
            if(job.status === 'ordered') {
                const accepted = job.workerAccepted === true;
                if(!accepted) {
                    bodyBlock = renderWorkerOrderDetail(job);
                    actionButtons = `
                        <button class="btn btn-outline" onclick="openWorkerReject('${job.id}')">Reject</button>
                        <button class="btn btn-primary" onclick="workerAcceptJob('${job.id}')">Accept</button>
                    `;
                } else {
                    actionButtons = `<button class="btn btn-primary" onclick="startWorking('${job.id}')">▶ เริ่มทำงาน</button>`;
                    bodyBlock = `<div class="text-muted">รับงานแล้ว กด “เริ่มทำงาน” เพื่อเริ่มกรอกข้อมูลสำหรับส่งตรวจ</div>`;
                }
            } else if(job.status === 'working') {
                actionButtons = `
                    <button class="btn btn-outline" onclick="markWorkUpdated('${job.id}')">Update Work</button>
                    <button class="btn btn-primary" onclick="workerCommitToQC('${job.id}')">Commit ส่งตรวจ (QC)</button>
                `;
                bodyBlock = renderWorkerCommitBlock(job);
            } else if(job.status === 'special_check') {
                actionButtons = `<span style="color:var(--green-text);">✓ งานอนุมัติแล้ว รอแจ้งผู้สั่งงาน</span>`;
            } else if(job.status === 'completed') {
                actionButtons = `<span style="color:var(--text-muted);">งานเสร็จสิ้น</span>`;
            } else if(job.status === 'rejected') {
                actionButtons = `<span class="text-muted">งานถูก Reject แล้ว</span>`;
                bodyBlock = `<div class="text-muted">${escapeHtml(job.rejectReason || '')}</div>`;
            }
        } else if(currentUser.role === 'Officer') {
            if(job.status === 'qc_check') {
                const isAssigned = (job.qcOfficer === currentUser.name || job.qc === currentUser.name);
                bodyBlock = renderOfficerQCBlock(job, isAssigned);
                actionButtons = isAssigned ? `
                    <button class="btn btn-primary" id="officerCommitBtn-${job.id}" onclick="officerCommitQC('${job.id}')" disabled>Commit</button>
                    <button class="btn btn-outline" onclick="qcFail('${job.id}')" style="color:var(--red-text);">❌ ไม่ผ่าน</button>
                ` : `<span class="text-muted">งานนี้ถูกมอบหมายให้ ${escapeHtml(job.qcOfficer || job.qc || '-')}</span>`;
                // After render, update button enabled state
                setTimeout(() => updateOfficerCommitEnabled(job.id), 0);
            }
        } else if(currentUser.role === 'Special Officer') {
            if(job.status === 'special_check') {
                const isAssigned = (job.specialOfficer === currentUser.name || job.specialQc === currentUser.name);
                bodyBlock = renderSpecialOfficerBlock(job, isAssigned);
                actionButtons = isAssigned
                    ? `<button class="btn btn-primary" id="specialApproveBtn-${job.id}" onclick="specialOfficerApprove('${job.id}')" disabled>Approve</button>`
                    : `<span class="text-muted">งานนี้ถูกมอบหมายให้ ${escapeHtml(job.specialOfficer || job.specialQc || '-')}</span>`;
                setTimeout(() => updateSpecialApproveEnabled(job.id), 0);
            }
        }
        
        list.innerHTML += `
            <div class="work-item" id="mywork-${job.id}">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <h3>${job.name}</h3>
                    <span class="status-badge ${statusColor}">${statusLabel}</span>
                </div>
                <p><strong>Role:</strong> ${roleLabel} | <strong>Minutes:</strong> ${formatMins(mins)} | <strong>Images:</strong> ${job.imgCount}</p>
                <p><strong>Steps:</strong> ${job.steps.join(', ')}</p>
                ${qcFeedbackHtml}
                ${notesHtml}
                ${bodyBlock}

                <div style="margin-top:1rem; display:flex; gap:1rem; flex-wrap:wrap;">
                    ${actionButtons}
                </div>
            </div>
        `;
    });
}

function focusMyWorkJob(jobId) {
    const el = document.getElementById(`mywork-${jobId}`);
    if(!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('flash');
    // force reflow
    void el.offsetWidth;
    el.classList.add('flash');
    return true;
}

function renderWorkerOrderDetail(job) {
    return `
      <div class="work-block">
        <div class="work-block-title">รายละเอียดงาน</div>
        <div class="calendar-detail-grid" style="margin-top:0.5rem;">
          <div><strong>Satellite</strong><span>${escapeHtml(job.satellite || '-')}</span></div>
          <div><strong>Scene Count</strong><span>${escapeHtml(job.sceneCount ?? job.imgCount ?? '-')}</span></div>
          <div><strong>Processes</strong><span>${escapeHtml((job.steps || []).join(', ') || '-')}</span></div>
          <div><strong>Approver</strong><span>${escapeHtml(job.approver || '-')}</span></div>
          <div><strong>Rawdata Ready</strong><span>${escapeHtml(job.rawdataReady || '-')}</span></div>
          <div><strong>Requested By</strong><span>${escapeHtml(job.requestedBy || '-')}</span></div>
        </div>
        <div class="text-muted" style="margin-top:0.6rem;">กด Accept เพื่อรับงาน หรือ Reject เพื่อส่งกลับไปให้คนสั่งงาน</div>
      </div>
    `;
}

let activeWorkerRejectJobId = null;

function openWorkerReject(jobId) {
    const job = findJobById(jobId);
    if(!job) return;
    activeWorkerRejectJobId = jobId;
    const info = document.getElementById('wrInfo');
    if(info) info.textContent = `${job.name} • ${job.satellite || '-'} • ${job.imgCount} scenes`;
    const reason = document.getElementById('wrReason');
    if(reason) reason.value = '';
    const btn = document.getElementById('wrConfirmBtn');
    if(btn) {
        btn.onclick = () => workerRejectJob(jobId);
    }
    openModal('workerRejectModal');
}

function workerRejectJob(jobId) {
    const job = findJobById(jobId);
    if(!job) return;
    const reason = document.getElementById('wrReason')?.value.trim();
    if(!reason) {
        alert('กรุณากรอกเหตุผล/รายละเอียดก่อน Reject');
        return;
    }

    job.status = 'rejected';
    job.rejectedBy = currentUser.name;
    job.rejectedAt = new Date().toISOString();
    job.rejectReason = reason;
    job.completedAt = job.rejectedAt;

    // Remove from active jobs list and move to archive so it won't keep blocking queue.
    if(jobs.some(j => j.id === jobId)) {
        archivedJobs.push(job);
        jobs = jobs.filter(j => j.id !== jobId);
        normalizeQueuePositions();
    }

    saveAppState();
    // Notify requester (คนสั่งงาน) if present
    if(job.requestedBy) {
        notifyUserOfJob(job.requestedBy, job.id, 'งานถูก Reject', `${job.name} ถูก Reject โดย ${currentUser.name}`);
    }
    closeModal('workerRejectModal');
    renderMyWork();
    renderDashboard();
}

function workerAcceptJob(jobId) {
    const job = findJobById(jobId);
    if(!job) return;
    job.workerAccepted = true;
    job.workerAcceptedAt = new Date().toISOString();
    saveAppState();
    // Start working immediately so the worker sees the form right away.
    startWorking(jobId);
}

function addPathInput(jobId) {
    const container = document.getElementById(`paths-${jobId}`);
    const row = document.createElement('div');
    row.className = 'path-row';
    row.innerHTML = `<input type="text" placeholder="New Path">`;
    container.appendChild(row);
}

function markWorkUpdated(jobId) {
    const job = findJobById(jobId);
    if(!job) return;
    const paths = readWorkerPathsFromDom(jobId);
    job.workPaths = paths;
    job.workUpdatedAt = new Date().toISOString();
    saveAppState();
    renderMyWork();
}

function readWorkerPathsFromDom(jobId) {
    const container = document.getElementById(`paths-${jobId}`);
    if(!container) return [];
    return Array.from(container.querySelectorAll('input'))
        .map(i => (i.value || '').trim())
        .filter(Boolean);
}

function renderWorkerCommitBlock(job) {
    const saved = Array.isArray(job.workPaths) ? job.workPaths : [];
    const v = (idx) => saved[idx] || '';
    const extra = saved.slice(4);
    const extraRows = extra.map((p) => `<div class="path-row"><input type="text" value="${escapeHtml(p)}" placeholder="New Path"></div>`).join('');

    return `
      <div class="work-block">
        <div class="work-block-title">Worker: กรอกข้อมูลส่งตรวจ</div>
        <div class="path-inputs" id="paths-${job.id}">
            <div class="path-row"><input type="text" value="${escapeHtml(v(0))}" placeholder="REFERENCE Path"></div>
            <div class="path-row"><input type="text" value="${escapeHtml(v(1))}" placeholder="RPC/Rec/Resampling/ORTHO Path"></div>
            <div class="path-row"><input type="text" value="${escapeHtml(v(2))}" placeholder="ENHANCE Path"></div>
            <div class="path-row"><input type="text" value="${escapeHtml(v(3))}" placeholder="MOSAIC Path"></div>
            ${extraRows}
        </div>
        <div style="margin-top:0.75rem;">
          <button class="btn btn-outline" onclick="addPathInput('${job.id}')">+ เพิ่มช่องข้อมูล</button>
        </div>
      </div>
    `;
}

function workerCommitToQC(jobId) {
    const job = findJobById(jobId);
    if(!job) return;

    // Save latest form values first
    const paths = readWorkerPathsFromDom(jobId);
    job.workPaths = paths;
    job.workCommittedAt = new Date().toISOString();

    // Require 4 main fields (reference/rpc/enhance/mosaic) before commit
    const container = document.getElementById(`paths-${jobId}`);
    const inputs = container ? Array.from(container.querySelectorAll('input')).slice(0, 4) : [];
    const coreOk = inputs.length === 4 && inputs.every(i => (i.value || '').trim().length > 0);
    if(!coreOk) {
        alert('กรุณากรอก 4 ช่องหลักให้ครบ (REFERENCE / RPC/ORTHO / ENHANCE / MOSAIC) ก่อน Commit');
        return;
    }

    saveAppState();

    // Then move workflow to QC
    submitToQC(jobId);
}

const OFFICER_QC_CHECK_KEYS = [
    'Image File',
    'Log File',
    'File Format',
    'File Type',
    'Coordinate System'
];

const SPECIAL_OFFICER_CHECK_KEYS = [
    'ความครบถ้วนรายละเอียด',
    'ความสว่าง',
    'ความคมชัดและสี',
    'ขอบของข้อมูลภาพ',
    'พื้นหลังข้อมูลภาพ',
    'Compression'
];

function ensureChecklist(job, kind) {
    const key = (kind === 'officer') ? 'officerQcChecklist' : 'specialOfficerChecklist';
    const defaults = (kind === 'officer') ? OFFICER_QC_CHECK_KEYS : SPECIAL_OFFICER_CHECK_KEYS;
    if(!job[key] || typeof job[key] !== 'object') job[key] = {};
    defaults.forEach(k => { if(job[key][k] !== true) job[key][k] = false; });
    return job[key];
}

function renderChecklist(job, kind, enabled) {
    const list = ensureChecklist(job, kind);
    const keys = (kind === 'officer') ? OFFICER_QC_CHECK_KEYS : SPECIAL_OFFICER_CHECK_KEYS;
    const title = (kind === 'officer') ? 'Officer QC: ตรวจสอบก่อน Commit' : 'Special Officer: ตรวจสอบก่อน Approve';
    const rowFn = (k) => {
        const checked = list[k] === true ? 'checked' : '';
        const dis = enabled ? '' : 'disabled';
        const onChange = enabled
            ? `onchange="${kind}ChecklistToggle('${job.id}', '${escapeHtml(k)}', this.checked)"`
            : '';
        return `<label class="check-row"><input type="checkbox" ${checked} ${dis} ${onChange} /> <span>${escapeHtml(k)}</span></label>`;
    };

    return `
      <div class="work-block">
        <div class="work-block-title">${escapeHtml(title)}</div>
        <div class="check-grid">
          ${keys.map(rowFn).join('')}
        </div>
        <div class="text-muted" style="margin-top:0.5rem;">ต้องติ๊กให้ครบทุกข้อเท่านั้นถึงจะกด Commit/Approve ได้</div>
      </div>
    `;
}

function renderOfficerQCBlock(job, enabled) {
    return renderChecklist(job, 'officer', enabled);
}

function renderSpecialOfficerBlock(job, enabled) {
    return renderChecklist(job, 'special', enabled);
}

function officerChecklistToggle(jobId, key, checked) {
    const job = findJobById(jobId);
    if(!job) return;
    const list = ensureChecklist(job, 'officer');
    list[key] = !!checked;
    job.officerQcChecklist = list;
    saveAppState();
    updateOfficerCommitEnabled(jobId);
}

function specialChecklistToggle(jobId, key, checked) {
    const job = findJobById(jobId);
    if(!job) return;
    const list = ensureChecklist(job, 'special');
    list[key] = !!checked;
    job.specialOfficerChecklist = list;
    saveAppState();
    updateSpecialApproveEnabled(jobId);
}

function isAllChecked(obj, keys) {
    return keys.every(k => obj && obj[k] === true);
}

function updateOfficerCommitEnabled(jobId) {
    const job = findJobById(jobId);
    const btn = document.getElementById(`officerCommitBtn-${jobId}`);
    if(!job || !btn) return;
    const list = ensureChecklist(job, 'officer');
    btn.disabled = !isAllChecked(list, OFFICER_QC_CHECK_KEYS);
}

function updateSpecialApproveEnabled(jobId) {
    const job = findJobById(jobId);
    const btn = document.getElementById(`specialApproveBtn-${jobId}`);
    if(!job || !btn) return;
    const list = ensureChecklist(job, 'special');
    btn.disabled = !isAllChecked(list, SPECIAL_OFFICER_CHECK_KEYS);
}

function officerCommitQC(jobId) {
    const job = findJobById(jobId);
    if(!job) return;
    const list = ensureChecklist(job, 'officer');
    if(!isAllChecked(list, OFFICER_QC_CHECK_KEYS)) {
        alert('กรุณาติ๊ก Officer QC ให้ครบทุกข้อก่อน Commit');
        return;
    }
    job.officerCommittedAt = new Date().toISOString();
    saveAppState();
    qcPass(jobId);
}

function specialOfficerApprove(jobId) {
    const job = findJobById(jobId);
    if(!job) return;
    const list = ensureChecklist(job, 'special');
    if(!isAllChecked(list, SPECIAL_OFFICER_CHECK_KEYS)) {
        alert('กรุณาติ๊ก Special Officer ให้ครบทุกข้อก่อน Approve');
        return;
    }
    job.specialCommittedAt = new Date().toISOString();
    saveAppState();
    specialApprove(jobId);
}

function setupCalendarControls() {
    if(calendarControlsBound) return;
    calendarControlsBound = true;

    document.getElementById('calendarTodayBtn')?.addEventListener('click', () => {
        currentCalendarDate = new Date();
        renderCalendar();
    });

    document.getElementById('calendarPrevBtn')?.addEventListener('click', () => {
        currentCalendarDate = addMonths(currentCalendarDate, -1);
        renderCalendar();
    });

    document.getElementById('calendarNextBtn')?.addEventListener('click', () => {
        currentCalendarDate = addMonths(currentCalendarDate, 1);
        renderCalendar();
    });
}

function formatDayLabel(value) {
    if(!value) return '-';
    return new Date(value).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTimeLabel(value) {
    if(!value) return '-';
    return new Date(value).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMonthLabel(value) {
    return new Date(value).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });
}

function toStartOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function startOfMonth(value) {
    const date = toStartOfDay(value);
    date.setDate(1);
    return date;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function addMonths(date, months) {
    const next = new Date(date);
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    return next;
}

function dayDiff(a, b) {
    const ms = 24 * 60 * 60 * 1000;
    return Math.round((toStartOfDay(b) - toStartOfDay(a)) / ms);
}

function sameDay(a, b) {
    return toStartOfDay(a).getTime() === toStartOfDay(b).getTime();
}

function getJobCalendarBounds(job) {
    const start = toStartOfDay(job.workerStart || job.createdAt || job.startedAt || job.deadline || new Date());
    const end = toStartOfDay(job.qcSentEnd || job.finalDeadline || job.qcSentStart || job.qcImageDeadline || job.qcImageEnd || job.deadline || job.completedAt || job.createdAt || new Date());
    return { start, end };
}

function getJobTimeline(job) {
    const workerStart = new Date(job.workerStart || job.createdAt || job.startedAt || job.deadline || Date.now());
    const workerEnd = new Date(job.workerDeadline || job.deadline || job.completedAt || job.createdAt || workerStart);
    const officerStart = new Date(job.qcImageStart || workerEnd);
    const officerEnd = new Date(job.qcImageDeadline || job.qcImageEnd || officerStart);
    const specialStart = officerStart;
    const specialEnd = officerEnd;
    return { workerStart, workerEnd, officerStart, officerEnd, specialStart, specialEnd };
}

function overlapsRange(start, end, rangeStart, rangeEnd) {
    return start <= rangeEnd && end >= rangeStart;
}

// ==========================================
// STATUS
// ==========================================
function getMemberActiveProcess(memberName) {
    // Employee primary work
    const asWorker = jobs.find(j => (j.worker === memberName) && (j.status === 'ordered' || j.status === 'working'));
    if(asWorker) {
        const label = asWorker.status === 'ordered'
            ? 'รอเริ่มงาน: กำลังปรับแก้ภาพถ่ายดาวเทียม'
            : 'กำลังปรับแก้ภาพถ่ายดาวเทียม';
        return { label, jobName: asWorker.name, role: 'Employee' };
    }

    // Officer QC work
    const asOfficer = jobs.find(j => (j.qcOfficer === memberName || j.qc === memberName) && j.status === 'qc_check');
    if(asOfficer) {
        return { label: 'อยู่ระหว่างตรวจสอบคุณภาพผลิตภัณฑ์ (QC)', jobName: asOfficer.name, role: 'Officer' };
    }

    const officerQueued = jobs.find(j => (j.qcOfficer === memberName || j.qc === memberName) && (j.status === 'ordered' || j.status === 'working'));
    if(officerQueued) {
        return { label: 'รอคิวตรวจสอบคุณภาพผลิตภัณฑ์ (QC)', jobName: officerQueued.name, role: 'Officer' };
    }

    // Special Officer approve before send
    const asSpecial = jobs.find(j => (j.specialOfficer === memberName || j.specialQc === memberName) && j.status === 'special_check');
    if(asSpecial) {
        return { label: 'อยู่ระหว่างตรวจสอบคุณภาพผลิตภัณฑ์ (Approve ก่อนส่ง)', jobName: asSpecial.name, role: 'Special Officer' };
    }

    const specialQueued = jobs.find(j => (j.specialOfficer === memberName || j.specialQc === memberName) && (j.status === 'ordered' || j.status === 'working' || j.status === 'qc_check'));
    if(specialQueued) {
        return { label: 'รอคิวตรวจสอบคุณภาพผลิตภัณฑ์ (Approve ก่อนส่ง)', jobName: specialQueued.name, role: 'Special Officer' };
    }

    return null;
}

function renderStatus() {
    const list = document.getElementById('statusList');
    if(!list) return;

    list.innerHTML = '';

    const activeJobs = [...jobs].sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
    if(activeJobs.length === 0) {
        list.innerHTML = `<p class="text-muted">ไม่มีออเดอร์ที่กำลังทำอยู่</p>`;
        return;
    }

    activeJobs.forEach(job => {
        const status = getStatusLabel(job.status);
        const statusClass = getStatusColor(job.status);

        let processLabel = 'รอเริ่มงาน';
        let processOwner = job.worker || '-';
        if(job.status === 'ordered' || job.status === 'working') {
            processLabel = 'กำลังปรับแก้ภาพถ่ายดาวเทียม (Employee)';
            processOwner = job.worker || '-';
        } else if(job.status === 'qc_check') {
            processLabel = 'อยู่ระหว่างตรวจสอบคุณภาพผลิตภัณฑ์ (Officer QC)';
            processOwner = job.qcOfficer || job.qc || '-';
        } else if(job.status === 'special_check') {
            processLabel = 'อยู่ระหว่างตรวจสอบคุณภาพผลิตภัณฑ์ (Special Officer Approve ก่อนส่ง)';
            processOwner = job.specialOfficer || job.specialQc || '-';
        } else if(job.status === 'completed') {
            processLabel = 'เสร็จสิ้น';
            processOwner = '-';
        }

        const steps = (job.steps || []).join(', ');
        list.innerHTML += `
          <div class="status-card" onclick="openCalendarJobDetail('${job.id}')">
            <div class="status-card-top">
              <div>
                <div class="status-name">${escapeHtml(job.name)}</div>
                <div class="status-role">${escapeHtml(job.satellite)} | ${escapeHtml(job.imgCount)} scenes</div>
              </div>
              <div class="status-badges">
                <span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
              </div>
            </div>
            <div class="status-process">
              <div class="status-process-title">${escapeHtml(processLabel)}</div>
              <div class="status-process-sub">${escapeHtml(processOwner)}</div>
            </div>
            <div class="status-process" style="margin-top:8px;">
              <div class="status-process-title">Steps</div>
              <div class="status-process-sub">${escapeHtml(steps || '-')}</div>
            </div>
          </div>
        `;
    });
}

function renderCalendar() {
    const list = document.getElementById('calendarList');
    const title = document.getElementById('calendarTitle');
    if(!list) return;

    const monthStart = startOfMonth(currentCalendarDate);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const calendarJobs = [];
    [...jobs, ...archivedJobs].forEach(job => {
        const timeline = getJobTimeline(job);
        calendarJobs.push({
            job,
            type: 'employee',
            label: 'Employee',
            name: job.worker || '-',
            start: toStartOfDay(timeline.workerStart),
            end: toStartOfDay(timeline.workerEnd)
        });
        calendarJobs.push({
            job,
            type: 'officer',
            label: 'Officer',
            name: job.qcOfficer || job.qc || '-',
            start: toStartOfDay(timeline.officerStart),
            end: toStartOfDay(timeline.officerEnd)
        });
        calendarJobs.push({
            job,
            type: 'special',
            label: 'Special',
            name: job.specialOfficer || job.specialQc || '-',
            start: toStartOfDay(timeline.specialStart),
            end: toStartOfDay(timeline.specialEnd)
        });
    });
    calendarJobs.sort((a, b) => a.start - b.start || a.end - b.end);

    if(title) title.textContent = formatMonthLabel(monthStart);

    const weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(day => `<div class="calendar-weekday">${day}</div>`)
        .join('');

    const weeks = Array.from({ length: 6 }, (_, weekIndex) => {
        const weekStart = addDays(gridStart, weekIndex * 7);
        const weekEnd = addDays(weekStart, 6);
        const weekDays = Array.from({ length: 7 }, (_, dayIndex) => addDays(weekStart, dayIndex));
        const weekItems = calendarJobs
            .filter(item => overlapsRange(item.start, item.end, weekStart, weekEnd))
            .map(item => {
                const startCol = Math.max(0, dayDiff(weekStart, item.start));
                const endCol = Math.min(6, dayDiff(weekStart, item.end));
                const span = Math.max(1, endCol - startCol + 1);
                return { ...item, startCol, endCol, span };
            })
            .sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);

        const lanes = [];
        const laneItems = weekItems.map(item => {
            let laneIndex = lanes.findIndex(lastEnd => item.startCol > lastEnd);
            if(laneIndex === -1) {
                laneIndex = lanes.length;
                lanes.push(item.endCol);
            } else {
                lanes[laneIndex] = item.endCol;
            }
            return { ...item, laneIndex };
        });

        const rowHeight = Math.max(132, 58 + (lanes.length * 36));

        const dayCells = weekDays.map(day => {
            const isCurrentMonth = day.getMonth() === monthStart.getMonth();
            const isToday = sameDay(day, new Date());
            return `
                <div class="calendar-day-cell ${isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}">
                    <div class="calendar-day-number">${day.getDate()}</div>
                </div>
            `;
        }).join('');

        const eventBars = laneItems.map(item => {
            const { job, type, label, name, start, end } = item;
            const status = job.status || (archivedJobs.some(j => j.id === job.id) ? 'completed' : 'pending');
            const left = (item.startCol / 7) * 100;
            const width = (item.span / 7) * 100;
            const top = 10 + (item.laneIndex * 36);
            return `
                <button
                    class="calendar-week-event type-${type} ${status === 'completed' ? 'done' : 'active'}"
                    type="button"
                    data-job-id="${job.id}"
                    style="left:${left}%; width:${width}%; top:${top}px; height:28px; padding:0 0.4rem; justify-content:center;"
                    title="${label}: ${formatDayLabel(start)} - ${formatDayLabel(end)} | ${name} | ${job.name}"
                >
                    <div class="role-row ${type}">
                        <span class="role-dot"></span>
                        <span class="role-text"><strong>${label}</strong>: ${formatDayLabel(start)} ถึง ${formatDayLabel(end)} | ${name} | ${job.name}</span>
                    </div>
                </button>
            `;
        }).join('');

        return `
            <div class="calendar-week-block" style="min-height:${rowHeight}px;">
                <div class="calendar-week-cells">${dayCells}</div>
                <div class="calendar-week-event-layer">${eventBars}</div>
            </div>
        `;
    }).join('');

    list.innerHTML = `
        <div class="calendar-month-grid">
            <div class="calendar-week-row">
                ${weekdayHeaders}
            </div>
            <div class="calendar-weeks">
                ${weeks}
            </div>
        </div>
    `;

    list.querySelectorAll('.calendar-week-event').forEach(chip => {
        chip.addEventListener('click', () => openCalendarJobDetail(chip.dataset.jobId));
    });
}

// ==========================================
// ORDER FORM
// ==========================================
function setupOrderForm() {
    document.getElementById('orderSat').addEventListener('change', updateRateAvailability);
    document.getElementById('orderImgCount').addEventListener('input', updateEstimatePreview);
    document.querySelectorAll('#orderForm input[type="radio"], #orderForm input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', updateEstimatePreview);
    });
    updateRateAvailability();

    document.getElementById('orderForm').onsubmit = (e) => {
        e.preventDefault();
        
        const year = document.getElementById('orderYear').value.trim();
        const num = document.getElementById('orderNum').value.trim();
        const uniqueNum = getNextAvailableOrderNum(year, num.padStart(4, '0'));
        if(uniqueNum !== num.padStart(4, '0')) {
            document.getElementById('orderNum').value = uniqueNum;
        }
        const name = `IMAP-${year}-${uniqueNum}`;
        
        const satellite = document.getElementById('orderSat').value;
        const imgCount = parseInt(document.getElementById('orderImgCount').value);
        
        // Collect form data
        const selectedSteps = getSelectedProcessesFromForm();
        const processTypes = selectedSteps.filter(step => ['PAN', 'MS', 'PSP'].includes(step));
        const supportedProcessTypes = ['PAN', 'MS', 'PSP'].filter(step => getStepRate(satellite, step) !== null);
        if(supportedProcessTypes.length > 0 && processTypes.length === 0) {
            alert('กรุณาเลือกกระบวนการ (PAN, MS, PSP) อย่างน้อย 1 อย่าง');
            return;
        }

        // Build Worker Steps Array
        let wSteps = [...selectedSteps];

        if(wSteps.length === 0) {
            alert('เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธฑเนเธเธ•เธญเธเธเธฒเธเธญเธขเนเธฒเธเธเนเธญเธข 1 เธฃเธฒเธขเธเธฒเธฃ');
            return;
        }

        const unavailable = unsupportedSteps(satellite, selectedSteps);
        if(unavailable.length) {
            alert(`ขั้นตอนเหล่านี้ไม่รองรับสำหรับดาวเทียม ${satellite}: ${unavailable.join(', ')}`);
            updateRateAvailability();
            return;
        }

        // Find primary worker (must have permissions for all selected steps)
        let worker = queueWorkerForSteps(wSteps);
        if(!worker) {
            alert('No Available worker found (missing permissions for selected steps)');
            return;
        }

        // Agent.md logic: estimatedMinutes = sum(process time per scene) * scene count.
        const estimatedMinutes = calculateStepsMins(satellite, selectedSteps, imgCount);
        const workerMins = estimatedMinutes;
        const createdAt = new Date();
        const workerStart = moveToNextWorkday(createdAt);
        const workerDeadline = calculateDeadline(workerMins, workerStart);

        const qcImageMins = imgCount * OFFICER_QC_MINUTES_PER_IMAGE;
        const combinedMins = qcImageMins + SPECIAL_OFFICER_SENT_MINUTES;
        const officerStart = moveToNextWorkday(addWorkingDays(workerDeadline, 1));
        const combinedEnd = addMinutes(officerStart, combinedMins);
        // Officer QC assignment only requires QC permission + acceptJobs toggle.
        const officerTask = assignRoleTask('Officer', officerStart, combinedMins, [worker], ['QC']);
        if(!officerTask) {
            alert('No available Officer found for image QC');
            return;
        }

        const qcStart = officerTask.start;
        const qcEnd = officerTask.end;
        const sentStart = qcStart;
        const sentEnd = qcEnd;
        const queuePosition = jobs.filter(j => j.status === 'pending').length + 1;

        const draftJob = {
            id: 'JOB' + Date.now(),
            status: 'pending',
            name, 
            satellite,
            sceneCount: imgCount,
            imgCount, 
            steps: selectedSteps,
            selectedProcesses: selectedSteps,
            workerSteps: wSteps,
            qcSteps: [],
            worker, workerStart: workerStart.toISOString(), workerDeadline: workerDeadline.toISOString(),
            workerMins,
            qc: officerTask.name,
            qcOfficer: officerTask.name,
            qcImageStart: qcStart.toISOString(),
            qcImageEnd: qcEnd.toISOString(),
            qcImageDeadline: calculateDeadline(qcImageMins, qcStart).toISOString(),
            qcMins: qcImageMins,
            qcImageMins,
            specialOfficer: 'toom',
            specialQc: 'toom',
            qcSentStart: sentStart.toISOString(),
            qcSentEnd: sentEnd.toISOString(),
            qcSentMins: SPECIAL_OFFICER_SENT_MINUTES,
            specialMins: SPECIAL_OFFICER_SENT_MINUTES,
            estimatedMinutes,
            queuePosition,
            deadline: officerTask.end.toISOString(),
            finalDeadline: officerTask.end.toISOString(),
            notes: [],
            createdAt: createdAt.toISOString(),
            status: 'ordered',
            rawdataReady: document.querySelector('input[name="rawdataReady"]:checked')?.value || 'No',
            approver: document.getElementById('orderApprover').value,
            requestedBy: currentUser?.name || null
        };

        showOrderConfirm(draftJob);
    };
}

function showOrderConfirm(draft) {
    document.getElementById('ocBody').innerHTML = `
        <p><strong>Project:</strong> ${draft.name}</p>
        <p><strong>Satellite:</strong> ${draft.satellite}</p>
        <p><strong>Scene Count:</strong> ${draft.sceneCount}</p>
        <div style="margin: 1rem 0; padding: 1rem; background: var(--bg2); border-radius: 8px;">
            <p><strong>Worker Assigned:</strong> <span class="status-badge available">${draft.worker}</span></p>
            <p><strong>Officer QC:</strong> <span class="status-badge available">${draft.qcOfficer || '-'}</span></p>
            <p><strong>Special Officer:</strong> <span class="status-badge available">${draft.specialOfficer || '-'}</span></p>
            <p><strong>Queue Position:</strong> ${draft.queuePosition}</p>
            <p><strong>วาง Rawdata แล้ว:</strong> <span class="status-badge ${draft.rawdataReady === 'Yes' ? 'available' : 'busy'}">${draft.rawdataReady}</span></p>
            <p><strong>ผู้อนุมัติ:</strong> <span class="status-badge available">${draft.approver || '-'}</span></p>
        </div>
        <p><strong>Selected Processes:</strong> ${draft.selectedProcesses.join(', ')}</p>
        <p><strong>Estimated Minutes:</strong> ${formatMins(draft.estimatedMinutes)} mins</p>
        <p><strong>Estimated Completed At:</strong> ${new Date(draft.deadline).toLocaleString()}</p>
    `;
    
    document.getElementById('ocConfirmBtn').onclick = () => {
        jobs.push(draft);
        saveAppState();
        closeModal('orderConfirmModal');
        document.getElementById('orderForm').reset();
        // Set default values back
        document.getElementById('orderYear').value = '69';
        document.getElementById('orderNum').value = '0001';
        updateRateAvailability();
        
        // Show summary/ใบสรุป
        showOrderSummary(draft);

        // Notify assigned worker
        notifyUserOfJob(draft.worker, draft.id, `มีงานใหม่ส่งให้คุณ`, `${draft.name} (${draft.satellite}) จำนวน ${draft.imgCount} ภาพ`);
    };
    
    openModal('orderConfirmModal');
}

// ==========================================
// NOTIFICATIONS
// ==========================================
function makeId(prefix) {
    return `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function notifyUserOfJob(toUser, jobId, title, message) {
    if(!toUser) return;
    const job = findJobById(jobId);
    const jobName = job?.name || '';
    notifications.unshift({
        id: makeId('N'),
        to: String(toUser),
        jobId,
        jobName,
        title,
        message,
        createdAt: new Date().toISOString(),
        readAt: null
    });
    saveAppState();
    renderNotificationsUI();
}

function getMyNotifications() {
    if(!currentUser) return [];
    return notifications.filter(n => n && n.to === currentUser.name);
}

function getUnreadCount() {
    return getMyNotifications().filter(n => !n.readAt).length;
}

function renderNotificationsUI() {
    const btn = document.getElementById('notifBtn');
    const badge = document.getElementById('notifBadge');
    if(!btn || !badge) return;
    const count = getUnreadCount();
    if(count > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = String(count);
    } else {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
}

function openNotifications() {
    const listEl = document.getElementById('notifList');
    if(!listEl) return;
    const items = getMyNotifications();
    if(items.length === 0) {
        listEl.innerHTML = `<div class="text-muted">ยังไม่มีการแจ้งเตือน</div>`;
        openModal('notificationsModal');
        return;
    }

    listEl.innerHTML = items.map(n => {
        const unread = !n.readAt;
        const when = n.createdAt ? new Date(n.createdAt).toLocaleString('th-TH') : '';
        return `
          <div class="notif-item ${unread ? 'unread' : ''}" onclick="openNotificationTarget('${n.id}')">
            <div class="notif-dot"></div>
            <div class="notif-main">
              <div class="notif-title">${escapeHtml(n.title || 'Notification')}</div>
              <div class="notif-meta">${escapeHtml(n.message || '')}</div>
              <div class="notif-meta">${escapeHtml(when)}</div>
            </div>
          </div>
        `;
    }).join('');

    openModal('notificationsModal');
}

function markNotificationRead(id) {
    const n = notifications.find(x => x && x.id === id);
    if(!n) return;
    if(!n.readAt) n.readAt = new Date().toISOString();
    saveAppState();
    renderNotificationsUI();
}

function openNotificationTarget(id) {
    const n = notifications.find(x => x && x.id === id);
    if(!n) return;
    markNotificationRead(id);
    closeModal('notificationsModal');
    navigateToPage('myWorkPage');
    if(n.jobId) {
        setTimeout(() => {
            // Render first, then jump to the Accept/Reject card (Worker) or the relevant task card.
            renderMyWork();
            setTimeout(() => focusMyWorkJob(n.jobId), 50);
        }, 120);
    }
}

function markAllNotificationsRead() {
    const mine = getMyNotifications();
    const now = new Date().toISOString();
    mine.forEach(n => { if(!n.readAt) n.readAt = now; });
    saveAppState();
    renderNotificationsUI();
    openNotifications();
}

function escapeHtml(text) {
    return String(text ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatDateOnly(value) {
    const d = new Date(value);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildOrderReceiptText(job) {
    const lines = [];
    lines.push('NexaIMAP - Order Receipt');
    lines.push(`Order: ${job.name}`);
    lines.push(`Created: ${new Date(job.createdAt).toLocaleString('th-TH')}`);
    lines.push(`Satellite: ${job.satellite}`);
    lines.push(`Scenes: ${job.imgCount}`);
    lines.push(`Rawdata Ready: ${job.rawdataReady || '-'}`);
    lines.push(`Approver: ${job.approver || '-'}`);
    lines.push(`Steps: ${(job.steps || []).join(', ')}`);
    lines.push('');
    lines.push(`Employee: ${job.worker || '-'} | ${formatDateOnly(job.workerStart)} - ${formatDateOnly(job.workerDeadline)} | ${formatMins(job.workerMins)} mins`);
    lines.push(`Officer(QC): ${job.qcOfficer || job.qc || '-'} | ${formatDateOnly(job.qcImageStart)} - ${formatDateOnly(job.qcImageEnd)} | ${formatMins(job.qcImageMins)} mins`);
    lines.push(`Special Officer(QC:SENT): ${job.specialOfficer || job.specialQc || '-'} | ${formatDateOnly(job.qcSentStart)} - ${formatDateOnly(job.qcSentEnd)} | ${formatMins(job.qcSentMins)} mins`);
    lines.push('');
    lines.push(`Final deadline: ${new Date(job.finalDeadline || job.deadline).toLocaleString('th-TH')}`);
    return lines.join('\n');
}

function openPrintWindow(title, html) {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if(!w) {
        alert('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ (อาจโดนบล็อก pop-up)');
        return;
    }
    w.document.open();
    w.document.write(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #111827; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin: 12px 0 18px; font-size: 13px; }
      .meta div { padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 8px; }
      .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .table th, .table td { border: 1px solid #E5E7EB; padding: 8px 10px; font-size: 13px; text-align: left; vertical-align: top; }
      .table th { background: #F9FAFB; }
      .small { color: #6B7280; font-size: 12px; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>
    ${html}
    <script>
      window.addEventListener('load', () => { setTimeout(() => window.print(), 50); });
    </script>
  </body>
</html>`);
    w.document.close();
}

function showOrderSummary(job) {
    const osBody = document.getElementById('osBody');
    if(!osBody) return;

    const steps = (job.steps || []).join(', ');
    const createdLabel = new Date(job.createdAt).toLocaleString('th-TH');
    const finalDl = new Date(job.finalDeadline || job.deadline).toLocaleString('th-TH');

    const employeeRow = {
        label: 'Employee',
        name: job.worker || '-',
        start: job.workerStart,
        end: job.workerDeadline,
        mins: job.workerMins
    };
    const officerRow = {
        label: 'Officer (QC)',
        name: job.qcOfficer || job.qc || '-',
        start: job.qcImageStart,
        end: job.qcImageEnd,
        mins: job.qcImageMins
    };
    const specialRow = {
        label: 'Special Officer (QC:SENT)',
        name: job.specialOfficer || job.specialQc || '-',
        start: job.qcSentStart,
        end: job.qcSentEnd,
        mins: job.qcSentMins
    };

    const rows = [employeeRow, officerRow, specialRow].map(r => `
        <tr>
          <td><strong>${escapeHtml(r.label)}</strong></td>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(formatDateOnly(r.start))}</td>
          <td>${escapeHtml(formatDateOnly(r.end))}</td>
          <td>${escapeHtml(formatMins(r.mins))}</td>
        </tr>
    `).join('');

    osBody.innerHTML = `
      <div class="receipt">
        <div class="receipt-head">
          <div>
            <div class="receipt-title">Receipt</div>
            <div class="receipt-sub">บันทึกคำสั่งซื้อเรียบร้อยแล้ว</div>
          </div>
          <div class="receipt-order">
            <div class="receipt-order-id">${escapeHtml(job.name)}</div>
            <div class="receipt-order-date">${escapeHtml(createdLabel)}</div>
          </div>
        </div>

        <div class="receipt-meta">
          <div><div class="k">Satellite</div><div class="v">${escapeHtml(job.satellite)}</div></div>
          <div><div class="k">Scenes</div><div class="v">${escapeHtml(job.imgCount)}</div></div>
          <div><div class="k">Rawdata Ready</div><div class="v">${escapeHtml(job.rawdataReady || '-')}</div></div>
          <div><div class="k">Approver</div><div class="v">${escapeHtml(job.approver || '-')}</div></div>
        </div>

        <div class="receipt-block">
          <div class="k">Steps</div>
          <div class="v">${escapeHtml(steps)}</div>
        </div>

        <div class="receipt-block">
          <div class="k">Assignments & Timeline</div>
          <table class="receipt-table">
            <thead>
              <tr><th>Role</th><th>Name</th><th>Start</th><th>End</th><th>Minutes</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="receipt-footnote">Final deadline: <strong>${escapeHtml(finalDl)}</strong></div>
        </div>
      </div>
    `;

    const copyBtn = document.getElementById('osCopyBtn');
    const printBtn = document.getElementById('osPrintBtn');
    const receiptText = buildOrderReceiptText(job);

    if(copyBtn) {
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(receiptText);
                copyBtn.textContent = 'คัดลอกแล้ว';
                setTimeout(() => copyBtn.textContent = 'คัดลอก', 1200);
            } catch {
                // Fallback
                prompt('คัดลอกข้อความด้านล่าง', receiptText);
            }
        };
    }

    if(printBtn) {
        printBtn.onclick = () => {
            const printHtml = `
              <h1>NexaIMAP - Order Receipt</h1>
              <div class="small">Order created at ${escapeHtml(createdLabel)}</div>
              <div class="meta">
                <div><strong>Order</strong><br>${escapeHtml(job.name)}</div>
                <div><strong>Satellite</strong><br>${escapeHtml(job.satellite)}</div>
                <div><strong>Scenes</strong><br>${escapeHtml(job.imgCount)}</div>
                <div><strong>Rawdata Ready</strong><br>${escapeHtml(job.rawdataReady || '-')}</div>
                <div><strong>Approver</strong><br>${escapeHtml(job.approver || '-')}</div>
                <div><strong>Final deadline</strong><br>${escapeHtml(finalDl)}</div>
              </div>
              <div><strong>Steps</strong><br>${escapeHtml(steps)}</div>
              <table class="table">
                <thead>
                  <tr><th>Role</th><th>Name</th><th>Start</th><th>End</th><th>Minutes</th></tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            `;
            openPrintWindow(job.name, printHtml);
        };
    }

    openModal('orderSummaryModal');
}

// ==========================================
// ARCHIVE & SUMMARY
// ==========================================
function renderArchive() {
    const tbody = document.querySelector('#archiveTable tbody');
    tbody.innerHTML = '';
    archivedJobs.forEach(job => {
        const assigned = [
            job.worker || '-',
            job.qcOfficer || job.qc || '-',
            job.specialOfficer || job.specialQc || '-'
        ].join(' / ');
        tbody.innerHTML += `
            <tr>
                <td>${job.name}</td>
                <td>${job.steps.join(', ')}</td>
                <td>${job.imgCount}</td>
                <td>${assigned}</td>
                <td>${new Date(job.completedAt || Date.now()).toLocaleDateString()}</td>
            </tr>
        `;
    });
}

function renderSummary() {
    const tbody = document.querySelector('#summaryTable tbody');
    tbody.innerHTML = '';
    
    members.forEach(m => {
        // Count from active + archive
        const allJobs = [...jobs, ...archivedJobs].filter(j => jobMentionsMember(j, m.name));
        const uniqueJobs = Array.from(new Map(allJobs.map(job => [job.id, job])).values());
        
        let totalImgs = 0;
        let totalMins = 0;
        
        uniqueJobs.forEach(j => {
            totalImgs += j.imgCount;
            totalMins += getJobMemberMinutes(j, m.name);
        });

        tbody.innerHTML += `
            <tr>
                <td>${m.name}</td>
                <td>${m.role}</td>
                <td>${uniqueJobs.length}</td>
                <td>${totalImgs}</td>
                <td>${totalMins}</td>
                <td>${(totalMins/60).toFixed(1)}</td>
            </tr>
        `;
    });
}

// ==========================================
// ACTIONS (Admin & Profile)
// ==========================================
function finishJob(index) {
    jobs[index].status = 'completed';
    jobs[index].completedAt = new Date().toISOString();
    archivedJobs.push(jobs[index]);
    jobs.splice(index, 1);
    normalizeQueuePositions();
    saveAppState();
    renderDashboard();
}

// Workflow Transitions
function startWorking(jobId) {
    const job = findJobById(jobId);
    if(job) {
        job.status = 'working';
        job.workerStartAt = new Date().toISOString();
        saveAppState();
        renderMyWork();
    }
}

function submitToQC(jobId) {
    const job = findJobById(jobId);
    if(job) {
        job.status = 'qc_check';
        job.submittedToQCAt = new Date().toISOString();
        saveAppState();
        // Notify Officer QC
        const officerName = job.qcOfficer || job.qc;
        notifyUserOfJob(officerName, job.id, 'มีงานต้อง QC', `${job.name} รอตรวจ QC`);
        renderMyWork();
    }
}

function qcPass(jobId) {
    const job = findJobById(jobId);
    if(job) {
        job.status = 'special_check';
        job.qcPassedAt = new Date().toISOString();
        saveAppState();
        // Notify Special Officer for approve
        const specialName = job.specialOfficer || job.specialQc;
        notifyUserOfJob(specialName, job.id, 'มีงานต้อง Approve', `${job.name} รอ Approve`);
        renderMyWork();
    }
}

function qcFail(jobId) {
    const job = findJobById(jobId);
    if(job) {
        job.status = 'working';
        job.returnedByQCAt = new Date().toISOString();
        job.qcFeedback = job.qcFeedback || [];
        job.qcFeedback.push({ date: new Date().toISOString(), message: 'QC ไม่ผ่าน กรุณาแก้ไข' });
        saveAppState();
        renderMyWork();
    }
}

function specialApprove(jobId) {
    const job = findJobById(jobId);
    if(job) {
        job.status = 'completed';
        job.specialApprovedAt = new Date().toISOString();
        job.completedAt = new Date().toISOString();
        archivedJobs.push(job);
        jobs = jobs.filter(j => j.id !== jobId);
        normalizeQueuePositions();
        saveAppState();
        renderMyWork();
    }
}

function getStatusLabel(status) {
    const labels = {
        'ordered': 'รอเริ่มงาน',
        'working': 'กำลังทำ',
        'qc_check': 'รอ QC ตรวจ',
        'special_check': 'รอ Special อนุมัติ',
        'completed': 'เสร็จสิ้น'
    };
    return labels[status] || status;
}

function getStatusColor(status) {
    const colors = {
        'ordered': 'pending',
        'working': 'busy',
        'qc_check': 'available',
        'special_check': 'available',
        'completed': 'done'
    };
    return colors[status] || 'available';
}

function deleteJob(index) {
    if(confirm('Are you sure you want to delete this job permanently?')) {
        jobs.splice(index, 1);
        normalizeQueuePositions();
        saveAppState();
        renderDashboard();
    }
}

function forceStatus(name, status) {
    const user = members.find(m => m.name === name);
    user.forceStatus = status;
    saveAppState();
    renderDashboard();
}

function clearMemberJobs(name) {
    const mJobs = jobs.filter(j => jobMentionsMember(j, name));
    archivedJobs.push(...mJobs);
    jobs = jobs.filter(j => !jobMentionsMember(j, name));
    normalizeQueuePositions();
    saveAppState();
    renderDashboard();
}

// ==========================================
// MODALS
// ==========================================
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openProfile(name) {
    const user = members.find(m => m.name === name);
    document.getElementById('pmName').textContent = `${user.name.toUpperCase()} Profile`;
    
    const uJobs = jobs.filter(j => jobMentionsMember(j, name));
    let html = `<p><strong>Status:</strong> <span class="status-badge ${user.status.toLowerCase()}">${user.status}</span></p>`;
    html += `<p><strong>Allowed:</strong> ${user.allowed.join(', ') || 'None'}</p>`;
    html += `<hr style="margin:1rem 0; border:0; border-top:1px solid var(--border);">`;
    html += `<h4>Active Jobs (${uJobs.length})</h4>`;
    
    if(uJobs.length === 0) html += `<p class="text-muted">No active jobs.</p>`;
    
    uJobs.forEach(j => {
        const roleStr = getJobAssignmentRole(j, name) || 'Task';
        const mins = getJobMemberMinutes(j, name);
        
        html += `
            <div class="work-item" style="margin-top:0.5rem; cursor:pointer;" onclick="openJobDetail('${j.id}', '${name}')">
                <strong>${j.name}</strong> <span class="status-badge available" style="float:right;">${roleStr}</span><br>
                <small>Load: ${mins} mins | Imgs: ${j.imgCount}</small>
            </div>
        `;
    });
    
    document.getElementById('pmBody').innerHTML = html;
    openModal('profileModal');
}

let activeJobForDetail = null;
let activeWorkerForDetail = null;

function openJobDetail(jobId, workerName) {
    closeModal('profileModal');
    const job = jobs.find(j => j.id === jobId);
    activeJobForDetail = job;
    activeWorkerForDetail = workerName;
    
    document.getElementById('jdTitle').textContent = `Job: ${job.name}`;
    document.getElementById('jdInfo').innerHTML = `
        Sending Note to: <strong>${workerName}</strong><br>
        Deadline: ${new Date(job.deadline).toLocaleDateString()}
    `;
    document.getElementById('jdNote').value = '';
    document.getElementById('jdSignature').value = '';
    document.getElementById('jdSendBtn').disabled = true;
    
    openModal('jobDetailModal');
}

function findJobById(jobId) {
    return jobs.find(j => j.id === jobId) || archivedJobs.find(j => j.id === jobId) || null;
}

function openCalendarJobDetail(jobId) {
    const job = findJobById(jobId);
    if(!job) return;

    const timeline = getJobTimeline(job);
    const start = timeline.workerStart;
    const workerEnd = timeline.workerEnd;
    const qcStart = timeline.officerStart;
    const qcEnd = timeline.officerEnd;
    const sentStart = timeline.specialStart;
    const sentEnd = timeline.specialEnd;
    const status = job.status || (archivedJobs.some(j => j.id === job.id) ? 'completed' : 'pending');
    const processes = job.selectedProcesses?.length ? job.selectedProcesses.join(', ') : (job.steps?.join(', ') || '-');

    document.getElementById('cdTitle').textContent = `Job: ${job.name}`;
    document.getElementById('cdBody').innerHTML = `
        <div class="calendar-detail-grid">
            <div><strong>Satellite</strong><span>${job.satellite || '-'}</span></div>
            <div><strong>Worker</strong><span>${job.worker || '-'}</span></div>
            <div><strong>Officer QC</strong><span>${job.qcOfficer || job.qc || '-'}</span></div>
            <div><strong>Special Officer</strong><span>${job.specialOfficer || job.specialQc || '-'}</span></div>
            <div><strong>Status</strong><span>${status}</span></div>
            <div><strong>Start</strong><span>${formatDateTimeLabel(start)}</span></div>
            <div><strong>Worker End</strong><span>${formatDateTimeLabel(workerEnd)}</span></div>
            <div><strong>QC Start</strong><span>${formatDateTimeLabel(qcStart)}</span></div>
            <div><strong>QC End</strong><span>${formatDateTimeLabel(qcEnd)}</span></div>
            <div><strong>QC:SENT Start</strong><span>${formatDateTimeLabel(sentStart)}</span></div>
            <div><strong>QC:SENT End</strong><span>${formatDateTimeLabel(sentEnd)}</span></div>
            <div><strong>Scene Count</strong><span>${job.sceneCount ?? job.imgCount ?? '-'}</span></div>
            <div><strong>Estimated Minutes</strong><span>${formatMins(job.estimatedMinutes ?? job.workerMins ?? 0)}</span></div>
            <div><strong>Officer QC Mins</strong><span>${formatMins(job.qcImageMins ?? job.qcMins ?? 0)}</span></div>
            <div><strong>Special Officer Mins</strong><span>${formatMins(job.qcSentMins ?? job.specialMins ?? 0)}</span></div>
            <div><strong>Queue Position</strong><span>${job.queuePosition ?? '-'}</span></div>
            <div class="calendar-detail-wide"><strong>Processes</strong><span>${processes}</span></div>
        </div>
    `;
    openModal('calendarDetailModal');
}

document.getElementById('jdSignature').addEventListener('input', (e) => {
    const btn = document.getElementById('jdSendBtn');
    if(e.target.value.trim().toLowerCase() === 'confirm') {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
});

document.getElementById('jdSendBtn').addEventListener('click', () => {
    const note = document.getElementById('jdNote').value.trim();
    if(note && activeJobForDetail) {
        activeJobForDetail.notes = activeJobForDetail.notes || [];
        activeJobForDetail.notes.push(`${currentUser.name} says: ${note}`);
        alert('Note sent successfully!');
        closeModal('jobDetailModal');
    }
});

// Admin Control
document.getElementById('adminBtn').addEventListener('click', () => {
    document.getElementById('adminPinSection').style.display = 'block';
    document.getElementById('adminControlsSection').style.display = 'none';
    document.getElementById('adminPinInput').value = '';
    openModal('adminModal');
});

function verifyAdminPin() {
    const pin = document.getElementById('adminPinInput').value;
    if(pin === '1234') {
        document.getElementById('adminPinSection').style.display = 'none';
        document.getElementById('adminControlsSection').style.display = 'block';
        renderAdminPerms();
    } else {
        alert('Invalid PIN');
    }
}

function renderAdminPerms() {
    const grid = document.getElementById('adminPermsGrid');
    grid.innerHTML = '';
    members.forEach(m => {
        const allowed = Array.isArray(m.allowed) ? m.allowed : [];
        const acceptChecked = m.acceptJobs === false ? '' : 'checked';
        const keys =
            m.role === 'Officer' ? ['QC', ...allSteps] :
            m.role === 'Special Officer' ? ['QC:SENT'] :
            m.role === 'Admin' ? ['QC', 'QC:SENT', ...allSteps] :
            allSteps;

        let options = keys.map(s => {
            const checked = allowed.includes(s) ? 'checked' : '';
            return `<label style="display:inline-flex; align-items:center; gap:0.2rem; font-size:0.8rem; margin-right:0.5rem;"><input type="checkbox" value="${s}" ${checked} onchange="togglePerm('${m.name}', '${s}', this.checked)"> ${s}</label>`;
        }).join('');

        const acceptToggle = `<label style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.85rem; margin-right:0.75rem; padding:0.25rem 0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--bg2);"><input type="checkbox" ${acceptChecked} onchange="toggleAcceptJobs('${m.name}', this.checked)"> รับงาน</label>`;
        
        grid.innerHTML += `
            <div style="background:var(--surface); padding:1rem; border:1px solid var(--border); border-radius:8px; margin-bottom:0.5rem;">
                <strong>${m.name} (${m.role})</strong><br>
                <div style="margin-top:0.5rem; display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">${acceptToggle}<span style="flex:1 1 100%"></span>${options}</div>
            </div>
        `;
    });
}

function togglePerm(name, step, isChecked) {
    const user = members.find(m => m.name === name);
    user.allowed = Array.isArray(user.allowed) ? user.allowed : [];
    if(isChecked && !user.allowed.includes(step)) user.allowed.push(step);
    if(!isChecked) user.allowed = user.allowed.filter(s => s !== step);
    saveAppState();
}

function toggleAcceptJobs(name, isChecked) {
    const user = members.find(m => m.name === name);
    if(!user) return;
    user.acceptJobs = Boolean(isChecked);
    saveAppState();
}

// Initialize Firebase
initFirebase();
