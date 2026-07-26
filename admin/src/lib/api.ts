/**
 * 统一请求封装
 * - 自动拼接 /api 前缀（开发环境经 Vite proxy 转发到 NestJS，生产环境同源）
 * - 兼容两种响应格式：信封 { code, msg, data } 与裸数据（数组/对象）
 * - 打印请求与响应日志，便于排查
 */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `/api${path}`
  const method = (options.method || 'GET').toUpperCase()
  let params: unknown
  try {
    params = options.body ? JSON.parse(options.body as string) : undefined
  } catch {
    params = options.body
  }
  console.log(`[API] ${method} ${url}`, params ?? '')

  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const body = await res.json().catch(() => null)
  console.log(`[API] ${method} ${url} -> ${res.status}`, body)

  if (!res.ok) {
    const msg = Array.isArray(body?.message)
      ? body.message.join('；')
      : body?.message || body?.msg || `请求失败（${res.status}）`
    throw new ApiError(msg, res.status)
  }
  // 业务码非 200 的信封（部分接口 HTTP 200 但 code=400）
  if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.code === 'number' && body.code !== 200) {
    throw new ApiError(body.msg || body.message || '请求失败', res.status)
  }
  // 信封解包；裸数组/对象原样返回
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body && 'code' in body) {
    return body.data as T
  }
  return body as T
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T = any>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  del: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
}
