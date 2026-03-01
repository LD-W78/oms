/**
 * 银行流水同步 API
 * POST /api/bankflow/sync
 * 异步启动同步任务，立即返回任务 ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { taskStore } from '@/lib/bankflow/task-store';
import { runBankflowSync } from '@/lib/bankflow/runner';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 检查是否已有正在运行的任务
    if (taskStore.hasRunningTask()) {
      return NextResponse.json(
        {
          success: false,
          message: '已有同步任务正在运行，请等待完成后再试',
        },
        { status: 429 }
      );
    }

    // 解析请求体（可选参数）
    let options: { source?: string; dateFrom?: string; dateTo?: string } = {};
    try {
      const body = await request.json();
      options = {
        source: body.source,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      };
    } catch {
      // 忽略解析错误，使用默认空选项
    }

    // 创建任务
    const taskId = taskStore.createTask();

    // 异步启动同步（不等待完成）
    runBankflowSync(taskId, options).catch((err) => {
      console.error(`[BankflowSync] Task ${taskId} failed:`, err);
      taskStore.updateTask(taskId, {
        status: 'failed',
        error: err.message || '执行异常',
      });
    });

    // 立即返回任务 ID
    return NextResponse.json({
      success: true,
      taskId,
      message: '同步任务已启动，请通过消息通知查看结果',
    });
  } catch (error) {
    console.error('[BankflowSync] Failed to start sync:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '启动同步任务失败',
      },
      { status: 500 }
    );
  }
}
