/**
 * 银行流水同步异步执行器
 * 负责在后台执行 Python 同步脚本并更新任务状态
 */

import { spawn } from 'child_process';
import path from 'path';
import { env } from '@/lib/config/env';
import { taskStore } from './task-store';

/**
 * 解析 Python 脚本输出的进度信息
 * run_workflow_simulation.py 输出: "待处理 X 个"、"3. 文件名: 解析 N 条"、"共解析 X 条，新增写入 Y 条"
 */
function parseProgress(output: string): number {
  // 尝试匹配 "Progress: 45%" 或 "进度: 45%" 等格式
  const match = output.match(/(?:progress|进度|Progress)[:\s]*(\d+)%?/i);
  if (match) {
    return Math.min(100, Math.max(0, parseInt(match[1], 10)));
  }

  // 尝试匹配 "处理文件 3/10" 格式
  const fileMatch = output.match(/(?:处理文件|files?)\s*(\d+)\s*[/\\]\s*(\d+)/i);
  if (fileMatch) {
    const current = parseInt(fileMatch[1], 10);
    const total = parseInt(fileMatch[2], 10);
    return Math.round((current / total) * 100);
  }

  // 解析 run_workflow_simulation.py 实际输出：待处理 N 个 / 找到 N 个源文件
  const totalMatch =
    output.match(/待处理\s*(\d+)\s*个(?:文件)?/)?.[1] ||
    output.match(/找到\s*(\d+)\s*个源文件/)?.[1] ||
    output.match(/的文件:\s*(\d+)\s*个/)?.[1];
  const total = totalMatch ? parseInt(totalMatch, 10) : 0;

  // 每出现 "3. 文件名: 解析" 表示处理完一个文件
  const processedMatches = output.matchAll(/3\.\s+[^:]+:\s*解析/g);
  const processed = [...processedMatches].length;

  if (total > 0 && processed > 0) {
    return Math.min(95, 5 + Math.floor((processed / total) * 90));
  }

  // 已输出 "共解析" 表示接近完成
  if (/共解析\s*\d+\s*条/.test(output)) {
    return 95;
  }

  return 0;
}

/**
 * 解析 Python 脚本的执行结果
 * 支持: "新增写入 128 条"、"共解析 X 条，新增写入 Y 条"、"新增 128 条记录"
 */
function parseResult(output: string): {
  totalFiles?: number;
  newRecords?: number;
  errors?: string[];
} {
  const result: {
    totalFiles?: number;
    newRecords?: number;
    errors?: string[];
  } = {};

  // 匹配 "新增写入 128 条" 或 "新增 128 条记录"
  const recordsMatch =
    output.match(/(?:新增写入|新增)\s*(\d+)\s*条/i) ||
    output.match(/(?:added|new)\s*(\d+)\s*(?:条记录|records?)/i);
  if (recordsMatch) {
    result.newRecords = parseInt(recordsMatch[1], 10);
  }

  // 匹配 "处理 5 个文件" 或 "待处理 5 个"
  const filesMatch =
    output.match(/(?:待处理|处理)\s*(\d+)\s*(?:个文件|个)/i) ||
    output.match(/(?:processed)\s*(\d+)\s*(?:files?)/i);
  if (filesMatch) {
    result.totalFiles = parseInt(filesMatch[1], 10);
  }

  // 收集错误信息
  const errors: string[] = [];
  const errorLines = output.split('\n').filter((line) =>
    /(?:error|错误|failed|失败|exception)/i.test(line)
  );
  if (errorLines.length > 0) {
    result.errors = errorLines.slice(0, 5); // 最多保留 5 条错误
  }

  return result;
}

/**
 * 执行银行流水同步任务
 * @param taskId 任务 ID
 * @param options 可选参数
 */
