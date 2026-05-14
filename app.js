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
    // Employees (7)
    { name: 'joy', role: 'Employee', allowed: [...empSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'bboy', role: 'Employee', allowed: [...empSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'oil', role: 'Employee', allowed: [...empSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'june', role: 'Employee', allowed: [...empSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'phaifah', role: 'Employee', allowed: [...empSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'aunaun', role: 'Employee', allowed: [...empSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'nine', role: 'Employee', allowed: [...empSteps], status: 'Available', mins: 0, forceStatus: null },
    
    // Officers (8)
    { name: 'toom', role: 'Special Officer', allowed: ['QC:SENT'], status: 'Available', mins: 0, forceStatus: null },
    { name: 'x', role: 'Officer', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'first', role: 'Officer', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'chain', role: 'Officer', allowed: [...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'pla', role: 'Officer', allowed: [...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'gib', role: 'Officer', allowed: [...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'nee', role: 'Officer', allowed: [...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'puki', role: 'Officer', allowed: [...allSteps], status: 'Available', mins: 0, forceStatus: null }
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
    document.getElementById('adminBtn').style.display = 'block';
    document.getElementById('resetBtn').style.display = 'block';
    initApp();
}

function resetAllData() {
    const ok = confirm('Reset all app data and reload?');
    if(!ok) return;
    suppressStateSave = true;
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
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
        m.status !== 'Offline' && 
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

function assignRoleTask(role, desiredStart, durationMins, excludeNames = []) {
    const candidates = members.filter(member =>
        member.role === role &&
        member.status !== 'Offline' &&
        !excludeNames.includes(member.name)
    );

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

            if(candidate.currentLoad === best.currentLoad && candidate.name < best.name) {
                best = candidate;
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
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        
        renderPage(targetId);
    });
});

function initApp() {
    renderDashboard();
    setupOrderForm();
    setupCalendarControls();
}

function renderPage(pageId) {
    if(pageId === 'dashboardPage') renderDashboard();
    if(pageId === 'myWorkPage') renderMyWork();
    if(pageId === 'calendarPage') renderCalendar();
    if(pageId === 'archivePage') renderArchive();
    if(pageId === 'summaryPage') renderSummary();
}

// ==========================================
// DASHBOARD
// ==========================================
function renderDashboard() {
    recalculateMembers();
    
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
            ? jobs.filter(j => j.qcOfficer === currentUser.name || j.qc === currentUser.name)
            : currentUser.role === 'Special Officer'
                ? jobs.filter(j => j.specialOfficer === currentUser.name || j.specialQc === currentUser.name)
                : [];
    if(myJobs.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);">You have no active tasks.</p>';
        return;
    }

    myJobs.forEach((job, index) => {
        let notesHtml = (job.notes || []).map(n => `<div class="work-note">โน้ต: ${n}</div>`).join('');
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
        
        list.innerHTML += `
            <div class="work-item">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <h3>${job.name}</h3>
                    <span class="status-badge busy">Deadline: ${new Date(job.finalDeadline || job.deadline).toLocaleDateString()}</span>
                </div>
                <p><strong>Role:</strong> ${roleLabel} | <strong>Minutes:</strong> ${formatMins(mins)} | <strong>Images:</strong> ${job.imgCount}</p>
                <p><strong>Steps:</strong> ${job.steps.join(', ')}</p>
                ${notesHtml}
                
                <div class="path-inputs" id="paths-${job.id}">
                    <div class="path-row"><input type="text" placeholder="REFERENCE Path"></div>
                    <div class="path-row"><input type="text" placeholder="RPC/Rec/Resampling/ORTHO Path"></div>
                    <div class="path-row"><input type="text" placeholder="ENHANCE Path"></div>
                    <div class="path-row"><input type="text" placeholder="MOSAIC Path"></div>
                </div>
                
                <div style="margin-top:1rem; display:flex; gap:1rem;">
                    <button class="btn btn-outline" onclick="addPathInput('${job.id}')">+ เพิ่มช่องข้อมูล</button>
                    <button class="btn btn-primary" onclick="markWorkUpdated('${job.id}')">Update Work</button>
                </div>
            </div>
        `;
    });
}

function addPathInput(jobId) {
    const container = document.getElementById(`paths-${jobId}`);
    const row = document.createElement('div');
    row.className = 'path-row';
    row.innerHTML = `<input type="text" placeholder="New Path">`;
    container.appendChild(row);
}

function markWorkUpdated(jobId) {
    alert('Work updated.');
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

        // Find primary worker (based on first worker step)
        let worker = queueWorker(wSteps[0]);
        if(!worker) { alert(`No Available worker found for ${wSteps[0]}`); return; }

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
        const officerTask = assignRoleTask('Officer', officerStart, combinedMins, [worker]);
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
            createdAt: createdAt.toISOString()
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
        alert('Order Created!');
        document.querySelector('[data-target="dashboardPage"]').click();
    };
    
    openModal('orderConfirmModal');
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
        let options = allSteps.map(s => {
            const checked = m.allowed.includes(s) ? 'checked' : '';
            return `<label style="display:inline-flex; align-items:center; gap:0.2rem; font-size:0.8rem; margin-right:0.5rem;"><input type="checkbox" value="${s}" ${checked} onchange="togglePerm('${m.name}', '${s}', this.checked)"> ${s}</label>`;
        }).join('');
        
        grid.innerHTML += `
            <div style="background:var(--surface); padding:1rem; border:1px solid var(--border); border-radius:8px; margin-bottom:0.5rem;">
                <strong>${m.name} (${m.role})</strong><br>
                <div style="margin-top:0.5rem;">${options}</div>
            </div>
        `;
    });
}

function togglePerm(name, step, isChecked) {
    const user = members.find(m => m.name === name);
    if(isChecked && !user.allowed.includes(step)) user.allowed.push(step);
    if(!isChecked) user.allowed = user.allowed.filter(s => s !== step);
    saveAppState();
}

// Initialize Firebase
initFirebase();

