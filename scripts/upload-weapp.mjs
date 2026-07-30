/**
 * 微信小程序 CI 自动上传脚本
 * 用法: node scripts/upload-weapp.mjs [version] [desc]
 * 前置: ci-keys/private.wx4ff14fc03ff7d7d5.key（小程序代码上传密钥，已 gitignore）
 * 成功后在微信公众平台 → 版本管理 → 开发版本中可见，可设为体验版/提交审核
 */
import ci from 'miniprogram-ci'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const version = process.argv[2] || pkg.version || '1.0.0'
const desc = process.argv[3] || `自动上传 v${version}`

const project = new ci.Project({
  appid: 'wx4ff14fc03ff7d7d5',
  type: 'miniProgram',
  projectPath: './',
  privateKeyPath: './ci-keys/private.wx4ff14fc03ff7d7d5.key',
  ignores: ['node_modules/**/*'],
})

console.log(`开始上传: v${version} - ${desc}`)

try {
  const uploadResult = await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: true,
      enhance: true,
      minify: true,
      minifyWXML: true,
      minifyWXSS: true,
      postcss: true,
      uglifyFileName: false,
    },
    robot: 1,
    threads: 1,
    allowIgnoreUnusedFiles: true,
    onProgressUpdate: (task) => {
      if (task._status === 'error' || task.status === 'error') {
        console.error('错误对象详情:', JSON.stringify(task, Object.getOwnPropertyNames(task)).slice(0, 1500));
      }
      const msg = typeof task === 'string' ? task : task?._msg || task?.status || ''
      if (msg) console.log('[进度]', msg)
    },
  })
  console.log('✅ 上传成功！')
  console.log(JSON.stringify(uploadResult, null, 2).slice(0, 500))
} catch (err) {
  console.error('❌ 上传失败:', err?.message || err)
  process.exit(1)
}
