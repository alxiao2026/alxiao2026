import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge, Button, Card, ConfirmModal, Empty, Field, Input, Loading, Modal, Select, Textarea, toast } from '@/components/ui'
import { ImageUpload } from '@/components/upload'

interface PackageItem {
  id: string
  merchant_id?: string
  name: string
  description?: string
  price?: number | string
  original_price?: number | string | null
  badge?: string
  category?: string
  cover_image?: string
  stock?: number
  sale_start_date?: string | null
  sale_end_date?: string | null
  is_active?: boolean
}

interface MerchantOption {
  id: number
  name: string
}

interface PackageForm {
  name: string
  merchant_id: string
  price: string
  original_price: string
  stock: string
  badge: string
  category: string
  description: string
  cover_image: string
  sale_start_date: string
  sale_end_date: string
}

const emptyForm: PackageForm = {
  name: '',
  merchant_id: '',
  price: '',
  original_price: '',
  stock: '100',
  badge: '',
  category: '',
  description: '',
  cover_image: '',
  sale_start_date: '',
  sale_end_date: '',
}

function money(v: unknown): string {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

export default function PackagesPage() {
  const [list, setList] = useState<PackageItem[]>([])
  const [merchants, setMerchants] = useState<MerchantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PackageItem | null>(null)
  const [form, setForm] = useState<PackageForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<PackageItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const merchantName = (id?: string) => merchants.find((m) => String(m.id) === String(id))?.name || '—'

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const [pkgs, ms] = await Promise.all([
        api.get<PackageItem[]>('/packages'),
        api.get<MerchantOption[]>('/merchants'),
      ])
      setList(Array.isArray(pkgs) ? pkgs : [])
      setMerchants(Array.isArray(ms) ? ms : [])
    } catch (err: any) {
      toast(err?.message || '套餐列表加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (p: PackageItem) => {
    setEditing(p)
    setForm({
      name: p.name || '',
      merchant_id: p.merchant_id ? String(p.merchant_id) : '',
      price: p.price != null ? String(p.price) : '',
      original_price: p.original_price != null ? String(p.original_price) : '',
      stock: p.stock != null ? String(p.stock) : '100',
      badge: p.badge || '',
      category: p.category || '',
      description: p.description || '',
      cover_image: p.cover_image || '',
      sale_start_date: p.sale_start_date ? String(p.sale_start_date).slice(0, 10) : '',
      sale_end_date: p.sale_end_date ? String(p.sale_end_date).slice(0, 10) : '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('请填写套餐名称', 'error')
      return
    }
    if (!form.price || Number(form.price) < 0) {
      toast('请填写正确的售价', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: form.price,
        original_price: form.original_price || undefined,
        stock: Number(form.stock) || 0,
        badge: form.badge.trim(),
        category: form.category.trim(),
        cover_image: form.cover_image || undefined,
        sale_start_date: form.sale_start_date || undefined,
        sale_end_date: form.sale_end_date || undefined,
      }
      if (form.merchant_id) payload.merchant_id = form.merchant_id
      if (editing) {
        await api.put(`/packages/${editing.id}`, payload)
        toast('套餐已更新')
      } else {
        await api.post('/packages', payload)
        toast('套餐创建成功')
      }
      setModalOpen(false)
      fetchList()
    } catch (err: any) {
      toast(err?.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (p: PackageItem) => {
    try {
      await api.put(`/packages/${p.id}`, { is_active: !p.is_active })
      toast(p.is_active ? '已下架' : '已上架')
      fetchList()
    } catch (err: any) {
      toast(err?.message || '操作失败', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await api.del(`/packages/${deleting.id}`)
      toast('套餐已删除')
      setDeleting(null)
      fetchList()
    } catch (err: any) {
      toast(err?.message || '删除失败', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const set = (key: keyof PackageForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">共 {list.length} 个套餐</p>
        <Button onClick={openCreate}>
          <Plus size={15} /> 新建套餐
        </Button>
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty text="暂无套餐">
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> 新建套餐
            </Button>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">套餐</th>
                  <th className="px-5 py-3 font-medium">所属商家</th>
                  <th className="px-5 py-3 font-medium">售价 / 原价</th>
                  <th className="px-5 py-3 font-medium">库存</th>
                  <th className="px-5 py-3 font-medium">售卖周期</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {p.cover_image ? (
                          <img src={p.cover_image} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-400">
                            <Package size={17} />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-800">{p.name}</div>
                          {p.badge && <Badge variant="red" className="mt-0.5">{p.badge}</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-40 truncate">{merchantName(p.merchant_id)}</td>
                    <td className="px-5 py-3">
                      <span className="text-brand font-semibold">¥{money(p.price)}</span>
                      {p.original_price != null && Number(p.original_price) > 0 && (
                        <span className="text-xs text-gray-400 line-through ml-1.5">¥{money(p.original_price)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{p.stock ?? '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {p.sale_start_date ? String(p.sale_start_date).slice(0, 10) : '—'}
                      {' ~ '}
                      {p.sale_end_date ? String(p.sale_end_date).slice(0, 10) : '长期'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleActive(p)}>
                        <Badge variant={p.is_active ? 'green' : 'gray'}>{p.is_active ? '上架中' : '已下架'}</Badge>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil size={14} /> 编辑
                        </Button>
                        <Button size="sm" variant="ghost" className="text-brand hover:bg-red-50" onClick={() => setDeleting(p)}>
                          <Trash2 size={14} /> 删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? '编辑套餐' : '新建套餐'}
        onClose={() => setModalOpen(false)}
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>取消</Button>
            <Button loading={saving} onClick={handleSubmit}>保存</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="套餐名称" required>
              <Input value={form.name} onChange={set('name')} placeholder="如：100元代金券" />
            </Field>
            <Field label="所属商家" required>
              <Select value={form.merchant_id} onChange={set('merchant_id')}>
                <option value="">请选择商家</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="售价（元）" required>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" />
            </Field>
            <Field label="原价（元）">
              <Input type="number" min="0" step="0.01" value={form.original_price} onChange={set('original_price')} placeholder="可不填" />
            </Field>
            <Field label="库存">
              <Input type="number" min="0" value={form.stock} onChange={set('stock')} />
            </Field>
            <Field label="角标">
              <Input value={form.badge} onChange={set('badge')} placeholder="如：热卖 / 新品" />
            </Field>
            <Field label="售卖开始日期">
              <Input type="date" value={form.sale_start_date} onChange={set('sale_start_date')} max={form.sale_end_date} />
            </Field>
            <Field label="售卖结束日期">
              <Input type="date" value={form.sale_end_date} onChange={set('sale_end_date')} min={form.sale_start_date} />
            </Field>
            <div className="col-span-2">
              <Field label="套餐封面">
                <ImageUpload value={form.cover_image} onChange={(url) => setForm((f) => ({ ...f, cover_image: url }))} hint="建议正方形图片，用于套餐卡片展示" />
              </Field>
            </div>
          </div>
          <Field label="套餐描述">
            <Textarea value={form.description} onChange={set('description')} placeholder="套餐内容、使用规则等" />
          </Field>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="删除套餐"
        message={`确定删除「${deleting?.name}」吗？已售出的订单不受影响。`}
        confirmText="确认删除"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
