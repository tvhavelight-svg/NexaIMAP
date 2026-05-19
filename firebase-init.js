// ==========================================
// FIREBASE INITIALIZATION - NexaIMAP (LOCAL MODE)
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

window.SATELLITE_SPECS = SATELLITE_SPECS;
window.PROCESS_KEYS = PROCESS_KEYS;
window.REPORT_RATE_MINUTES = REPORT_RATE_MINUTES;
window.WORKDAY_MINUTES = WORKDAY_MINUTES;
window.OFFICER_QC_MINUTES_PER_IMAGE = OFFICER_QC_MINUTES_PER_IMAGE;
window.SPECIAL_OFFICER_SENT_MINUTES = SPECIAL_OFFICER_SENT_MINUTES;

const allSteps = [...PROCESS_KEYS];
const empSteps = [...PROCESS_KEYS];

window.initialMembers = [
    // Employees start with no permissions; must be ticked in Manage Permissions.
    { name: 'joy', role: 'Employee', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'bboy', role: 'Employee', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'oil', role: 'Employee', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'june', role: 'Employee', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'phaifah', role: 'Employee', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'aunaun', role: 'Employee', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    { name: 'nine', role: 'Employee', allowed: [], status: 'Available', mins: 0, forceStatus: null },
    // Special Officer for QC:SENT
    { name: 'toom', role: 'Special Officer', allowed: ['QC:SENT'], status: 'Available', mins: 0, forceStatus: null },
    // Officers - default to all permissions + QC.
    { name: 'x', role: 'Officer', allowed: ['QC', ...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'first', role: 'Officer', allowed: ['QC', ...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'chain', role: 'Officer', allowed: ['QC', ...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'pla', role: 'Officer', allowed: ['QC', ...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'gib', role: 'Officer', allowed: ['QC', ...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'nee', role: 'Officer', allowed: ['QC', ...allSteps], status: 'Available', mins: 0, forceStatus: null },
    { name: 'puki', role: 'Officer', allowed: ['QC', ...allSteps], status: 'Available', mins: 0, forceStatus: null }
];

window.members = JSON.parse(JSON.stringify(window.initialMembers));
window.jobs = [];
window.archivedJobs = [];
window.currentUser = { name: 'joy', role: 'Employee' };

function initLocalMode() {
    if (document.getElementById('loadingScreen')) document.getElementById('loadingScreen').classList.remove('active');
    if (document.getElementById('loginScreen')) document.getElementById('loginScreen').classList.remove('active');
    if (document.getElementById('app')) document.getElementById('app').style.display = 'block';
    if (document.getElementById('currentUserDisplay')) document.getElementById('currentUserDisplay').textContent = '👤 JOY (Employee)';
    if (document.getElementById('adminBtn')) document.getElementById('adminBtn').style.display = 'block';
    if (document.getElementById('resetBtn')) document.getElementById('resetBtn').style.display = 'block';
    
    if (typeof initApp === 'function') {
        initApp();
    }
}

window.signInAnonymously = function() { initLocalMode(); };
window.signOutFromFirebase = function() { location.reload(); };
window.saveAppStateToFirestore = function() {};
window.startFirestoreListener = function() {};
window.showLoginScreen = function() {};
window.showAppScreen = function() {};
window.showError = function(m) { alert(m); };

window.SATELLITE_BY_NAME = Object.fromEntries(SATELLITE_SPECS.map(function(spec) { return [spec.name, spec]; }));

window.getStepRate = function(satellite, step) {
    if(step === 'REPORT') return REPORT_RATE_MINUTES;
    var rate = window.SATELLITE_BY_NAME[satellite] && window.SATELLITE_BY_NAME[satellite].processes ? window.SATELLITE_BY_NAME[satellite].processes[step] : null;
    return Number.isFinite(rate) ? rate : null;
};

window.calculateStepMins = function(satellite, step, imgCount) {
    var rate = window.getStepRate(satellite, step);
    if(rate === null) throw new Error(step + ' is not available for ' + satellite);
    return step === 'REPORT' ? rate : rate * imgCount;
};

window.calculateStepsMins = function(satellite, steps, imgCount) {
    return steps.reduce(function(sum, step) { return sum + window.calculateStepMins(satellite, step, imgCount); }, 0);
};

window.unsupportedSteps = function(satellite, steps) {
    return steps.filter(function(step) { return !PROCESS_KEYS.includes(step) || window.getStepRate(satellite, step) === null; });
};

window.formatMins = function(mins) {
    return Number.isInteger(mins) ? mins.toLocaleString() : mins.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

window.normalizeMemberRoles = function() {
    window.members = window.members.map(function(member) {
        if(member.name !== 'toom') return member;
        return Object.assign({}, member, { role: 'Special Officer', allowed: ['QC:SENT'] });
    });
};

window.recalculateMembers = function() {
    window.members.forEach(function(m) { m.mins = 0; if(!m.forceStatus) m.status = 'Available'; });
    window.jobs.forEach(function(job) {
        var worker = window.members.find(function(m) { return m.name === job.worker; });
        var qc = window.members.find(function(m) { return m.name === (job.qcOfficer || job.qc); });
        var special = window.members.find(function(m) { return m.name === (job.specialOfficer || job.specialQc); });
        if(worker) { worker.mins += job.workerMins || 0; if(!worker.forceStatus) worker.status = 'Busy'; }
        if(qc) { qc.mins += job.qcImageMins || job.qcMins || 0; if(!qc.forceStatus) qc.status = 'Busy'; }
        if(special) { special.mins += job.qcSentMins || job.specialMins || 0; if(!special.forceStatus) special.status = 'Busy'; }
    });
};

window.getSelectedProcessesFromForm = function() {
    var taskType = (document.querySelector('input[name="taskType"]:checked') || {}).value || null;
    var processTypes = Array.from(document.querySelectorAll('input[name="processType"]:checked')).map(function(cb) { return cb.value; });
    var enhType = (document.querySelector('input[name="enhType"]:checked') || {}).value || 'None';
    var mosType = (document.querySelector('input[name="mosType"]:checked') || {}).value || 'None';
    var reportType = (document.querySelector('input[name="reportType"]:checked') || {}).value || 'None';
    var selected = [];
    if(taskType) selected.push(taskType);
    selected.push.apply(selected, processTypes);
    if(enhType !== 'None') selected.push(enhType);
    if(mosType !== 'None') selected.push(mosType);
    if(reportType !== 'None') selected.push(reportType);
    return selected;
};

window.addWorkingDays = function(date, days) {
    var next = new Date(date);
    var remaining = days;
    while(remaining > 0) {
        next.setDate(next.getDate() + 1);
        var day = next.getDay();
        if(day !== 0 && day !== 6) remaining -= 1;
    }
    return next;
};

window.moveToNextWorkday = function(value) {
    var next = new Date(value);
    while(next.getDay() === 0 || next.getDay() === 6) { next.setDate(next.getDate() + 1); }
    return next;
};

window.calculateDeadline = function(totalMins, startDate) {
    var workDays = Math.ceil(totalMins / WORKDAY_MINUTES) + 1;
    return window.addWorkingDays(window.moveToNextWorkday(startDate || new Date()), workDays);
};

window.isWeekend = function(value) {
    var day = new Date(value).getDay();
    return day === 0 || day === 6;
};

window.addMinutes = function(date, mins) {
    var next = new Date(date);
    next.setMinutes(next.getMinutes() + mins);
    return next;
};

// Auto-start after page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(initLocalMode, 500); });
} else {
    setTimeout(initLocalMode, 500);
}
