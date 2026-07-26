import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Gift } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge, Button, Card, ConfirmModal, Empty, Field, Input, Loading, Modal, Select, Textarea, toast } from '@/components/ui'
import { ImageUpload } from '@/components/upload'

type PrizeType = 'coupon' | 'product' | 'free_meal'

interface Prize {
  id: string
  name: string
  description?: string | null
  probability?: string
  image_url?: string | null
  stock?: number
  prize_type?: PrizeType
  coupon_amount?: number
  coupon_min_spend?: number
  product_name?: string
  product_value?: number
  merchant_id?: number | null
  validity_hours?: number | null
  daily_quota?: number | null
  is_fallback?: boolean
  is_active?: boolean
}

interface MerchantOption {
  id: number
  name: string
}

interface PrizeForm {
  name: string
  prize_type: PrizeType
  probability: string
  stock: string
  merchant_id: string
  product_name: string
  product_value: string
  coupon_amount: string
  coupon_min_spend: string
  validity_hours: string
  daily_quota: string
  is_fallback: boolean
  description: string
  image_url: string
}

const emptyForm: PrizeForm = {
  name: '',
  prize_type: 'product',
  probability: '10',
  stock: '100',
  merchant_id: '',
  product_name: '',
  product_value: '',
  coupon_amount: '',
  coupon_min_spend: '',
  validity_hours: '72',
  daily_quota: '',
  is_fallback: false,
  description: '',
  image_url: '',
}

const typeLabels: Record<PrizeType, { label: string; badge: 'purple' | 'orange' | 'red' }> = {
  product: { label: '实物奖品', badge: 'orange' },
  coupon: { label: '优惠券', badge: 'purple' },
  free_meal: { label: '霸王餐', badge: 'red' },
}

