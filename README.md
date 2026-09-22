# ReSync — Offline-First Collaborative Field Inspection Platform

24-hour hackathon MVP focused on the core demo loop:

**Work Offline → Save Locally → Reconnect → Sync → Detect Conflict → Preserve Both Versions → Resolve / Re-inspect → Audit**

## Stack
- React + Vite
- IndexedDB via Dexie for local-first inspection state and sync queue
- Node.js + Express REST API
- JSON persistence for the hackathon prototype

## Run
```bash
npm install
npm run dev
```
Client: http://localhost:5173
API: http://localhost:4000/api/health

## Demo
1. Open the client.
2. Turn browser/network offline.
3. Change checklist values and notes — the app keeps working.
4. Reconnect and click **Sync now**.
5. The backend sync endpoint accepts queued changes and can surface a conflict.
6. Resolve the conflict or request re-inspection; the audit trail records the decision.

## Scope discipline
This MVP intentionally does not claim production-grade CRDTs, resumable media upload, or offline AI. Those are extension points for later iterations.
