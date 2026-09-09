const { Config, LLMClient } = require('coze-coding-dev-sdk')
const fs = require('fs')

async function main() {
  const config = new Config()
  const client = new LLMClient(config, 'doubao-seed-2-0-lite-260215')
  const b64 = fs.readFileSync('/tmp/qiniu-key.png').toString('base64')
  const res = await client.invoke([
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '这是七牛云控制台页面截图。请逐字提取图中的 AccessKey（AK，通常是 40 位左右字母数字）和 SecretKey（SK，通常是 40 位左右字母数字），以 JSON 格式输出：{"access_key": "...", "secret_key": "..."}。只输出 JSON，不要其他文字。注意区分大小写和数字 0/字母 O、数字 1/字母 l 等。'
        },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' } }
      ]
    }
  ])
  console.log(JSON.stringify(res, null, 2))
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
