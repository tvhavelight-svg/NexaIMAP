// ==========================================
// NexaIMAP App - LOCAL MODE
// ==========================================

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

document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
        e.target.classList.add('active');
        var targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        renderPage(targetId);
    });
});

function renderDashboard() {
    window.recalculateMembers();
    
    var avail = window.members.filter(function(m) { return m.status === 'Available'; }).length;
    var busy = window.members.filter(function(m) { return m.status === 'Busy'; }).length;
    var offline = window.members.filter(function(m) { return m.status === 'Offline'; }).length;
    
    document.getElementById('statAvail').textContent = avail;
    document.getElementById('statBusy').textContent = busy;
    document.getElementById('statOffline').textContent = offline;
    document.getElementById('statJobs').textContent = window.jobs.length;

    var sidebar = document.getElementById('adminJobsSidebar');
    sidebar.style.display = window.currentUser && window.currentUser.role === 'Officer' ? 'block' : 'none';
    
    if(window.currentUser && window.currentUser.role === 'Officer') {
        var jobsList = document.getElementById('activeJobsList');
        jobsList.innerHTML = '';
        window.jobs.forEach(function(job, index) {
            jobsList.innerHTML += '<div class="work-item" style="padding:1rem;margin-bottom:0.5rem;border-left-color:var(--accent2);"><strong>' + job.name + '</strong><br><small>Worker: ' + (job.worker || '-') + ' | Officer: ' + (job.qcOfficer || job.qc || '-') + ' | Special: ' + (job.specialOfficer || job.specialQc || '-') + '</small><div style="margin-top:0.5rem;display:flex;gap:0.5rem;"><button class="btn btn-primary" onclick="finishJob(' + index + ')" style="padding:0.2rem 0.5rem;font-size:0.8rem;">จบงาน</button><button class="btn btn-outline" onclick="deleteJob(' + index + ')" style="padding:0.2rem 0.5rem;font-size:0.8rem;color:var(--red-text);">ลบ</button></div></div>';
        });
    }

    var empGrid = document.getElementById('employeesGrid');
    var offGrid = document.getElementById('officersGrid');
    var specialGrid = document.getElementById('specialOfficersGrid');
    empGrid.innerHTML = '';
    offGrid.innerHTML = '';
    if(specialGrid) specialGrid.innerHTML = '';

    window.members.forEach(function(m) {
        var isOfficer = window.currentUser && window.currentUser.role === 'Officer';
        var adminControls = isOfficer ? '<div class="admin-card-controls" onclick="event.stopPropagation()"><button class="btn btn-outline" onclick="forceStatus(\'' + m.name + '\',\'Offline\')">ออฟไลน์</button><button class="btn btn-outline" onclick="forceStatus(\'' + m.name + '\',null)">ออนไลน์</button></div>' : '';
        var cardHtml = '<div class="member-card" onclick="openProfile(\'' + m.name + '\')"><div class="member-header"><span class="member-name">' + m.name + '</span><span class="status-badge ' + m.status.toLowerCase() + '">' + m.status + '</span></div><div class="member-role">' + m.role + '</div><div style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);">Load: ' + m.mins + ' mins</div>' + adminControls + '</div>';
        if(m.role === 'Employee') empGrid.innerHTML += cardHtml;
        else if(m.role === 'Special Officer' && specialGrid) specialGrid.innerHTML += cardHtml;
        else offGrid.innerHTML += cardHtml;
    });
}

