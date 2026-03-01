/**
 * 银行流水同步任务状态查询 API
 * GET /api/bankflow/status/:taskId
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskStore } from '@/lib/bankflow/task-store';

interface RouteParams {
  params: Promise<{
    taskId: string;
  }>;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少任务 ID',
        },
        { status: 400 }
      );
    }

    const task = taskStore.getTask(taskId);

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          message: '任务不存在或已过期',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      taskId: task.taskId,
      status: task.status,
      progress: task.progress,
      result: task.result,
      output: task.output,
      error: task.error,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt:
        task.status === 'completed' || task.status === 'failed'
          ? task.updatedAt.toISOString()
          : undefined,
    });
  } catch (error) {
    console.error('[BankflowStatus] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '查询失败',
      },
      { status: 500 }
    );
  }
}
