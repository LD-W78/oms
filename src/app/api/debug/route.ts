/**
 * 探活：确认 /api/debug 可访问
 * GET /api/debug
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, message: 'debug', timestamp: Date.now() })
}
