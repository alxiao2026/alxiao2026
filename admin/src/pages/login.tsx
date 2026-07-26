import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartyPopper, Phone, LockKeyhole } from 'lucide-react'
import { api } from '@/lib/api'
import { setAdminUser, AdminUser } from '@/lib/auth'
import { Button, Input, toast } from '@/components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!phone.trim() || !password) {
      toast('请输入手机号和密码', 'error')
      return
    }
    setLoading(true)
    try {
      const user = await api.post<AdminUser>('/users/login/password', { phone: phone.trim(), password })
      if (!user || (user.role !== 'admin' && user.role !== 'merchant')) {
        toast('该账号无管理后台权限', 'error')
        return
      }
      setAdminUser(user)
      toast(`欢迎回来，${user.nick_name || user.phone}`)
      navigate('/', { replace: true })
    } catch (err: any) {
      toast(err?.message || '登录失败，请检查账号密码', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-100 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand-light" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-orange-50" />

      <div className="relative w-full max-w-sm mx-4">
        <div className="bg-white rounded-2xl shadow-xl px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center text-white shadow-lg mb-4">
              <PartyPopper size={28} />
            </div>
            <h1 className="text-xl font-bold text-gray-800">膨胀团 · 管理后台</h1>
            <p className="text-sm text-gray-400 mt-1">给生活来点小惊喜</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="relative mb-4">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9 h-11"
                placeholder="请输入手机号"
                value={phone}
                maxLength={11}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="relative mb-6">
              <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9 h-11"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              登 录
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">仅限系统管理员与商家账号登录</p>
        </div>
      </div>
    </div>
  )
}
