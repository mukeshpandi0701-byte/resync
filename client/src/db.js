import Dexie from 'dexie';

const actor = localStorage.getItem('resync_actor') || 'Inspector A';
const safeName = actor.replace(/\s+/g, '_').toLowerCase();

export const db = new Dexie(`resync_${safeName}`);

db.version(2).stores({
  inspections: 'id,updatedAt',
  changes: 'id,inspectionId,status,createdAt',
  tasks: 'id,status,assignee',
  evidence: 'id,inspectionId,status,createdAt' // status: pending, uploaded, failed
}).upgrade(tx => {
  // Add missing tables for existing users
});

export const seed = {
  id: 'inspection-001',
  title: 'Solar Panel Safety Inspection',
  site: 'North Block • Erode',
  status: 'assigned',
  updatedAt: Date.now(),
  version: 1,
  checklist: [
    {id: 'c1', label: 'Mounting bolts securely tightened', value: 'PENDING', notes: '', evidence: []},
    {id: 'c2', label: 'Panel mounting is secure', value: 'PENDING', notes: '', evidence: []},
    {id: 'c3', label: 'Cables are properly insulated', value: 'PENDING', notes: '', evidence: []},
    {id: 'c4', label: 'Warning signage is visible', value: 'PENDING', notes: '', evidence: []}
  ],
  notes: '',
  evidence: [],
  history: [{at: Date.now(), action: 'created', actor: 'System', version: 1}]
};
