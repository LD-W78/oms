'use client'

import { Form, Input, Select, DatePicker, InputNumber } from 'antd'
import type { FieldConfig } from '@/lib/config/table-metadata'

interface DynamicFormFieldProps {
  field: FieldConfig
  value?: unknown
  onChange?: (value: unknown) => void
}

export function getFormField(field: FieldConfig, value?: unknown, onChange?: (value: unknown) => void) {
  const rules = field.required ? [{ required: true, message: `请输入${field.label}` }] : []

  switch (field.fieldType) {
    case 'select':
    case 'customer':
    case 'product':
      return (
        <Form.Item key={field.key} label={field.label} name={field.key} rules={rules}>
          <Select placeholder={`请选择${field.label}`} onChange={onChange}>
            {field.selectOptions?.map((opt) => (
              <Select.Option key={opt} value={opt}>
                {opt}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )

    case 'date':
      return (
        <Form.Item key={field.key} label={field.label} name={field.key}>
          <DatePicker style={{ width: '100%' }} onChange={onChange} />
        </Form.Item>
      )

    case 'number':
    case 'currency':
      return (
        <Form.Item key={field.key} label={field.label} name={field.key} rules={rules}>
          <InputNumber
            style={{ width: '100%' }}
            placeholder={`请输入${field.label}`}
            onChange={onChange}
            formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value?.replace(/¥\s?|(,*)/g, '') as string}
          />
        </Form.Item>
      )

    default:
      return (
        <Form.Item key={field.key} label={field.label} name={field.key} rules={rules}>
          <Input placeholder={`请输入${field.label}`} onChange={(e) => onChange?.(e.target.value)} />
        </Form.Item>
      )
  }
}

export function getAddableFields(fields: FieldConfig[]) {
  return fields.filter((field) => field.required || field.fieldType === 'select')
}

export function getRequiredFields(fields: FieldConfig[]) {
  return fields.filter((field) => field.required)
}