export default function PrizesPage() {
  const [list, setList] = useState<Prize[]>([])
  const [merchants, setMerchants] = useState<MerchantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Prize | null>(null)
  const [form, setForm] = useState<PrizeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Prize | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const merchantName = (id?: number | null) =>
    id == null ? '平台通用' : merchants.find((m) => m.id === Number(id))?.name || `商家 #${id}`

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const [prizes, ms] = await Promise.all([
        api.get<Prize[]>('/prizes'),
        api.get<MerchantOption[]>('/merchants'),
      ])
      setList(Array.isArray(prizes) ? prizes : [])
      setMerchants(Array.isArray(ms) ? ms : [])
    } catch (err: any) {
      toast(err?.message || '奖品列表加载失败', 'error')
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

  const openEdit = (p: Prize) => {
    setEditing(p)
    setForm({
      name: p.name || '',
      prize_type: p.prize_type || 'product',
      probability: p.probability || '10',
      stock: p.stock != null ? String(p.stock) : '100',
      merchant_id: p.merchant_id != null ? String(p.merchant_id) : '',
      product_name: p.product_name || '',
      product_value: p.product_value != null && p.product_value > 0 ? String(p.product_value) : '',
      coupon_amount: p.coupon_amount != null && p.coupon_amount > 0 ? String(p.coupon_amount) : '',
      coupon_min_spend: p.coupon_min_spend != null && p.coupon_min_spend > 0 ? String(p.coupon_min_spend) : '',
      validity_hours: p.validity_hours != null ? String(p.validity_hours) : '72',
      daily_quota: p.daily_quota != null && p.daily_quota > 0 ? String(p.daily_quota) : '',
      is_fallback: p.is_fallback ?? false,
      description: p.description || '',
      image_url: p.image_url || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('请填写奖品名称', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        prize_type: form.prize_type,
        probability: form.is_fallback ? '0' : form.probability || '0',
        stock: Number(form.stock) || 0,
        merchant_id: form.merchant_id ? Number(form.merchant_id) : null,
        validity_hours: form.validity_hours ? Number(form.validity_hours) : null,
        daily_quota: form.daily_quota ? Number(form.daily_quota) : null,
        is_fallback: form.is_fallback,
        description: form.description.trim(),
        image_url: form.image_url || undefined,
      }
      if (form.prize_type === 'product' || form.prize_type === 'free_meal') {
        payload.product_name = form.product_name.trim()
        payload.product_value = form.product_value ? Number(form.product_value) : 0
      }
      if (form.prize_type === 'coupon') {
        payload.coupon_amount = form.coupon_amount ? Number(form.coupon_amount) : 0
        payload.coupon_min_spend = form.coupon_min_spend ? Number(form.coupon_min_spend) : 0
      }
      if (editing) {
        await api.put(`/prizes/${editing.id}`, payload)
        toast('奖品已更新')
      } else {
        await api.post('/prizes', payload)
        toast('奖品创建成功')
      }
      setModalOpen(false)
      fetchList()
    } catch (err: any) {
      toast(err?.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (p: Prize) => {
    try {
      await api.put(`/prizes/${p.id}`, { is_active: !p.is_active })
      toast(p.is_active ? '奖品已停用' : '奖品已启用')
      fetchList()
    } catch (err: any) {
      toast(err?.message || '操作失败', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await api.del(`/prizes/${deleting.id}`)
      toast('奖品已删除')
      setDeleting(null)
      fetchList()
    } catch (err: any) {
      toast(err?.message || '删除失败', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const set = (key: keyof PrizeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const prizeDetail = (p: Prize): string => {
    if (p.prize_type === 'coupon') return `满 ${p.coupon_min_spend || 0} 减 ${p.coupon_amount || 0} 元`
    if (p.product_name) return p.product_value ? `${p.product_name}（价值 ¥${p.product_value}）` : p.product_name
    return '—'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">共 {list.length} 个奖品</p>
        <Button onClick={openCreate}>
          <Plus size={15} /> 新建奖品
        </Button>
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty text="暂无奖品">
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> 新建奖品
            </Button>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">奖品</th>
                  <th className="px-5 py-3 font-medium">类型</th>
                  <th className="px-5 py-3 font-medium">内容</th>
                  <th className="px-5 py-3 font-medium">中奖概率</th>
                  <th className="px-5 py-3 font-medium">库存</th>
                  <th className="px-5 py-3 font-medium">每日限量</th>
                  <th className="px-5 py-3 font-medium">有效期</th>
                  <th className="px-5 py-3 font-medium">所属商家</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const t = typeLabels[p.prize_type || 'coupon']
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-gold">
                              <Gift size={17} />
                            </div>
                          )}
                          <span className="font-medium text-gray-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={t.badge}>{t.label}</Badge>
                          {p.is_fallback && <Badge variant="green">兜底</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-44 truncate">{prizeDetail(p)}</td>
                      <td className="px-5 py-3 text-gray-500">{p.is_fallback ? '自动（兜底）' : `${p.probability || 0}%`}</td>
                      <td className="px-5 py-3 text-gray-500">{p.is_fallback ? '∞' : (p.stock ?? '—')}</td>
                      <td className="px-5 py-3 text-gray-500">{p.daily_quota ? `${p.daily_quota} 份` : '不限'}</td>
                      <td className="px-5 py-3 text-gray-500">{p.validity_hours ? `${p.validity_hours} 小时` : '默认 72 小时'}</td>
                      <td className="px-5 py-3 text-gray-500 max-w-36 truncate">{merchantName(p.merchant_id)}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => toggleActive(p)}>
                          <Badge variant={p.is_active ? 'green' : 'gray'}>{p.is_active ? '启用中' : '已停用'}</Badge>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? '编辑奖品' : '新建奖品'}
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
            <Field label="奖品名称" required>
              <Input value={form.name} onChange={set('name')} placeholder="如：可乐一听" />
            </Field>
            <Field label="奖品类型" required>
              <Select value={form.prize_type} onChange={set('prize_type')}>
                <option value="product">实物奖品</option>
                <option value="coupon">优惠券</option>
                <option value="free_meal">霸王餐</option>
              </Select>
            </Field>
            {!form.is_fallback && (
              <Field label="中奖概率（%）" required hint="该奖品的真实中奖率，不随库存减少而改变；各奖品概率之和不超过 100%，剩余部分进入兜底区">
                <Input type="number" min="0" max="100" step="0.1" value={form.probability} onChange={set('probability')} />
              </Field>
            )}
            <Field label="库存" hint={form.is_fallback ? '兜底奖永远有货，不消耗库存，此处仅作记录' : '抽完即止，耗尽后该奖品概率份额进入兜底区'}>
              <Input type="number" min="0" value={form.stock} onChange={set('stock')} />
            </Field>
            <Field label="每日限量" hint="每天最多中出几份，留空为不限；当日用完后概率份额进入兜底区">
              <Input type="number" min="1" value={form.daily_quota} onChange={set('daily_quota')} placeholder="不限" />
            </Field>
            {(form.prize_type === 'product' || form.prize_type === 'free_meal') && (
              <>
                <Field label="单品名称">
                  <Input value={form.product_name} onChange={set('product_name')} placeholder="如：旺仔牛奶一罐" />
                </Field>
                <Field label="单品价值（元）">
                  <Input type="number" min="0" step="0.01" value={form.product_value} onChange={set('product_value')} placeholder="可不填" />
                </Field>
              </>
            )}
            {form.prize_type === 'coupon' && (
              <>
                <Field label="优惠金额（元）">
                  <Input type="number" min="0" step="0.01" value={form.coupon_amount} onChange={set('coupon_amount')} />
                </Field>
                <Field label="使用门槛（满多少元可用）">
                  <Input type="number" min="0" step="0.01" value={form.coupon_min_spend} onChange={set('coupon_min_spend')} placeholder="0 表示无门槛" />
                </Field>
              </>
            )}
            <Field label="兑换有效期（小时）" hint="中奖后需在有效期内到店核销">
              <Input type="number" min="1" value={form.validity_hours} onChange={set('validity_hours')} />
            </Field>
            <Field label="所属商家" hint="不选则为平台通用奖品">
              <Select value={form.merchant_id} onChange={set('merchant_id')}>
                <option value="">平台通用</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </Field>
            <div className="col-span-2">
              <label className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_fallback}
                  onChange={(e) => setForm((f) => ({ ...f, is_fallback: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-amber-500"
                />
                <span className="text-xs leading-relaxed text-amber-800">
                  <span className="font-semibold">设为兜底奖（阳光普照）</span>
                  <br />
                  其他奖品未命中、库存耗尽或每日限量用完时，用户将中得兜底奖，保证「必中」体验。兜底奖中奖率 = 100% − 其他奖品概率之和，永远有货、不消耗库存。未设置兜底奖时，落入兜底区的用户将看到「再接再厉」。
                </span>
              </label>
            </div>
            <div className="col-span-2">
              <Field label="奖品图片">
                <ImageUpload value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
              </Field>
            </div>
          </div>
          <Field label="奖品说明">
            <Textarea value={form.description} onChange={set('description')} placeholder="兑换规则、使用说明等" />
          </Field>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="删除奖品"
        message={`确定删除「${deleting?.name}」吗？已中奖未核销的记录将无法兑换。`}
        confirmText="确认删除"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
