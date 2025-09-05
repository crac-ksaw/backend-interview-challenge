# Backend Interview Challenge – Task Sync API
---

## 📌 Overview

This project is part of a backend interview challenge where I implemented a **Task Management API with Offline-First Synchronization**.  
The system allows users to create, update, and delete tasks even while offline, and then sync them back to the server once connectivity is restored.  

I strictly followed the provided **TODO comments** and implemented code only within those blocks.

---

## 🔧 Changes I Made

### 1. **TaskService Implementation**
- Completed **CRUD operations**:
  - `createTask`
  - `updateTask`
  - `deleteTask`
  - `getTask`
  - `getAllTasks`
  - `getTasksNeedingSync`
- Ensured every operation updates the `sync_queue` to handle offline synchronization.
- Used UUIDs for IDs and set `sync_status = 'pending'` whenever tasks are created/modified/deleted.
- Implemented **soft deletes** using `is_deleted = true` instead of permanent deletes.

---

### 2. **SyncService Implementation**
- Built the **sync logic** to process items in the `sync_queue`.
- Implemented **batch processing** with configurable `SYNC_BATCH_SIZE`.
- Added **conflict resolution** using a **last-write-wins** strategy (based on `updated_at` timestamps).
- Updated local tasks with server-resolved data after conflicts.
- Implemented:
  - `updateSyncStatus`
  - `handleSyncError`
  - `checkConnectivity`

---

### 3. **Routes & API Endpoints**
- **Task Endpoints**  
  - `POST /tasks` → Create task  
  - `PUT /tasks/:id` → Update task  
  - `DELETE /tasks/:id` → Soft delete task  
  - `GET /tasks` → Fetch all tasks  
  - `GET /tasks/:id` → Fetch single task  

- **Sync Endpoints**  
  - `POST /sync` → Trigger sync  
  - `GET /status` → Check sync status  
  - `POST /batch` → Process batch sync  

---

## Problems I Faced

1. **TypeScript Errors**
   - Type mismatch issues with SQLite results (`is_deleted`, `completed` stored as integers).  
   - Fixed by converting database values (`0/1`) into booleans when returning tasks.

2. **Linting Errors**
   - ESLint flagged issues such as unused imports, missing return types, and formatting inconsistencies.  
   - Fixed by adding explicit return types, cleaning imports, and running auto-fix:  
     ```bash
     npm run lint -- --fix
     ```

3. **Sync Logic Edge Cases**
   - Handling retries for tasks stuck in `pending` state.  
   - Added a retry mechanism with a **dead letter queue** after 3 failed attempts.

---

## Completion Process

1. **Understanding** → Fully read the challenge repo, noted all TODOs.  
2. **Task Service** → Implemented CRUD + Sync Queue integration.  
3. **Sync Service** → Implemented batch sync, retry logic, conflict resolution.  
4. **Routes** → Exposed endpoints for tasks and sync.  
5. **Debugging** → Fixed TypeScript and ESLint issues.  
6. **Testing** → Verified sync logic offline → online workflows.  

---

## Tech Stack

- **Node.js** + **TypeScript**  
- **Express.js**  
- **SQLite** (local DB)  
- **Vitest** (testing)  
- **Axios** (API requests)  

---

## ✅ Conclusion

This challenge helped me deepen my understanding of **offline-first backend design**, **sync queues**, and **conflict resolution strategies**.  
By carefully following the TODO instructions, debugging TypeScript and linting issues, and thoroughly testing the implementation, I was able to complete the challenge successfully.  