import { FormEvent, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge, Button, Card, Empty, Input, Loading, toast } from '@/components/ui'

interface UserItem {
  user_id: string
  nick_name?: string
  phone?: string
  avatar_url?: string | null
  role?: string
  merchant_id?: number | null
  created_at?: string
  last_login_at?: string
}

interface UserListResp {
  list: UserItem[]
  total: number
  page: number
  page_size: number
}

const roleLabels: Record<string, { label: string; variant: 'red' | 'orange' | 'gray' }> = {
  admin: { label: '系统管理员', variant: 'red' },
  merchant: { label: '商家', variant: 'orange' },
  consumer: { label: '普通用户', variant: 'gray' },
}

const PAGE_SIZE = 20

function fmtTime(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function UsersPage() {
  const [data, setData] = useState<UserListResp>({ list: [], total: 0, page: 1, page_size: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      if (keyword) params.set('keyword', keyword)
      const resp = await api.get<UserListResp>(`/users?${params.toString()}`)
      setData({
        list: Array.isArray(resp?.list) ? resp.list : [],
        total: Number(resp?.total) || 0,
        page: Number(resp?.page) || page,
        page_size: Number(resp?.page_size) || PAGE_SIZE,
      })
    } catch (err: any) {
      toast(err?.message || '用户列表加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(1)
    setKeyword(searchInput.trim())
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">共 {data.total} 个用户</p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-8 w-60"
              placeholder="搜索昵称 / 手机号"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button variant="secondary" type="submit">搜索</Button>
        </form>
      </div>

      <Card>
        {loading ? (
          <Loading />
        ) : data.list.length === 0 ? (
          <Empty text="暂无用户" icon={<Users size={26} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">用户</th>
                  <th className="px-5 py-3 font-medium">手机号</th>
                  <th className="px-5 py-3 font-medium">角色</th>
                  <th className="px-5 py-3 font-medium">注册时间</th>
                  <th className="px-5 py-3 font-medium">最近登录</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((u) => {
                  const r = roleLabels[u.role || 'consumer'] || roleLabels.consumer
                  return (
                    <tr key={u.user_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-100" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center text-brand text-sm font-semibold">
                              {(u.nick_name || '匿')[0]}
                            </div>
                          )}
                          <span className="font-medium text-gray-800">{u.nick_name || '匿名用户'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{u.phone || '—'}</td>
                      <td className="px-5 py-3"><Badge variant={r.variant}>{r.label}</Badge></td>
                      <td className="px-5 py-3 text-xs text-gray-400">{fmtTime(u.created_at)}</td>
                      <td className="px-5 py-3 text-xs text-gray-400">{fmtTime(u.last_login_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={14} /> 上一页
          </Button>
          <span className="text-gray-500">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页 <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}
