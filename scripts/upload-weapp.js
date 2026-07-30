/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 微信小程序 CI 自动上传脚本
 *
 * 用法:
 *   pnpm upload:weapp                 # 默认版本 1.0.0
 *   pnpm upload:weapp 1.0.1 "修复登录" # 指定版本号与描述
 *
 * 前置条件:
 *   1. 已执行 pnpm build:weapp（dist/ 产物存在）
 *   2. 代码上传密钥位于 ci-keys/private.wx4ff14fc03ff7d7d5.key
 *      （ci-keys/ 已被 .gitignore 忽略，切勿提交到 git）
 *
 * 上传成功后:
 *   微信公众平台 → 管理 → 版本管理 → 开发版本，可设为体验版/提交审核
 */
const path = require('path')
const fs = require('fs')
const ci = require('miniprogram-ci')

const ROOT = path.resolve(__dirname, '..')
const APPID = 'wx4ff14fc03ff7d7d5'
const PRIVATE_KEY_PATH = path.join(ROOT, 'ci-keys', `private.${APPID}.key`)

async function main() {
  const version = process.argv[2] || '1.0.0'
  const desc = process.argv[3] || `CI 自动上传 ${new Date().toLocaleString('zh-CN')}`

  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error(`[upload] 未找到代码上传密钥: ${PRIVATE_KEY_PATH}`)
    process.exit(1)
  }
  if (!fs.existsSync(path.join(ROOT, 'dist', 'app.js'))) {
    console.error('[upload] 未找到构建产物 dist/，请先执行 pnpm build:weapp')
    process.exit(1)
  }

  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: ROOT,
    privateKeyPath: PRIVATE_KEY_PATH,
    ignores: ['node_modules/**/*'],
  })

  console.log(`[upload] 开始上传: appid=${APPID}, version=${version}`)
  console.log(`[upload] 版本描述: ${desc}`)

  const result = await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: false, // Taro 构建产物已完成编译压缩，CI 侧全部关闭只做纯上传（避免 miniprogram-ci 内部编译器兼容性问题）
      enhance: false,
      postcss: false,
      minified: false,
      minifyWXSS: false,
      minifyWXML: false,
      urlCheck: false,
    },
    onProgressUpdate: (info) => {
      if (typeof info === 'string') {
        console.log(`[upload] ${info}`)
      }
    },
  })

  console.log('[upload] 上传成功 ✅')
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('[upload] 上传失败:', err && err.message ? err.message : err)
  process.exit(1)
})
