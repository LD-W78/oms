import { NextResponse } from 'next/server'
import { getTableConfig } from '@/lib/config/table-metadata'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const route = searchParams.get('route')

  if (!route) {
    // Return empty tables list since TABLE_CONFIGS is internal
    return NextResponse.json({
      tables: [],
    })
  }

  const config = getTableConfig(route)

  if (!config) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  return NextResponse.json({
    config: {
      id: config.id,
      name: config.name,
      route: config.route,
      icon: config.icon,
      enableAdd: config.enableAdd,
      enableEdit: config.enableEdit,
      enableDelete: config.enableDelete,
      pageSize: config.pageSize,
      fields: config.fields,
    },
  })
}
