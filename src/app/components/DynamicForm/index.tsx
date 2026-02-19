'use client'

import { useState } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Checkbox, Card, Button, Space, Modal, message } from 'antd'
import { PlusOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons'
interface FieldOption {
  label: string
  value: string
}

interface FormFieldSchema {
  fieldId: string
  fieldName: string
  fieldType: 'text' | 'number' | 'select' | 'date' | 'checkbox'
  required?: boolean
  options?: FieldOption[]
}

interface DynamicFormProps {
  tableId: string
  title?: string
  fields: FormFieldSchema[]
  initialValues?: Record<string, unknown>
  onSave?: (values: Record<string, unknown>) => Promise<void>
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function DynamicForm({
  tableId,
  title = '表单',
  fields,
  initialValues = {},
  onSave,
  onCancel,
  mode = 'create',
}: DynamicFormProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      if (onSave) {
        await onSave(values)
        message.success('保存成功')
        form.resetFields()
      }
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderField = (field: FormFieldSchema) => {
    const rules = field.required ? [{ required: true, message: `请输入${field.fieldName}` }] : []

    switch (field.fieldType) {
      case 'text':
        return (
          <Input placeholder={`请输入${field.fieldName}`} />
        )
      case 'number':
        return (
          <InputNumber placeholder={`请输入${field.fieldName}`} style={{ width: '100%' }} />
        )
      case 'select':
        return (
          <Select placeholder={`请选择${field.fieldName}`}>
            {field.options?.map((option: FieldOption) => (
              <Select.Option key={option.value} value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select>
        )
      case 'date':
        return (
          <DatePicker placeholder={`请选择${field.fieldName}`} style={{ width: '100%' }} />
        )
      case 'checkbox':
        return (
          <Checkbox>是否启用</Checkbox>
        )
      default:
        return (
          <Input placeholder={`请输入${field.fieldName}`} />
        )
    }
  }

  const formItems = fields.map(field => (
    <Form.Item
      key={field.fieldName}
      label={field.fieldName}
      name={field.fieldName}
      rules={field.required ? [{ required: true, message: `请输入${field.fieldName}` }] : []}
    >
      {renderField(field)}
    </Form.Item>
  ))

  return (
    <Card
      title={title}
      extra={
        <Space>
          {onCancel && <Button icon={<CloseOutlined />} onClick={onCancel}>取消</Button>}
          <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSubmit}>
            {mode === 'create' ? '保存' : '更新'}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
      >
        {formItems}
      </Form>
    </Card>
  )
}

interface DynamicFormModalProps extends DynamicFormProps {
  open: boolean
}

export function DynamicFormModal({
  open,
  tableId,
  title,
  fields,
  initialValues,
  onSave,
  onCancel,
  mode,
}: DynamicFormModalProps) {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <DynamicForm
        tableId={tableId}
        fields={fields}
        initialValues={initialValues}
        onSave={onSave}
        onCancel={onCancel}
        mode={mode}
      />
    </Modal>
  )
}
