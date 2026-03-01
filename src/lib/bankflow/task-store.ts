/**
 * 银行流水同步任务状态存储
 * 使用内存 Map 存储，Vercel 环境下任务会在冷启动后丢失
 * 如需持久化，可改用 Redis 或写入 /tmp 目录
 */

export interface Task {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: {
    totalFiles?: number;
    newRecords?: number;
    errors?: string[];
  };
  /** 同步过程完整输出（stdout + stderr） */
  output?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 使用 globalThis 持久化，避免 Next.js 开发态 HMR/多 worker 导致任务丢失
const globalForTaskStore = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {}));
const tasksMap = (globalForTaskStore as Record<string, Map<string, Task>>).__bankflowTasks ?? new Map<string, Task>();
if (!(globalForTaskStore as Record<string, unknown>).__bankflowTasks) {
  (globalForTaskStore as Record<string, Map<string, Task>>).__bankflowTasks = tasksMap;
}

class TaskStore {
  private tasks = tasksMap;

  /**
   * 创建新任务
   * @returns 任务 ID
   */
  createTask(): string {
    const taskId = `bf-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date();
    this.tasks.set(taskId, {
      taskId,
      status: 'pending',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    });
    return taskId;
  }

  /**
   * 更新任务状态
   */
  updateTask(taskId: string, update: Partial<Task>): void {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, update, { updatedAt: new Date() });
    }
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务（可选：按状态筛选）
   */
  getAllTasks(filterStatus?: Task['status']): Task[] {
    const tasks = Array.from(this.tasks.values());
    if (filterStatus) {
      return tasks.filter((t) => t.status === filterStatus);
    }
    return tasks;
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  /**
   * 清理过期任务（保留最近 24 小时的任务）
   */
  cleanupOldTasks(maxAgeHours = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.createdAt < cutoff) {
        this.tasks.delete(taskId);
      }
    }
  }

  /**
   * 检查是否有正在运行的任务
   */
  hasRunningTask(): boolean {
    return this.getAllTasks('running').length > 0;
  }
}

// 导出单例
export const taskStore = new TaskStore();

// 每小时清理一次过期任务
if (typeof window === 'undefined') {
  // 仅在服务端执行
  setInterval(() => {
    taskStore.cleanupOldTasks();
  }, 60 * 60 * 1000);
}
