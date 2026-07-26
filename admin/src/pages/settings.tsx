import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { api } from '@/lib/api'
import { Button, Card, Field, Input, Loading, Select, toast } from '@/components/ui'

interface LotterySettings {
  daily_free_draws?: number
  lottery_type?: string
  enabled?: boolean
  share_reward_draws?: number
  max_daily_draws?: number
  lottery_mode?: string
  lottery_cost_type?: string
  reward_per_ad?: number
  max_daily_draws_per_user?: number
  lottery_cost_amount?: number
  cost_per_draw?: number
  share_boost_per_count?: number
  share_boost_max_count?: number
  updated_at?: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<LotterySettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<LotterySettings>('/lottery/settings')
      setSettings(data || {})
    } catch (err: any) {
      toast(err?.message || '抽奖设置加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/lottery/settings', {
        enabled: settings.enabled !== false,
        daily_free_draws: Number(settings.daily_free_draws) || 0,
        share_reward_draws: Number(settings.share_reward_draws) || 0,
        max_daily_draws: Number(settings.max_daily_draws) || 0,
        max_daily_draws_per_user: Number(settings.max_daily_draws_per_user) || 0,
        reward_per_ad: Number(settings.reward_per_ad) || 0,
        lottery_mode: settings.lottery_mode || 'daily',
        lottery_cost_type: settings.lottery_cost_type || 'free',
        lottery_cost_amount: Number(settings.lottery_cost_amount) || 0,
        cost_per_draw: Number(settings.cost_per_draw) || 0,
        share_boost_per_count: Number(settings.share_boost_per_count ?? 0.5) || 0.5,
        share_boost_max_count: Number(settings.share_boost_max_count ?? 10) || 10,
      })
      toast('抽奖设置已保存')
      fetchSettings()
    } catch (err: any) {
      toast(err?.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const numField = (key: keyof LotterySettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((s) => ({ ...s, [key]: e.target.value === '' ? 0 : Number(e.target.value) }))

  if (loading) {
    return <Card><Loading /></Card>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      {/* 基础开关 */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">基础设置</h3>
        <div className="grid grid-cols-2 gap-x-6">
          <Field label="抽奖功能开关" hint="关闭后用户端将无法进入抽奖">
            <div className="flex items-center h-9">
              <button
                type="button"
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled !== false ? 'bg-brand' : 'bg-gray-300'}`}
                onClick={() => setSettings((s) => ({ ...s, enabled: s.enabled === false }))}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settings.enabled !== false ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
              <span className="ml-3 text-sm text-gray-600">{settings.enabled !== false ? '已开启' : '已关闭'}</span>
            </div>
          </Field>
          <Field label="抽奖模式">
            <Select
              value={settings.lottery_mode || 'daily'}
              onChange={(e) => setSettings((s) => ({ ...s, lottery_mode: e.target.value }))}
            >
              <option value="daily">每日抽奖</option>
              <option value="consume">消费后抽奖</option>
              <option value="both">每日 + 消费</option>
            </Select>
          </Field>
        </div>
      </Card>

      {/* 次数规则 */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">次数规则</h3>
        <div className="grid grid-cols-2 gap-x-6">
          <Field label="每日免费抽奖次数">
            <Input type="number" min="0" value={settings.daily_free_draws ?? 0} onChange={numField('daily_free_draws')} />
          </Field>
          <Field label="分享奖励次数" hint="用户分享活动后额外获得的次数">
            <Input type="number" min="0" value={settings.share_reward_draws ?? 0} onChange={numField('share_reward_draws')} />
          </Field>
          <Field label="每用户每日上限">
            <Input type="number" min="0" value={settings.max_daily_draws_per_user ?? 0} onChange={numField('max_daily_draws_per_user')} />
          </Field>
          <Field label="平台每日总上限" hint="0 表示不限制">
            <Input type="number" min="0" value={settings.max_daily_draws ?? 0} onChange={numField('max_daily_draws')} />
          </Field>
          <Field label="看广告奖励次数">
            <Input type="number" min="0" value={settings.reward_per_ad ?? 0} onChange={numField('reward_per_ad')} />
          </Field>
        </div>
      </Card>

      {/* 消耗规则 */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">消耗规则</h3>
        <div className="grid grid-cols-2 gap-x-6">
          <Field label="消耗类型">
            <Select
              value={settings.lottery_cost_type || 'free'}
              onChange={(e) => setSettings((s) => ({ ...s, lottery_cost_type: e.target.value }))}
            >
              <option value="free">免费</option>
              <option value="points">积分</option>
              <option value="amount">金额</option>
            </Select>
          </Field>
          <Field label="每次抽奖消耗金额（元）">
            <Input type="number" min="0" step="0.01" value={settings.lottery_cost_amount ?? 0} onChange={numField('lottery_cost_amount')} />
          </Field>
          <Field label="每次抽奖消耗积分">
            <Input type="number" min="0" value={settings.cost_per_draw ?? 0} onChange={numField('cost_per_draw')} />
          </Field>
        </div>
      </Card>

      <Card title="分享加成（霸王餐）" description="分享不再作为抽奖门槛，仅用于提升霸王餐中奖概率">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="每位分享权重加成" hint="默认 0.5，即分享一位好友霸王餐权重 +0.5">
            <Input type="number" min="0" step="0.1" value={settings.share_boost_per_count ?? 0.5} onChange={numField('share_boost_per_count')} />
          </Field>
          <Field label="最多计入分享人数" hint="默认 10，即最高可分享 10 位获得加成">
            <Input type="number" min="0" value={settings.share_boost_max_count ?? 10} onChange={numField('share_boost_max_count')} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button loading={saving} type="submit">
          <Save size={15} /> 保存设置
        </Button>
      </div>
    </form>
  )
}