function renderMyWork() {
    var list = document.getElementById('myWorkList');
    list.innerHTML = '';
    
    if(!window.currentUser) return;
    
    var myJobs = [];
    if(window.currentUser.role === 'Employee') {
        myJobs = window.jobs.filter(function(j) { return j.worker === window.currentUser.name; });
    } else if(window.currentUser.role === 'Officer') {
        myJobs = window.jobs.filter(function(j) { return j.qcOfficer === window.currentUser.name || j.qc === window.currentUser.name; });
    } else if(window.currentUser.role === 'Special Officer') {
        myJobs = window.jobs.filter(function(j) { return j.specialOfficer === window.currentUser.name || j.specialQc === window.currentUser.name; });
    }
    
    if(myJobs.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);">You have no active tasks.</p>';
        return;
    }

    myJobs.forEach(function(job) {
        var notesHtml = (job.notes || []).map(function(n) { return '<div class="work-note">โน้ต: ' + n + '</div>'; }).join('');
        var roleLabel = window.currentUser.role === 'Employee' ? 'Worker' : (window.currentUser.role === 'Officer' ? 'Officer QC' : 'Special Officer');
        var mins = window.currentUser.role === 'Employee' ? (job.workerMins || job.estimatedMinutes || 0) : (window.currentUser.role === 'Officer' ? (job.qcMins || job.qcImageMins || 0) : (job.qcSentMins || job.specialMins || 0));
        
        list.innerHTML += '<div class="work-item"><div style="display:flex;justify-content:space-between;margin-bottom:1rem;"><h3>' + job.name + '</h3><span class="status-badge busy">Deadline: ' + new Date(job.finalDeadline || job.deadline).toLocaleDateString() + '</span></div><p><strong>Role:</strong> ' + roleLabel + ' | <strong>Minutes:</strong> ' + window.formatMins(mins) + ' | <strong>Images:</strong> ' + job.imgCount + '</p><p><strong>Steps:</strong> ' + (job.steps || []).join(', ') + '</p>' + notesHtml + '<div class="path-inputs" id="paths-' + job.id + '"><div class="path-row"><input type="text" placeholder="REFERENCE Path"></div><div class="path-row"><input type="text" placeholder="RPC/Rec/Resampling/ORTHO Path"></div><div class="path-row"><input type="text" placeholder="ENHANCE Path"></div><div class="path-row"><input type="text" placeholder="MOSAIC Path"></div></div><div style="margin-top:1rem;display:flex;gap:1rem;"><button class="btn btn-outline" onclick="addPathInput(\'' + job.id + '\')">+ เพิ่มช่องข้อมูล</button><button class="btn btn-primary" onclick="markWorkUpdated(\'' + job.id + '\')">Update Work</button></div></div>';
    });
}

function addPathInput(jobId) {
    var container = document.getElementById('paths-' + jobId);
    var row = document.createElement('div');
    row.className = 'path-row';
    row.innerHTML = '<input type="text" placeholder="New Path">';
    container.appendChild(row);
}

function markWorkUpdated(jobId) {
    alert('Work updated.');
}

var calendarControlsBound = false;
function setupCalendarControls() {
    if(calendarControlsBound) return;
    calendarControlsBound = true;

    document.getElementById('calendarTodayBtn').addEventListener('click', function() {
        window.currentCalendarDate = new Date();
        renderCalendar();
    });
    document.getElementById('calendarPrevBtn').addEventListener('click', function() {
        window.currentCalendarDate = window.addMonths(window.currentCalendarDate, -1);
        renderCalendar();
    });
    document.getElementById('calendarNextBtn').addEventListener('click', function() {
        window.currentCalendarDate = window.addMonths(window.currentCalendarDate, 1);
        renderCalendar();
    });
}

