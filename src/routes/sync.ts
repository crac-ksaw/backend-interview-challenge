import { Router, Request, Response } from 'express';
import { SyncService } from '../services/syncService';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';

export function createSyncRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);
  const syncService = new SyncService(db, taskService);

  // Trigger manual sync
  router.post('/sync', async (_req: Request, res: Response) => {
    // 1. Check connectivity first
    const isOnline = await syncService.checkConnectivity();
    if (!isOnline) {
      return res.status(503).json({ error: 'Service unavailable - offline' });
    }
    
    // 2. Call syncService.sync()
    try {
      const syncResult = await syncService.sync();
      
      // 3. Return sync result
      return res.json(syncResult);
    } catch (error) {
      return res.status(500).json({ error: 'Sync failed' });
    }
  });

  // Check sync status
  router.get('/status', async (_req: Request, res: Response) => {
    // 1. Get pending sync count
    const pendingTasks = await taskService.getTasksNeedingSync();
    const pendingSyncCount = pendingTasks.length;
    
    // 2. Get last sync timestamp
    const lastSyncResult = await db.get('SELECT MAX(last_synced_at) as last_sync_timestamp FROM tasks WHERE last_synced_at IS NOT NULL');
    const lastSyncTimestamp = lastSyncResult?.last_sync_timestamp || null;
    
    // 3. Check connectivity
    const isOnline = await syncService.checkConnectivity();
    
    // 4. Return status summary
    res.json({
      pending_sync_count: pendingSyncCount,
      last_sync_timestamp: lastSyncTimestamp,
      is_online: isOnline,
      sync_queue_size: pendingSyncCount
    });
  });

  // Batch sync endpoint (for server-side)
  router.post('/batch', async (req: Request, res: Response) => {
    // This would be implemented on the server side
    // to handle batch sync requests from clients
    try {
      const batchRequest = req.body;
      const processedItems = [];
      
      for (const item of batchRequest.items) {
        try {
          // Simulate server processing
          const serverId = `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          processedItems.push({
            client_id: item.task_id,
            server_id: serverId,
            status: 'success',
            resolved_data: {
              id: serverId,
              title: item.data.title,
              description: item.data.description,
              completed: item.data.completed || false,
              created_at: new Date(item.created_at),
              updated_at: new Date()
            }
          });
        } catch (error) {
          processedItems.push({
            client_id: item.task_id,
            server_id: null,
            status: 'error',
            error: 'Processing failed'
          });
        }
      }
      
      res.json({ processed_items: processedItems });
    } catch (error) {
      res.status(500).json({ error: 'Batch sync failed' });
    }
  });

  // Health check endpoint
  router.get('/health', async (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  return router;
}