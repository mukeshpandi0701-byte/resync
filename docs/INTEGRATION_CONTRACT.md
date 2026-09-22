# ReSync Integration Contract

This document defines the canonical data structures and API contracts for the ReSync Offline-First Collaborative Field Inspection Platform. It serves as the source of truth for parallel development, reflecting the currently implemented architecture (Dexie + Express + JSON Store) and outlining proposed contracts for upcoming features.

---

## 1. Data Structures

### 1.1 Inspection
The core document representing a field inspection assignment.
*   **`id`** *(string, UUID)*: Unique identifier.
*   **`title`** *(string)*: Name of the inspection (e.g., "Solar Panel Safety Inspection").
*   **`site`** *(string)*: Location or context string.
*   **`status`** *(string)*: Lifecycle status. Values: `assigned`, `in_progress`, `completed`, `reinspection_requested`.
*   **`updatedAt`** *(number)*: Unix timestamp (ms) of the last local update.
*   **`version`** *(number)*: Incremental version number for conflict detection.
*   **`checklist`** *(Array<InspectionItem>)*: The items to be inspected.
*   **`notes`** *(string)*: General inspector observations.
*   **`evidence`** *(Array<EvidenceReference>)*: Metadata for attached global evidence.
*   **`history`** *(Array<AuditEvent>)*: Embedded audit trail of state transitions.

### 1.2 Inspection Item (Checklist Item)
A discrete task within an inspection.
*   **`id`** *(string)*: Unique identifier.
*   **`label`** *(string)*: The prompt or requirement (e.g., "Mounting bolts securely tightened").
*   **`value`** *(string | null)*: The inspector's response. Values: `PASS`, `FAIL`, `PENDING`, or `null`.
*   **`notes`** *(string)*: Optional specific notes for this item.
*   **`evidence`** *(Array<EvidenceReference>)*: Metadata for evidence specifically attached to this item.

### 1.3 Evidence (Local Dexie Store)
The raw media file managed by the offline pipeline.
*   **`id`** *(string, UUID)*: Unique identifier.
*   **`inspectionId`** *(string, UUID)*: Parent inspection ID.
*   **`itemId`** *(string, optional)*: Associated checklist item ID, if applicable.
*   **`actorId`** *(string)*: Identity of the uploader (e.g., "Inspector A").
*   **`filename`** *(string)*: Original file name.
*   **`mimeType`** *(string)*: MIME type (e.g., `image/jpeg`).
*   **`size`** *(number)*: File size in bytes.
*   **`blob`** *(Blob)*: The raw binary data (stored locally, never sent in JSON).
*   **`status`** *(string)*: Upload state. Values: `pending`, `uploaded`, `failed`.
*   **`createdAt`** *(number)*: Unix timestamp (ms).
*   **`serverUrl`** *(string, optional)*: URL provided by the backend after successful upload.
*   **`analysisStatus`** *(string, optional)*: Used for future media analysis. Values: `pending`, `analyzing`, `complete`, `failed`.

### 1.4 Evidence Reference (Embedded in Inspection)
A lightweight pointer embedded inside `Inspection` or `InspectionItem` objects.
*   **`id`** *(string, UUID)*: Matches the `id` of the full Evidence record.
*   **`filename`** *(string)*: Display name.
*   **`status`** *(string)*: Sync status (`pending`, `uploaded`).

### 1.5 Sync Change (Local Dexie Store & Sync API)
A queued modification to an inspection.
*   **`id`** *(string, UUID)*: Unique identifier for the local change event.
*   **`inspectionId`** *(string, UUID)*: ID of the modified inspection.
*   **`payload`** *(Inspection)*: The complete modified inspection document.
*   **`baseVersion`** *(number)*: The exact `version` of the inspection *prior* to this change. Critical for detecting concurrent offline conflicts.
*   **`status`** *(string)*: Sync state. Values: `pending`, `synced`, `conflict`.
*   **`createdAt`** *(number)*: Unix timestamp (ms).
*   **`actor`** *(string)*: The actor performing the change.

### 1.6 Conflict (Server Store)
A server-side record generated when two incompatible sync changes arise from the same `baseVersion`.
*   **`id`** *(string, UUID)*: Unique identifier for the conflict.
*   **`inspectionId`** *(string, UUID)*: Affected inspection.
*   **`server`** *(Inspection)*: The currently committed server state.
*   **`client`** *(Inspection)*: The rejected incoming client payload.
*   **`status`** *(string)*: Values: `pending`, `resolved`.
*   **`createdAt`** *(number)*: Unix timestamp (ms).
*   **`resolution`** *(string, optional)*: The supervisor's decision (e.g., `keep_server`, `keep_client`, `reinspect`).
*   **`resolvedAt`** *(number, optional)*: Unix timestamp (ms).

### 1.7 Audit Event (Embedded in Inspection `history`)
A historical record of an action taken on the inspection.
*   **`at`** *(number)*: Unix timestamp (ms).
*   **`action`** *(string)*: Description of the action (e.g., `created`, `checklist update`, `supervisor_resolved_conflict_keep_server`).
*   **`actor`** *(string)*: Identity of the user.
*   **`version`** *(number)*: The resulting version number after this action.