export async function runBankflowSync(
  taskId: string,
  options?: {
    source?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<void> {
  const modulePath = path.join(process.cwd(), 'modules', 'bankflow');

  // 更新任务状态为运行中
  taskStore.updateTask(taskId, { status: 'running', progress: 5 });

  // 准备环境变量，复用 OMS 的飞书凭证；PYTHONUNBUFFERED 使输出实时显示
  const envVars = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    FEISHU_APP_ID: env.FEISHU_APP_ID || '',
    FEISHU_APP_SECRET: env.FEISHU_APP_SECRET || '',
  };

  // 构建命令参数
  const args = [path.join(modulePath, 'scripts', 'run_workflow_simulation.py')];
  if (options?.source) {
    args.push('-o', options.source);
  }
  if (options?.dateFrom && options?.dateTo) {
    // 日期范围参数（如果脚本支持）
    args.push('--date-from', options.dateFrom, '--date-to', options.dateTo);
  }

  return new Promise((resolve, reject) => {
    const python = spawn('python3', args, {
      cwd: modulePath,
      env: envVars,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';
    let lastProgress = 5;

    // 收集标准输出，实时更新任务 output
    python.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;

      // 解析进度（使用完整累积输出）
      const progress = parseProgress(output);
      if (progress > lastProgress) {
        lastProgress = progress;
      }
      // 实时追加输出（供弹窗展示）
      const currentErr = errorOutput;
      const fullSoFar = [output, currentErr].filter(Boolean).join('\n\n--- stderr ---\n');
      taskStore.updateTask(taskId, { progress: lastProgress, output: fullSoFar.substring(0, 10000) });
    });

    // 收集错误输出
    python.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      const fullSoFar = [output, errorOutput].filter(Boolean).join('\n\n--- stderr ---\n');
      taskStore.updateTask(taskId, { output: fullSoFar.substring(0, 10000) });
    });

    // 进程结束
    python.on('close', (code) => {
      const fullOutput = [output, errorOutput].filter(Boolean).join('\n\n--- stderr ---\n');
      if (code === 0) {
        const result = parseResult(output);
        taskStore.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          result,
          output: fullOutput.substring(0, 10000), // 最多保留 10k 字符
        });
        resolve();
      } else {
        const error = errorOutput || `进程退出码: ${code}`;
        taskStore.updateTask(taskId, {
          status: 'failed',
          progress: lastProgress,
          error: error.substring(0, 500),
          output: fullOutput.substring(0, 10000),
        });
        reject(new Error(error));
      }
    });

    // 进程错误
    python.on('error', (err) => {
      taskStore.updateTask(taskId, {
        status: 'failed',
        error: err.message,
      });
      reject(err);
    });
  });
}

/**
 * 执行校验任务（validate_bankflow.py）
 */
export async function runBankflowVerify(taskId: string): Promise<void> {
  const modulePath = path.join(process.cwd(), 'modules', 'bankflow');

  taskStore.updateTask(taskId, { status: 'running', progress: 10, output: '校验中...' });

  const envVars = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    FEISHU_APP_ID: env.FEISHU_APP_ID || '',
    FEISHU_APP_SECRET: env.FEISHU_APP_SECRET || '',
  };

  return new Promise((resolve, reject) => {
    const python = spawn(
      'python3',
      [path.join(modulePath, 'scripts', 'validate_bankflow.py')],
      {
        cwd: modulePath,
        env: envVars,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data: Buffer) => {
      output += data.toString();
      const full = [output, errorOutput].filter(Boolean).join('\n\n--- stderr ---\n');
      taskStore.updateTask(taskId, { output: full.substring(0, 10000) });
    });

    python.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      const full = [output, errorOutput].filter(Boolean).join('\n\n--- stderr ---\n');
      taskStore.updateTask(taskId, { output: full.substring(0, 10000) });
    });

    python.on('close', (code) => {
      const fullOutput = [output, errorOutput].filter(Boolean).join('\n\n--- stderr ---\n');
      // 校验脚本 exit 0=通过，exit 1=完成但数据有问题(is_valid=false)，均视为完成并展示输出
      if (code === 0 || code === 1) {
        taskStore.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          output: fullOutput.substring(0, 10000),
          result: { output: output.substring(0, 2000) } as any,
        });
        resolve();
      } else {
        taskStore.updateTask(taskId, {
          status: 'failed',
          error: errorOutput || `校验异常，退出码: ${code}`,
          output: fullOutput.substring(0, 10000),
        });
        reject(new Error(errorOutput || `退出码: ${code}`));
      }
    });

    python.on('error', (err) => {
      taskStore.updateTask(taskId, {
        status: 'failed',
        error: err.message,
      });
      reject(err);
    });
  });
}
