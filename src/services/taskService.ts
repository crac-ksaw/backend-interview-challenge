import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';
import { Database } from '../db/database';

export class TaskService {
  constructor(private db: Database) {}

  async createTask(taskData: Partial<Task>): Promise<Task> {
    // 1. Generate UUID for the task
    const id = uuidv4();
    
    // 2. Set default values (completed: false, is_deleted: false)
    const now = new Date();
    const task: Task = {
      id,
      title: taskData.title!,
      description: taskData.description,
      completed: false,
      created_at: now,
      updated_at: now,
      is_deleted: false,
      sync_status: 'pending'
    };
    
    // 3. Set sync_status to 'pending'
    // (already set above)
    
    // 4. Insert into database
    await this.db.run(
      'INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [task.id, task.title, task.description, task.completed ? 1 : 0, task.created_at.toISOString(), task.updated_at.toISOString(), task.is_deleted ? 1 : 0, task.sync_status]
    );
    
    // 5. Add to sync queue
    await this.db.run(
      'INSERT INTO sync_queue (id, task_id, operation, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), task.id, 'create', JSON.stringify(task), task.created_at.toISOString(), 0]
    );
    
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    // 1. Check if task exists
    const existingTask = await this.db.get('SELECT * FROM tasks WHERE id = ? AND is_deleted = 0', [id]);
    if (!existingTask) {
      return null;
    }
    
    // 2. Update task in database
    const now = new Date();
    const updatedTask = {
      ...existingTask,
      ...updates,
      updated_at: now,
      sync_status: 'pending'
    };
    
    await this.db.run(
      'UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = ?, sync_status = ? WHERE id = ?',
      [updatedTask.title, updatedTask.description, updatedTask.completed ? 1 : 0, updatedTask.updated_at.toISOString(), updatedTask.sync_status, id]
    );
    
    // 3. Update updated_at timestamp
    // (already done above)
    
    // 4. Set sync_status to 'pending'
    // (already done above)
    
    // 5. Add to sync queue
    await this.db.run(
      'INSERT INTO sync_queue (id, task_id, operation, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, 'update', JSON.stringify(updatedTask), now.toISOString(), 0]
    );
    
    return updatedTask as Task;
  }

  async deleteTask(id: string): Promise<boolean> {
    // 1. Check if task exists
    const existingTask = await this.db.get('SELECT * FROM tasks WHERE id = ? AND is_deleted = 0', [id]);
    if (!existingTask) {
      return false;
    }
    
    // 2. Set is_deleted to true
    const now = new Date();
    await this.db.run(
      'UPDATE tasks SET is_deleted = 1, updated_at = ?, sync_status = ? WHERE id = ?',
      [now.toISOString(), 'pending', id]
    );
    
    // 3. Update updated_at timestamp
    // (already done above)
    
    // 4. Set sync_status to 'pending'
    // (already done above)
    
    // 5. Add to sync queue
    await this.db.run(
      'INSERT INTO sync_queue (id, task_id, operation, data, created_at, retry_count) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, 'delete', JSON.stringify({ id, is_deleted: true, updated_at: now }), now.toISOString(), 0]
    );
    
    return true;
  }

  async getTask(id: string): Promise<Task | null> {
    // 1. Query database for task by id
    const task = await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    
    // 2. Return null if not found or is_deleted is true
    if (!task || task.is_deleted === 1) {
      return null;
    }
    
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      completed: task.completed === 1,
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
      is_deleted: task.is_deleted === 1,
      sync_status: task.sync_status,
      server_id: task.server_id,
      last_synced_at: task.last_synced_at ? new Date(task.last_synced_at) : undefined
    };
  }

  async getAllTasks(): Promise<Task[]> {
    // 1. Query database for all tasks where is_deleted = false
    const tasks = await this.db.all('SELECT * FROM tasks WHERE is_deleted = 0');
    
    // 2. Return array of tasks
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      completed: task.completed === 1,
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
      is_deleted: task.is_deleted === 1,
      sync_status: task.sync_status,
      server_id: task.server_id,
      last_synced_at: task.last_synced_at ? new Date(task.last_synced_at) : undefined
    }));
  }

  async getTasksNeedingSync(): Promise<Task[]> {
    // Get all tasks with sync_status = 'pending' or 'error'
    const tasks = await this.db.all('SELECT * FROM tasks WHERE sync_status IN (?, ?)', ['pending', 'error']);
    
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      completed: task.completed === 1,
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at),
      is_deleted: task.is_deleted === 1,
      sync_status: task.sync_status,
      server_id: task.server_id,
      last_synced_at: task.last_synced_at ? new Date(task.last_synced_at) : undefined
    }));
  }
}