function formatMonthLabel(value) {
    return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toStartOfDay(value) {
    var date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function startOfMonth(value) {
    var date = toStartOfDay(value);
    date.setDate(1);
    return date;
}

function addDays(date, days) {
    var next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function addMonths(date, months) {
    var next = new Date(date);
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    return next;
}

function dayDiff(a, b) {
    var ms = 24 * 60 * 60 * 1000;
    return Math.round((toStartOfDay(b) - toStartOfDay(a) / ms);
}

function sameDay(a, b) {
    return toStartOfDay(a).getTime() === toStartOfDay(b).getTime();
}

function getJobTimeline(job) {
    var workerStart = new Date(job.workerStart || job.createdAt || job.startedAt || job.deadline || Date.now());
    var workerEnd = new Date(job.workerDeadline || job.deadline || job.completedAt || job.createdAt || workerStart);
    var officerStart = new Date(job.qcImageStart || workerEnd);
    var officerEnd = new Date(job.qcImageDeadline || job.qcImageEnd || officerStart);
    return { workerStart: workerStart, workerEnd: workerEnd, officerStart: officerStart, officerEnd: officerEnd, specialStart: officerStart, specialEnd: officerEnd };
}

function renderCalendar() {
    var list = document.getElementById('calendarList');
    var title = document.getElementById('calendarTitle');
    if(!list) return;

    if(!window.currentCalendarDate) window.currentCalendarDate = new Date();
    var monthStart = startOfMonth(window.currentCalendarDate);
    var gridStart = addDays(monthStart, -monthStart.getDay());

    if(title) title.textContent = formatMonthLabel(monthStart);

    var weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function(day) { return '<div class="calendar-weekday">' + day + '</div>'; }).join('');

    var weeksHtml = '';
    for(var weekIndex = 0; weekIndex < 6; weekIndex++) {
        var weekStart = addDays(gridStart, weekIndex * 7);
        var weekDays = [];
        for(var dayIndex = 0; dayIndex < 7; dayIndex++) {
            weekDays.push(addDays(weekStart, dayIndex));
        }
        
        var dayCellsHtml = weekDays.map(function(day) {
            var isCurrentMonth = day.getMonth() === monthStart.getMonth();
            var isToday = sameDay(day, new Date());
            return '<div class="calendar-day-cell ' + (isCurrentMonth ? '' : 'other-month') + ' ' + (isToday ? 'today' : '') + '"><div class="calendar-day-number">' + day.getDate() + '</div></div>';
        }).join('');

        weeksHtml += '<div class="calendar-week-block" style="min-height:132px;"><div class="calendar-week-cells">' + dayCellsHtml + '</div><div class="calendar-week-event-layer"></div></div>';
    }

    list.innerHTML = '<div class="calendar-month-grid"><div class="calendar-week-row">' + weekdayHeaders + '</div><div class="calendar-weeks">' + weeksHtml + '</div></div>';
}

function getNextAvailableOrderNum(year, preferredNum) {
    var used = {};
    window.jobs.forEach(function(j) {
        var match = /^IMAP-(\d+)-(\d{4})$/.exec(j.name || '');
        if(match && match[1] === year) used[match[2]] = true;
    });
    window.archivedJobs.forEach(function(j) {
        var match = /^IMAP-(\d+)-(\d{4})$/.exec(j.name || '');
        if(match && match[1] === year) used[match[2]] = true;
    });
    if(preferredNum && !used[preferredNum]) return preferredNum;
    for(var i = 1; i <= 9999; i++) {
        var candidate = String(i).padStart(4, '0');
        if(!used[candidate]) return candidate;
    }
    return '0001';
}

function setupOrderForm() {
    document.getElementById('orderSat').addEventListener('change', updateRateAvailability);
    document.getElementById('orderImgCount').addEventListener('input', updateEstimatePreview);
    document.querySelectorAll('#orderForm input[type="radio"], #orderForm input[type="checkbox"]').forEach(function(input) {
        input.addEventListener('change', updateEstimatePreview);
    });
    updateRateAvailability();

    document.getElementById('orderForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        var year = document.getElementById('orderYear').value.trim();
        var num = document.getElementById('orderNum').value.trim();
        var uniqueNum = getNextAvailableOrderNum(year, num.padStart(4, '0'));
        document.getElementById('orderNum').value = uniqueNum;
        var name = 'IMAP-' + year + '-' + uniqueNum;
        
        var satellite = document.getElementById('orderSat').value;
        var imgCount = parseInt(document.getElementById('orderImgCount').value);
        var selectedSteps = window.getSelectedProcessesFromForm();
        
        if(selectedSteps.length === 0) {
            alert('กรุณาเลือกกระบวนการอย่างน้อย 1 อย่าง');
            return;
        }

        var unavailable = window.unsupportedSteps(satellite, selectedSteps);
        if(unavailable.length) {
            alert('ขั้นตอนเหล่านี้ไม่รองรับสำหรับดาวเทียม ' + satellite + ': ' + unavailable.join(', '));
            return;
        }

        var estimatedMinutes = window.calculateStepsMins(satellite, selectedSteps, imgCount);
        var createdAt = new Date();
        var workerStart = window.moveToNextWorkday(createdAt);
        var workerDeadline = window.calculateDeadline(estimatedMinutes, workerStart);

        var qcImageMins = imgCount * window.OFFICER_QC_MINUTES_PER_IMAGE;
        var combinedMins = qcImageMins + window.SPECIAL_OFFICER_SENT_MINUTES;
        var officerStart = window.moveToNextWorkday(window.addWorkingDays(workerDeadline, 1));

        var queuePosition = window.jobs.filter(function(j) { return j.status === 'pending'; }).length + 1;

        var draftJob = {
            id: 'JOB' + Date.now(),
            status: 'pending',
            name: name,
            satellite: satellite,
            sceneCount: imgCount,
            imgCount: imgCount,
            steps: selectedSteps,
            selectedProcesses: selectedSteps,
            worker: 'joy',
            workerStart: workerStart.toISOString(),
            workerDeadline: workerDeadline.toISOString(),
            workerMins: estimatedMinutes,
            qcOfficer: 'chain',
            qcImageStart: officerStart.toISOString(),
            qcImageEnd: window.addMinutes(officerStart, combinedMins).toISOString(),
            qcMins: qcImageMins,
            qcImageMins: qcImageMins,
            specialOfficer: 'toom',
            specialQc: 'toom',
            qcSentMins: window.SPECIAL_OFFICER_SENT_MINUTES,
            specialMins: window.SPECIAL_OFFICER_SENT_MINUTES,
            estimatedMinutes: estimatedMinutes,
            queuePosition: queuePosition,
            deadline: window.addMinutes(officerStart, combinedMins).toISOString(),
            finalDeadline: window.addMinutes(officerStart, combinedMins).toISOString(),
            notes: [],
            createdAt: createdAt.toISOString()
        };

        showOrderConfirm(draftJob);
    });
}

function showOrderConfirm(draft) {
    document.getElementById('ocBody').innerHTML = '<p><strong>Project:</strong> ' + draft.name + '</p><p><strong>Satellite:</strong> ' + draft.satellite + '</p><p><strong>Scene Count:</strong> ' + draft.sceneCount + '</p><div style="margin:1rem 0;padding:1rem;background:var(--bg2);border-radius:8px;"><p><strong>Worker:</strong> <span class="status-badge available">' + draft.worker + '</span></p><p><strong>Officer QC:</strong> <span class="status-badge available">' + draft.qcOfficer + '</span></p><p><strong>Special Officer:</strong> <span class="status-badge available">' + draft.specialOfficer + '</span></p><p><strong>Queue:</strong> ' + draft.queuePosition + '</p></div><p><strong>Processes:</strong> ' + draft.selectedProcesses.join(', ') + '</p><p><strong>Est. Minutes:</strong> ' + window.formatMins(draft.estimatedMinutes) + ' mins</p>';
    
    document.getElementById('ocConfirmBtn').onclick = function() {
        window.jobs.push(draft);
        window.saveAppStateToFirestore();
        closeModal('orderConfirmModal');
        document.getElementById('orderForm').reset();
        document.getElementById('orderYear').value = '69';
        document.getElementById('orderNum').value = '0001';
        updateRateAvailability();
        alert('Order Created!');
        document.querySelector('[data-target="dashboardPage"]').click();
    };
    
    openModal('orderConfirmModal');
}

function updateEstimatePreview() {
    var preview = document.getElementById('estimatePreview');
    if(!preview) return;

    var satellite = document.getElementById('orderSat').value;
    var sceneCount = parseInt(document.getElementById('orderImgCount').value, 10);
    var selectedProcesses = window.getSelectedProcessesFromForm();

    if(selectedProcesses.length === 0) {
        preview.textContent = 'Estimated time: -';
        return;
    }

    if(!satellite || !sceneCount) {
        preview.textContent = 'Estimated time: -';
        return;
    }

    var estimatedMinutes = window.calculateStepsMins(satellite, selectedProcesses, sceneCount);
    preview.textContent = 'Estimated time: ' + window.formatMins(estimatedMinutes) + ' mins (' + selectedProcesses.join(' + ') + ')';
}

function updateRateAvailability() {
    var satellite = document.getElementById('orderSat').value;
    var rateSummary = document.getElementById('rateSummary');
    var optionInputs = document.querySelectorAll('#orderForm input[type="radio"], #orderForm input[type="checkbox"]');

    optionInputs.forEach(function(input) {
        if(input.value === 'None') {
            input.disabled = false;
            return;
        }
        var rate = satellite ? window.getStepRate(satellite, input.value) : null;
        input.disabled = rate === null;
        if(rate === null) input.checked = false;
    });

    if(!rateSummary) return;
    if(!satellite) {
        rateSummary.innerHTML = 'เลือกดาวเทียมเพื่อดูเรทเวลาจากตาราง';
        updateEstimatePreview();
        return;
    }

    var spec = window.SATELLITE_BY_NAME[satellite];
    if(!spec) return;
    
    var entries = Object.keys(spec.processes).map(function(step) {
        return '<span><strong>' + step + '</strong> ' + window.formatMins(spec.processes[step]) + ' mins/scene</span>';
    }).join('');
    entries += '<span><strong>REPORT</strong> ' + window.formatMins(window.REPORT_RATE_MINUTES) + ' mins/order</span>';
    rateSummary.innerHTML = entries;
    updateEstimatePreview();
}

function renderArchive() {
    var tbody = document.querySelector('#archiveTable tbody');
    tbody.innerHTML = '';
    window.archivedJobs.forEach(function(job) {
        tbody.innerHTML += '<tr><td>' + job.name + '</td><td>' + (job.steps || []).join(', ') + '</td><td>' + job.imgCount + '</td><td>' + (job.worker || '-') + ' / ' + (job.qcOfficer || job.qc || '-') + '</td><td>' + new Date(job.completedAt || Date.now()).toLocaleDateString() + '</td></tr>';
    });
}

function renderSummary() {
    var tbody = document.querySelector('#summaryTable tbody');
    tbody.innerHTML = '';
    
    window.members.forEach(function(m) {
        var totalMins = 0;
        var totalImgs = 0;
        var jobCount = 0;
        
        window.jobs.forEach(function(j) {
            if(j.worker === m.name || j.qcOfficer === m.name || j.qc === m.name || j.specialOfficer === m.name || j.specialQc === m.name) {
                totalMins += j.workerMins || j.estimatedMinutes || 0;
                totalImgs += j.imgCount || 0;
                jobCount++;
            }
        });
        window.archivedJobs.forEach(function(j) {
            if(j.worker === m.name || j.qcOfficer === m.name || j.qc === m.name || j.specialOfficer === m.name || j.specialQc === m.name) {
                totalMins += j.workerMins || j.estimatedMinutes || 0;
                totalImgs += j.imgCount || 0;
                jobCount++;
            }
        });

        tbody.innerHTML += '<tr><td>' + m.name + '</td><td>' + m.role + '</td><td>' + jobCount + '</td><td>' + totalImgs + '</td><td>' + totalMins + '</td><td>' + (totalMins/60).toFixed(1) + '</td></tr>';
    });
}

function finishJob(index) {
    window.jobs[index].status = 'completed';
    window.jobs[index].completedAt = new Date().toISOString();
    window.archivedJobs.push(window.jobs[index]);
    window.jobs.splice(index, 1);
    window.normalizeQueuePositions();
    window.saveAppStateToFirestore();
    renderDashboard();
}

function deleteJob(index) {
    if(confirm('Delete this job?')) {
        window.jobs.splice(index, 1);
        window.normalizeQueuePositions();
        window.saveAppStateToFirestore();
        renderDashboard();
    }
}

function forceStatus(name, status) {
    var user = window.members.find(function(m) { return m.name === name; });
    if(user) {
        user.forceStatus = status;
        window.saveAppStateToFirestore();
        renderDashboard();
    }
}

window.normalizeQueuePositions = function() {
    window.jobs.filter(function(job) { return job.status === 'pending'; }).sort(function(a, b) { return (a.queuePosition || 0) - (b.queuePosition || 0); }).forEach(function(job, index) {
        job.queuePosition = index + 1;
    });
};

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openProfile(name) {
    var user = window.members.find(function(m) { return m.name === name; });
    document.getElementById('pmName').textContent = (user.name.toUpperCase()) + ' Profile';
    
    var uJobs = window.jobs.filter(function(j) { return j.worker === name || j.qcOfficer === name || j.qc === name || j.specialOfficer === name || j.specialQc === name; });
    var html = '<p><strong>Status:</strong> <span class="status-badge ' + user.status.toLowerCase() + '">' + user.status + '</span></p><p><strong>Role:</strong> ' + user.role + '</p><hr style="margin:1rem 0;border:0;border-top:1px solid var(--border);"><h4>Active Jobs (' + uJobs.length + ')</h4>';
    
    if(uJobs.length === 0) html += '<p>No active jobs.</p>';
    
    uJobs.forEach(function(j) {
        html += '<div class="work-item" style="margin-top:0.5rem;"><strong>' + j.name + '</strong><br><small>Load: ' + (j.workerMins || j.estimatedMinutes || 0) + ' mins</small></div>';
    });
    
    document.getElementById('pmBody').innerHTML = html;
    openModal('profileModal');
}

document.getElementById('logoutBtn').addEventListener('click', function() {
    if(confirm('Logout?')) {
        window.location.reload();
    }
});

document.getElementById('resetBtn').addEventListener('click', function() {
    if(confirm('Reset all data?')) {
        window.localStorage.clear();
        window.location.reload();
    }
});

document.getElementById('adminBtn').addEventListener('click', function() {
    openModal('adminModal');
});

document.getElementById('adminPinInput') && document.getElementById('adminPinInput').addEventListener('keypress', function(e) {
    if(e.key === 'Enter') verifyAdminPin();
});

function verifyAdminPin() {
    var pin = document.getElementById('adminPinInput').value;
    if(pin === '1234') {
        document.getElementById('adminPinSection').style.display = 'none';
        document.getElementById('adminControlsSection').style.display = 'block';
        renderAdminPerms();
    } else {
        alert('Invalid PIN');
    }
}

function renderAdminPerms() {
    var grid = document.getElementById('adminPermsGrid');
    if(!grid) return;
    grid.innerHTML = '';
    window.members.forEach(function(m) {
        var options = window.PROCESS_KEYS.map(function(s) {
            var checked = m.allowed.includes(s) ? 'checked' : '';
            return '<label style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.8rem;margin-right:0.5rem;"><input type="checkbox" value="' + s + '" ' + checked + ' onchange="togglePerm(\'' + m.name + '\',\'' + s + '\',this.checked)"> ' + s + '</label>';
        }).join('');
        grid.innerHTML += '<div style="background:var(--surface);padding:1rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.5rem;"><strong>' + m.name + ' (' + m.role + ')</strong><div style="margin-top:0.5rem;">' + options + '</div></div>';
    });
}

function togglePerm(name, step, isChecked) {
    var user = window.members.find(function(m) { return m.name === name; });
    if(user) {
        if(isChecked && !user.allowed.includes(step)) user.allowed.push(step);
        if(!isChecked) user.allowed = user.allowed.filter(function(s) { return s !== step; });
        window.saveAppStateToFirestore();
    }
}