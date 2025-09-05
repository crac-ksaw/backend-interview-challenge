import { Router, Request, Response } from 'express';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';

export function createTaskRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);

  // Get all tasks
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const tasks = await taskService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get single task
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const task = await taskService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.json(task);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // Create task
  router.post('/', async (req: Request, res: Response) => {
    // 1. Validate request body
    if (!req.body.title || typeof req.body.title !== 'string') {
      return res.status(400).json({ error: 'Title is required and must be a string' });
    }
    
    // 2. Call taskService.createTask()
    try {
      const task = await taskService.createTask({
        title: req.body.title,
        description: req.body.description
      });
      
      // 3. Return created task
      return res.status(201).json(task);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update task
  router.put('/:id', async (req: Request, res: Response) => {
    // 1. Validate request body
    if (req.body.title !== undefined && typeof req.body.title !== 'string') {
      return res.status(400).json({ error: 'Title must be a string' });
    }
    if (req.body.completed !== undefined && typeof req.body.completed !== 'boolean') {
      return res.status(400).json({ error: 'Completed must be a boolean' });
    }
    
    // 2. Call taskService.updateTask()
    try {
      const updatedTask = await taskService.updateTask(req.params.id, {
        title: req.body.title,
        description: req.body.description,
        completed: req.body.completed
      });
      
      // 3. Handle not found case
      if (!updatedTask) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // 4. Return updated task
      return res.json(updatedTask);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Delete task
  router.delete('/:id', async (req: Request, res: Response) => {
    // 1. Call taskService.deleteTask()
    try {
      const deleted = await taskService.deleteTask(req.params.id);
      
      // 2. Handle not found case
      if (!deleted) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // 3. Return success response
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  return router;
}