/**
 * 银行流水校验 API
 * POST /api/bankflow/verify
 * 执行 validate_bankflow.py 校验同步结果
 */

import { NextResponse } from 'next/server';
import { taskStore } from '@/lib/bankflow/task-store';
import { runBankflowVerify } from '@/lib/bankflow/runner';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    if (taskStore.hasRunningTask()) {
      return NextResponse.json(
        {
          success: false,
          message: '已有任务正在运行，请等待完成后再试',
        },
        { status: 429 }
      );
    }

    const taskId = taskStore.createTask();

    runBankflowVerify(taskId).catch((err) => {
      console.error(`[BankflowVerify] Task ${taskId} failed:`, err);
      taskStore.updateTask(taskId, {
        status: 'failed',
        error: err.message || '校验异常',
      });
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: '校验任务已启动',
    });
  } catch (error) {
    console.error('[BankflowVerify] Failed to start:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '启动校验失败',
      },
      { status: 500 }
    );
  }
}
