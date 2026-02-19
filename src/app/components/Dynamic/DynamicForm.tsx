'use client'

import { Form, Input, Select, DatePicker, InputNumber, Checkbox } from 'antd'
import type { FieldConfig } from '@/lib/config/table-metadata'

interface DynamicFormProps {
  fields: FieldConfig[]
  form: any
}

export function DynamicFormFields({ fields, form }: DynamicFormProps) {
  return (
    <>
      {fields.map((field) => {
        const rules = field.required ? [{ required: true, message: `请输入${field.label}` }] : []

        switch (field.fieldType) {
          case 'text':
          case 'customer':
          case 'product':
          case 'supplier':
            return (
              <Form.Item key={field.key} label={field.label} name={field.key} rules={rules}>
                <Input placeholder={`请输入${field.label}`} />
              </Form.Item>
            )

          case 'number':
            return (
              <Form.Item key={field.key} label={field.label} name={field.key} rules={rules}>
                <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.label}`} />
              </Form.Item>
            )

          case 'currency':
            return (
              <Form.Item key={field.key} label={field.label} name={field.key} rules={rules}>
                <Input placeholder="¥0" addonBefore="¥" />
              </Form.Item>
            )

          case 'date':
            return (
              <Form.Item key={field.key} label={field.label} name={field.key}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            )

          case 'select':
            return (
              <Form.Item key={field.key} label={field.label} name={field.key} rules={rules}>
                <Select placeholder={`请选择${field.label}`}>
                  {field.selectOptions?.map((opt) => (
                    <Select.Option key={opt} value={opt}>
                      {opt}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )

          case 'boolean':
            return (
              <Form.Item key={field.key} name={field.key} valuePropName="checked">
                <Checkbox>{field.label}</Checkbox>
              </Form.Item>
            )

          default:
            return null
        }
      })}
    </>
  )
}
