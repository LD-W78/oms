import { NextResponse } from 'next/server'
import { loadModuleFieldsConfig } from '@/lib/config/module-fields'

interface RouteParams {
  params: Promise<{
    moduleId: string
  }>
}

export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { moduleId } = await params
    const config = await loadModuleFieldsConfig()
    const moduleConfig = config.modules.find(m => m.moduleId === moduleId)
    
    if (!moduleConfig) {
      return NextResponse.json(
        { moduleId, moduleName: moduleId, fieldPermissions: {}, error: 'Module not found' },
        { status: 200 }
      )
    }
    return NextResponse.json(moduleConfig)
  } catch (error) {
    console.error('Failed to load module config:', error)
    let moduleId = ''
    try {
      const p = await params
      moduleId = p.moduleId || ''
    } catch {
      // ignore
    }
    return NextResponse.json(
      { moduleId, moduleName: moduleId, fieldPermissions: {}, error: 'Failed to load module configuration' },
      { status: 200 }
    )
  }
}
