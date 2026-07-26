import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Store } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge, Button, Card, ConfirmModal, Empty, Field, Input, Loading, Modal, Textarea, toast } from '@/components/ui'
import { ImageUpload } from '@/components/upload'

interface Merchant {
  id: number
  name: string
  logo?: string
  address?: string
  phone?: string
  business_hours?: string
  category?: string
  description?: string
  created_at?: string
}

interface MerchantForm {
  name: string
  category: string
  address: string
  phone: string
  business_hours: string
  description: string
  logo: string
  admin_phone: string
  admin_password: string
}

const emptyForm: MerchantForm = {
  name: '',
  category: '',
  address: '',
  phone: '',
  business_hours: '',
  description: '',
  logo: '',
  admin_phone: '',
  admin_password: '',
}

export default function MerchantsPage() {
  const [list, setList] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Merchant | null>(null)
  const [form, setForm] = useState<MerchantForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Merchant | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<Merchant[]>('/merchants')
      setList(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast(err?.message || '商家列表加载失败', 'error')
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

  const openEdit = (m: Merchant) => {
    setEditing(m)
    setForm({
      name: m.name || '',
      category: m.category || '',
      address: m.address || '',
      phone: m.phone || '',
      business_hours: m.business_hours || '',
      description: m.description || '',
      logo: m.logo || '',
      admin_phone: '',
      admin_password: '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('请填写商家名称', 'error')
      return
    }
    if (!editing && (!form.admin_phone.trim() || !form.admin_password)) {
      toast('新建商家需填写管理员手机号与密码', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        business_hours: form.business_hours.trim(),
        description: form.description.trim(),
        logo: form.logo,
      }
      if (form.admin_phone.trim()) payload.admin_phone = form.admin_phone.trim()
      if (form.admin_password) payload.admin_password = form.admin_password
      if (editing) {
        await api.put(`/merchants/${editing.id}`, payload)
        toast('商家已更新')
      } else {
        await api.post('/merchants', payload)
        toast('商家创建成功')
      }
      setModalOpen(false)
      fetchList()
    } catch (err: any) {
      toast(err?.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await api.del(`/merchants/${deleting.id}`)
      toast('商家已删除')
      setDeleting(null)
      fetchList()
    } catch (err: any) {
      toast(err?.message || '删除失败', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const set = (key: keyof MerchantForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">共 {list.length} 家门店</p>
        <Button onClick={openCreate}>
          <Plus size={15} /> 新建商家
        </Button>
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty text="暂无商家">
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> 新建商家
            </Button>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">商家</th>
                  <th className="px-5 py-3 font-medium">分类</th>
                  <th className="px-5 py-3 font-medium">地址</th>
                  <th className="px-5 py-3 font-medium">联系电话</th>
                  <th className="px-5 py-3 font-medium">营业时间</th>
                  <th className="px-5 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {m.logo ? (
                          <img src={m.logo} alt={m.name} className="w-9 h-9 rounded-lg object-cover border border-gray-100" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center text-brand">
                            <Store size={16} />
                          </div>
                        )}
                        <span className="font-medium text-gray-800">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">{m.category ? <Badge variant="orange">{m.category}</Badge> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-48 truncate">{m.address || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{m.phone || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{m.business_hours || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                          <Pencil size={14} /> 编辑
                        </Button>
                        <Button size="sm" variant="ghost" className="text-brand hover:bg-red-50" onClick={() => setDeleting(m)}>
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

      {/* 新建/编辑弹窗 */}
      <Modal
        open={modalOpen}
        title={editing ? `编辑商家 · ${editing.name}` : '新建商家'}
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
            <Field label="商家名称" required>
              <Input value={form.name} onChange={set('name')} placeholder="如：朱娇娇酸汤肥牛火锅" />
            </Field>
            <Field label="分类">
              <Input value={form.category} onChange={set('category')} placeholder="如：餐饮美食" />
            </Field>
            <Field label="门店地址">
              <Input value={form.address} onChange={set('address')} placeholder="门店详细地址" />
            </Field>
            <Field label="联系电话">
              <Input value={form.phone} onChange={set('phone')} placeholder="门店联系电话" />
            </Field>
            <Field label="营业时间">
              <Input value={form.business_hours} onChange={set('business_hours')} placeholder="如：10:00-22:00" />
            </Field>
            <Field label="门店 LOGO">
              <ImageUpload value={form.logo} onChange={(url) => setForm((f) => ({ ...f, logo: url }))} />
            </Field>
          </div>
          <Field label="商家简介">
            <Textarea value={form.description} onChange={set('description')} placeholder="门店特色、招牌菜品等" />
          </Field>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mt-2">
            <p className="text-xs font-medium text-gray-500 mb-3">
              管理员账号{editing ? '（留空则不修改；填写已有手机号将关联该账号为商家）' : ''}
            </p>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label="管理员手机号" required={!editing}>
                <Input value={form.admin_phone} onChange={set('admin_phone')} placeholder="登录手机号" maxLength={11} />
              </Field>
              <Field label="登录密码" required={!editing}>
                <Input type="password" value={form.admin_password} onChange={set('admin_password')} placeholder="登录密码" />
              </Field>
            </div>
          </div>
        </form>
      </Modal>

      {/* 删除确认 */}
      <ConfirmModal
        open={!!deleting}
        title="删除商家"
        message={`确定删除「${deleting?.name}」吗？删除后该商家的套餐、奖品将无法正常展示，请谨慎操作。`}
        confirmText="确认删除"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
