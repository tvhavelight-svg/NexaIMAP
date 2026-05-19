# NexaIMAP

Job management web app with Firebase Firestore real-time sync.

## Tech Stack
- **Hosting:** GitHub Pages (https://tvhavelight-svg.github.io/NexaIMAP/)
- **Database:** Firebase Firestore (project: nexaimap-997ff)
- **Auth:** Simple username/password (no Firebase Auth)

## Key Files
- `index.html` - UI structure and login form
- `app.js` - All logic (1450+ lines): Firebase init, Firestore sync, job management, calendar, auto-logout
- `style.css` - Styling

## Default Users
- `admin` / `1234` (role: Admin) - sees Admin button + Reset Data button
- `joy` / `1234` (role: Employee)
- Other employees defined in `initialMembers` array (line ~95)

## Important Patterns
- **Real-time sync:** Uses Firestore `onSnapshot` (line ~33) - changes auto-sync across all devices
- **Admin role check:** Only `role === 'Admin'` sees admin controls
- **Reset Data:** Deletes jobs/archivedJobs only (not members)
- **Auto-logout:** 10 min inactivity, resets on any mouse/keyboard/scroll activity
- **Initial members:** Always restored from `initialMembers`, admin added if missing

## Deployment
1. Push to GitHub
2. GitHub Pages auto-deploys from `main` branch
3. URL: https://tvhavelight-svg.github.io/NexaIMAP/

## Workflow System
- Status flow: `ordered` → `working` → `qc_check` → `special_check` → `completed`
- Action buttons shown based on current user role and job status

## Permission System (Critical)
- Employees start with empty `allowed: []` array in Firestore
- Must check/assign permissions in **Manage Permissions** to receive jobs
- `assignRoleTask()` in app.js filters by `member.allowed.length > 0` - if no permissions, won't get assigned
- This prevents assigning jobs to unchecked workers

## Firestore Structure
- Collection: `state` / Doc: `appState`
- Fields: `members`, `jobs`, `archivedJobs`, `currentUserName`
