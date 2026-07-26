import { useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from '@/components/ui'

/** 上传图片到对象存储，返回可访问 URL（POST /api/upload，form-data 字段名 file） */
async function uploadImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  console.log('[API] POST /api/upload', file.name, file.size)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const body = await res.json().catch(() => null)
  console.log('[API] POST /api/upload ->', res.status, body)
  if (!res.ok) throw new Error(body?.message || '上传失败')
  const url = body?.data?.url
  if (!url) throw new Error('上传成功但未返回图片地址')
  return url
}

export function ImageUpload({ value, onChange, hint }: { value?: string; onChange: (url: string) => void; hint?: string }) {
  const [uploading, setUploading] = useState(false)

  const handlePick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return
      if (file.size > 10 * 1024 * 1024) {
        toast('图片不能超过 10MB', 'error')
        return
      }
      setUploading(true)
      try {
        const url = await uploadImage(file)
        onChange(url)
      } catch (e: any) {
        toast(e?.message || '上传失败', 'error')
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  return (
    <div className="flex items-start gap-3">
      {value ? (
        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shrink-0 group">
          <img src={value} alt="预览" className="w-full h-full object-cover" />
          <button
            type="button"
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onChange('')}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition-colors shrink-0"
          onClick={handlePick}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          <span className="text-xs mt-1">{uploading ? '上传中' : '上传'}</span>
        </button>
      )}
      {hint && <p className="text-xs text-gray-400 pt-1">{hint}</p>}
    </div>
  )
}