### 1.8 Re-inspection (Proposed)
A specialized task generated from a rejected/failed inspection or unresolved conflict.
*   **`id`** *(string, UUID)*: Unique identifier.
*   **`parentInspectionId`** *(string, UUID)*: Original inspection ID.
*   **`status`** *(string)*: Values: `assigned`, `completed`.
*   **`assignee`** *(string)*: Target actor ID.
*   *(Note: Inherits all fields of an `Inspection` but acts as a discrete workflow step).*

### 1.9 Media Analysis (Proposed)
An async job analyzing uploaded evidence (e.g., AI defect detection).
*   **`evidenceId`** *(string, UUID)*: Target evidence.
*   **`findings`** *(Array<string>)*: Detected issues or tags.
*   **`confidenceScore`** *(number)*: 0.0 - 1.0.

### 1.10 Report (Proposed)
A generated aggregate document (PDF/HTML) summarizing an inspection.
*   **`id`** *(string, UUID)*: Report ID.
*   **`inspectionId`** *(string, UUID)*: Target inspection.
*   **`url`** *(string)*: Downloadable path.
*   **`generatedAt`** *(number)*: Unix timestamp (ms).

---

## 2. API Contracts

### 2.1 Existing Implementations

#### `GET /api/inspections`
*   **Response**: `200 OK`
*   **Body**: `Array<Inspection>`

#### `GET /api/inspections/:id`
*   **Response**: `200 OK`
*   **Body**: `Inspection | null`

#### `POST /api/sync`
Synchronizes an offline change queue event with the server.
*   **Request Body**: `{ clientId: string, change: SyncChange }`
*   **Response (Success)**: `200 OK` -> `{ ok: true, inspection: Inspection }` (Returns the new canonical server state).
*   **Response (Conflict)**: `200 OK` -> `{ conflict: true, conflictId: string, server: { version: number, lastActor: string }, client: { version: number, lastActor: string } }`

#### `GET /api/conflicts`
*   **Response**: `200 OK`
*   **Body**: `Array<Conflict>`

#### `PATCH /api/conflicts/:id`
Resolves a pending conflict.
*   **Request Body**: `{ decision: string, actor: string }`
    *   `decision` values: `keep_server`, `keep_client`, `reinspect`.
*   **Response**: `200 OK` -> `{ ok: true, inspection: Inspection }`

#### `POST /api/evidence/upload`
Accepts a raw multipart file upload from the evidence queue.
*   **Request Type**: `multipart/form-data`
*   **Form Fields**:
    *   `file` *(Blob)*: The file payload.
    *   `inspectionId` *(string)*: Target inspection.
    *   `actorId` *(string)*: Uploader ID.
*   **Response**: `200 OK` -> `{ ok: true, evidence: { id: string, url: string, ...metadata } }`

#### `GET /api/evidence/files/:filename`
*   **Response**: `200 OK` (Serves the binary file directly via express static).

---

### 2.2 Proposed Endpoints (Do Not Implement Yet)

#### Re-inspection APIs
*   **`POST /api/inspections/:id/reinspect`**
    *   **Description**: Manually triggers a re-inspection workflow from an existing record.
    *   **Response**: `201 Created` -> `{ ok: true, newInspectionId: string }`

#### Media Analysis APIs
*   **`POST /api/evidence/:id/analyze`**
    *   **Description**: Triggers an asynchronous CV/AI analysis of uploaded evidence.
    *   **Response**: `202 Accepted` -> `{ status: 'analyzing', jobId: string }`
*   **`GET /api/evidence/:id/analysis`**
    *   **Description**: Polls the result of the analysis.
    *   **Response**: `200 OK` -> `{ status: 'complete', findings: [...], confidenceScore: 0.95 }`

#### Audit APIs
*   **`GET /api/inspections/:id/audit`**
    *   **Description**: Fetches an expanded, paginated timeline of all audit events.
    *   **Response**: `200 OK` -> `{ events: Array<AuditEvent>, total: number }`

#### Report APIs
*   **`POST /api/reports/generate`**
    *   **Request Body**: `{ inspectionId: string, format: 'PDF' | 'JSON' }`
    *   **Response**: `202 Accepted` -> `{ jobId: string }`
*   **`GET /api/reports/:id`**
    *   **Description**: Returns the generated report metadata and download URL.
    *   **Response**: `200 OK` -> `{ id: string, url: string, generatedAt: number }`

---
## 3. Relationship Flow Verification

The data pipeline guarantees the following relational integrity:
1.  **Evidence -> Inspection**: A local `Evidence` Blob is created first. Its `id` is mapped into a lightweight `EvidenceReference` inside the `Inspection.evidence` array.
2.  **Evidence -> Media Analysis**: Once uploaded, the `Evidence.id` acts as the foreign key to trigger async `Media Analysis`. Analysis mutations optionally reflect back onto the Checklist `InspectionItem`.
3.  **Inspection -> Audit**: Every `sync` or `conflict resolution` mutates the `Inspection` and appends an immutable `AuditEvent` directly into its `history` array.
4.  **Inspection -> Report**: Reports aggregate the final `Inspection` state, the corresponding `Evidence` URLs, and the full `history` sequence into a final deliverable asset.
