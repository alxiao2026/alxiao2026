/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 微信小程序 CI 自动上传脚本（手动协议实现版）
 *
 * 用法: pnpm upload:weapp [version] [desc]
 *
 * 密钥: ci-keys/private.wx4ff14fc03ff7d7d5.key（已被 .gitignore 忽略，切勿提交）
 *
 * 说明：miniprogram-ci 上传流程在 fork 子进程中执行，无法注入微信服务端
 * 当前要求的 access_token 查询参数（否则报 41001 access_token missing）。
 * 本脚本直接复刻其上传协议（getrandstr → 私钥签名 → pack → gzip → POST），
 * 并在上传 URL 中携带 access_token。
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const APPID = 'wx4ff14fc03ff7d7d5';
const PRIVATE_KEY_PATH = path.join(ROOT, 'ci-keys', `private.${APPID}.key`);
const ENV_PATH = path.join(ROOT, 'server', '.env');

const CI_VERSION = '2.1.42';
const SIGNATURE_FILE_NAME = 'ci.signature';
const GET_RAND_STRING_URL = 'https://servicewechat.com/wxa/ci/getrandstr';
const UPLOAD_URL = 'https://servicewechat.com/wxa/ci/upload';

/** 从 server/.env 读取变量 */
function readEnv(name) {
  if (!fs.existsSync(ENV_PATH)) return '';
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const match = content.match(new RegExp(`^${name}="?([^"\\n]+)"?`, 'm'));
  return match ? match[1] : '';
}

/** 获取微信 access_token（小程序 AppID + AppSecret） */
async function getAccessToken() {
  const secret = readEnv('WECHAT_SECRET');
  if (!secret) {
    console.error('未在 server/.env 找到 WECHAT_SECRET');
    process.exit(1);
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${secret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.access_token) {
    console.error(`获取 access_token 失败: ${JSON.stringify(data)}`);
    process.exit(1);
  }
  return data.access_token;
}

/** 递归收集目录文件 → { '/相对路径': Buffer } */
function collectFiles(dir) {
  const fileMap = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        const rel = `/${path.relative(dir, abs).replace(/\\/g, '/')}`;
        fileMap[rel] = fs.readFileSync(abs);
      }
    }
  };
  walk(dir);
  return fileMap;
}

/** 复刻 miniprogram-ci 的 pack 二进制协议 */
function pack(fileMap) {
  const header = [Buffer.alloc(1), Buffer.alloc(4), Buffer.alloc(4), Buffer.alloc(4), Buffer.alloc(1)];
  header[0][0] = 190; // B_PROTOCOL
  header[1].writeInt32BE(0, 0); // B_PROTOCOL_VERSION
  header[4][0] = 237; // B_PROTOCOL_END

  const keys = Object.keys(fileMap);
  const pathBufs = [];
  const dataBufs = [];
  for (const key of keys) {
    const rel = key.replace(/\\/g, '/');
    const relPath = rel.startsWith('/') ? rel : `/${rel}`;
    pathBufs.push(Buffer.from(relPath));
    const data = fileMap[key];
    dataBufs.push(Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8'));
  }

  let offset = 18 + 12 * keys.length + Buffer.concat(pathBufs).length;
  const infoParts = pathBufs.map((pathBuf, i) => {
    const pathLenBuf = Buffer.alloc(4);
    pathLenBuf.writeInt32BE(pathBuf.length, 0);
    const offsetBuf = Buffer.alloc(4);
    offsetBuf.writeInt32BE(offset, 0);
    offset += dataBufs[i].length;
    const dataLenBuf = Buffer.alloc(4);
    dataLenBuf.writeInt32BE(dataBufs[i].length, 0);
    return Buffer.concat([pathLenBuf, pathBuf, offsetBuf, dataLenBuf]);
  });

  const countBuf = Buffer.alloc(4);
  countBuf.writeInt32BE(keys.length, 0);
  const infoBuf = Buffer.concat([countBuf, ...infoParts]);
  const dataBuf = Buffer.concat(dataBufs);
  header[2].writeInt32BE(infoBuf.length, 0); // B_FILEINFO_LEN
  header[3].writeInt32BE(dataBuf.length, 0); // B_FILEDATA_LEN
  return Buffer.concat([...header, infoBuf, dataBuf]);
}

/** 获取微信服务器随机串 */
async function getRandomString() {
  const res = await fetch(GET_RAND_STRING_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appid: APPID, clientRand: crypto.randomBytes(16).toString('hex') }),
  });
  const data = await res.json();
  const randStr = data.randomString || data?.data?.randomString;
  if (!randStr) {
    throw new Error(`获取随机串失败: ${JSON.stringify(data)}`);
  }
  return randStr;
}

async function main() {
  const version = process.argv[2] || '1.0.0';
  const desc = process.argv[3] || `CI 上传 ${new Date().toLocaleString('zh-CN')}`;

  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error(`未找到代码上传密钥: ${PRIVATE_KEY_PATH}`);
    console.error('请在微信公众平台生成代码上传密钥后放到 ci-keys/ 目录');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(ROOT, 'dist', 'app.js'))) {
    console.error('未找到构建产物 dist/，请先执行 pnpm build:weapp');
    process.exit(1);
  }

  // 1. 获取 access_token
  console.log('正在获取 access_token...');
  const accessToken = await getAccessToken();
  console.log('access_token 获取成功');

  // 2. 收集构建产物文件
  const fileMap = collectFiles(path.join(ROOT, 'dist'));
  console.log(`收集构建产物: ${Object.keys(fileMap).length} 个文件`);

  // 3. 获取随机串并签名
  const randStr = await getRandomString();
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const signature = crypto
    .privateEncrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(JSON.stringify({ appid: APPID, rand_str: randStr })),
    )
    .toString('base64');

  // 4. 打包（含签名文件）+ gzip
  fileMap[`/${SIGNATURE_FILE_NAME}`] = JSON.stringify({ signature, version: CI_VERSION });
  const packed = pack(fileMap);
  const gzipped = zlib.gzipSync(packed);
  console.log(`代码包: ${packed.length} bytes → gzip ${gzipped.length} bytes`);

  // 5. 上传（URL 携带 access_token，满足微信服务端要求）
  const query = new URLSearchParams({
    codeprotect: '0',
    type: 'miniProgram',
    appid: APPID,
    version,
    desc,
    robot: '1',
    debugLaunchInfo: JSON.stringify({ scene: 1011 }),
    access_token: accessToken,
  });
  console.log(`开始上传: version=${version}, desc=${desc}`);
  const res = await fetch(`${UPLOAD_URL}?${query.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: gzipped,
  });
  const text = await res.text();
  console.log(`上传响应 (HTTP ${res.status}):`, text.slice(0, 500));

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    console.error('上传响应非 JSON，上传失败');
    process.exit(1);
  }
  const errCode = result.errCode ?? result.errcode;
  if (errCode === 0 || errCode === '0' || errCode === undefined) {
    console.log('');
    console.log(`🎉 上传成功！版本 ${version}`);
    console.log('请前往 微信公众平台 → 管理 → 版本管理 查看开发版本，可设为体验版');
  } else {
    console.error(`上传失败: errCode=${errCode}, errMsg=${result.errMsg || result.errmsg}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('上传失败:', err.message || err);
  process.exit(1);
});
