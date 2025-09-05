# Backend Interview Challenge – Task Sync API

---

## Overview

This project was completed as part of a backend interview challenge.  
The goal was to build a Task Management API with Offline-First Synchronization, where users can create, update, and delete tasks while offline, and later sync them with the server once connectivity is restored.  


---

## Changes I Made

### TaskService
- Implemented all CRUD operations:
  - `createTask`
  - `updateTask`
  - `deleteTask`
  - `getTask`
  - `getAllTasks`
  - `getTasksNeedingSync`
- Ensured every task operation also added an entry in the `sync_queue`.
- Used UUIDs for generating IDs.
- Defaulted `sync_status` to `pending` whenever a task was modified.
- Implemented soft delete by marking tasks as deleted instead of removing them from the database.

### SyncService
- Implemented the main synchronization logic.
- Added batch processing using `SYNC_BATCH_SIZE`.
- Added conflict resolution using the last-write-wins strategy, based on `updated_at` timestamps.
- Updated local tasks with server-resolved data when conflicts occurred.
- Completed helper functions:
  - `updateSyncStatus`
  - `handleSyncError`
  - `checkConnectivity`

### Routes
- Implemented all task endpoints:
  - `POST /tasks`
  - `PUT /tasks/:id`
  - `DELETE /tasks/:id`
  - `GET /tasks`
  - `GET /tasks/:id`
- Implemented sync endpoints:
  - `POST /sync`
  - `GET /status`
  - `POST /batch`

---

## Problems I Faced

### TypeScript Errors
At multiple points I ran into TypeScript errors, especially around how SQLite stores values. For example, fields like `completed` and `is_deleted` are stored as integers in the database but were expected as booleans in TypeScript. I solved this by converting values properly when reading tasks.

### Linting Errors
This was one of the more frustrating parts. When I first ran lint checks, I failed because of unused imports, missing explicit return types, and formatting inconsistencies. Initially, I overlooked linting until I realized it was blocking progress. After that, I carefully fixed each issue by adding types, cleaning up imports, and running auto-fix with:

```bash
npm run lint -- --fix
