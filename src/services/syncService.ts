import axios from 'axios';
import { Task, SyncQueueItem, SyncResult, BatchSyncRequest, BatchSyncResponse } from '../types';
import { Database } from '../db/database';
import { TaskService } from './taskService';

export class SyncService {
  private apiUrl: string;
  
  constructor(
    private db: Database,
    _taskService: TaskService,
    apiUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api'
  ) {
    this.apiUrl = apiUrl;
  }

  async sync(): Promise<SyncResult> {
    // 1. Get all items from sync queue
    const queueItems = await this.db.all('SELECT * FROM sync_queue ORDER BY created_at');
    
    // 2. Group items by batch (use SYNC_BATCH_SIZE from env)
    const batchSize = parseInt(process.env.SYNC_BATCH_SIZE || '50');
    const batches: SyncQueueItem[][] = [];
    for (let i = 0; i < queueItems.length; i += batchSize) {
      batches.push(queueItems.slice(i, i + batchSize));
    }
    
    // 3. Process each batch
    let syncedItems = 0;
    let failedItems = 0;
    const errors: any[] = [];
    
    for (const batch of batches) {
      try {
        const batchResponse = await this.processBatch(batch);
        
        // 4. Handle success/failure for each item
        for (const processedItem of batchResponse.processed_items) {
          if (processedItem.status === 'success') {
            syncedItems++;
            await this.updateSyncStatus(processedItem.client_id, 'synced', processedItem.resolved_data);
          } else {
            failedItems++;
            errors.push({
              task_id: processedItem.client_id,
              operation: batch.find(item => item.task_id === processedItem.client_id)?.operation || 'unknown',
              error: processedItem.error || 'Unknown error',
              timestamp: new Date()
            });
            await this.updateSyncStatus(processedItem.client_id, 'error');
          }
        }
      } catch (error) {
        failedItems += batch.length;
        for (const item of batch) {
          await this.handleSyncError(item, error as Error);
          errors.push({
            task_id: item.task_id,
            operation: item.operation,
            error: (error as Error).message,
            timestamp: new Date()
          });
        }
      }
    }
    
    // 5. Update sync status in database
    // (already done above in the loop)
    
    // 6. Return sync result summary
    return {
      success: failedItems === 0,
      synced_items: syncedItems,
      failed_items: failedItems,
      errors
    };
  }

  async addToSyncQueue(taskId: string, operation: 'create' | 'update' | 'delete', data: Partial<Task>): Promise<void> {
    // 1. Create sync queue item
    const queueItem: SyncQueueItem = {
      id: require('uuid').v4(),
      task_id: taskId,
      operation,
      data,
      created_at: new Date(),
      retry_count: 0
    };
    
    // 2. Store serialized task data
    const serializedData = JSON.stringify(data);
    
    // 3. Insert into sync_queue table
    await this.db.run(
      'INSERT INTO sync_queue (id, task_id, operation, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, ?)',
      [queueItem.id, queueItem.task_id, queueItem.operation, serializedData, queueItem.created_at.toISOString(), queueItem.retry_count]
    );
  }

  private async processBatch(items: SyncQueueItem[]): Promise<BatchSyncResponse> {
    // 1. Prepare batch request
    const batchRequest: BatchSyncRequest = {
      items,
      client_timestamp: new Date()
    };
    
    // 2. Send to server
    const response = await axios.post(`${this.apiUrl}/batch`, batchRequest);
    
    // 3. Handle response
    const batchResponse: BatchSyncResponse = response.data;
    
    // 4. Apply conflict resolution if needed
    for (const processedItem of batchResponse.processed_items) {
      if (processedItem.status === 'conflict' && processedItem.resolved_data) {
        // Update local task with resolved data
        await this.db.run(
          'UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = ?, server_id = ? WHERE id = ?',
          [
            processedItem.resolved_data.title,
            processedItem.resolved_data.description,
            processedItem.resolved_data.completed ? 1 : 0,
            processedItem.resolved_data.updated_at.toISOString(),
            processedItem.server_id,
            processedItem.client_id
          ]
        );
      }
    }
    
    return batchResponse;
  }


  private async updateSyncStatus(taskId: string, status: 'synced' | 'error', serverData?: Partial<Task>): Promise<void> {
    // 1. Update sync_status field
    const now = new Date();
    await this.db.run(
      'UPDATE tasks SET sync_status = ?, last_synced_at = ? WHERE id = ?',
      [status, now.toISOString(), taskId]
    );
    
    // 2. Update server_id if provided
    if (serverData && serverData.server_id) {
      await this.db.run(
        'UPDATE tasks SET server_id = ? WHERE id = ?',
        [serverData.server_id, taskId]
      );
    }
    
    // 3. Update last_synced_at timestamp
    // (already done above)
    
    // 4. Remove from sync queue if successful
    if (status === 'synced') {
      await this.db.run('DELETE FROM sync_queue WHERE task_id = ?', [taskId]);
    }
  }

  private async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
    // 1. Increment retry count
    const newRetryCount = item.retry_count + 1;
    
    // 2. Store error message
    await this.db.run(
      'UPDATE sync_queue SET retry_count = ?, error_message = ? WHERE id = ?',
      [newRetryCount, error.message, item.id]
    );
    
    // 3. If retry count exceeds limit, mark as permanent failure
    if (newRetryCount >= 3) {
      await this.db.run(
        'UPDATE tasks SET sync_status = ? WHERE id = ?',
        ['error', item.task_id]
      );
    }
  }

  async checkConnectivity(): Promise<boolean> {
    // 1. Make a simple health check request
    try {
      await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
    
    // 2. Return true if successful, false otherwise
    // (already handled in the try-catch above)
  }
}