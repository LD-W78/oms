import { NextRequest, NextResponse } from 'next/server'
import { log500 } from '@/lib/debug-log'
import {
  loadModuleFieldsConfig,
  saveModuleFieldsConfig,
  updateModuleConfig,
  batchUpdateFieldPermissions
} from '@/lib/config/module-fields'
import type { ModuleFieldsConfig, FieldPermission } from '@/types/module-fields'

export async function GET(): Promise<NextResponse> {
  try {
    const config = await loadModuleFieldsConfig()
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to load module fields config:', error)
    return NextResponse.json(
      { version: '1.0', lastUpdated: new Date().toISOString(), modules: [], error: 'Failed to load configuration' },
      { status: 200 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'save': {
        const config = data as ModuleFieldsConfig
        await saveModuleFieldsConfig(config)
        return NextResponse.json({ success: true })
      }

      case 'updateModule': {
        const { moduleId, updates } = data
        await updateModuleConfig(moduleId, updates)
        return NextResponse.json({ success: true })
      }

      case 'batchUpdatePermissions': {
        const { moduleId, permissions } = data as {
          moduleId: string
          permissions: Record<string, FieldPermission>
        }
        await batchUpdateFieldPermissions(moduleId, permissions)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Failed to save module fields config:', error)
    // #region agent log
    log500('/api/config/modules', 'POST', error)
    // #endregion
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
