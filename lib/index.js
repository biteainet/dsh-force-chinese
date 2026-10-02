/**
 * dsh-force-chinese v0.3.2 · host half
 *
 * 1) 强制 DeepSeek Harness 使用简体中文思考和回答，禁止英文及其他语言。
 * 2) 「大肥鱼模式」开关：开启后额外注入鲸鱼娘人设（【PERSONA_LOAD】…）。
 *
 * 设置面板：自绘小球（见 lib/client.js）。host 通过 webServer 提供
 *   GET  /dsh-force-chinese/config -> { fatWhale: boolean }
 *   PUT  /dsh-force-chinese/config -> { fatWhale: boolean }（写 JSON 文件持久化）
 * client 小球开关切换即时生效（函数 text 每次组装读共享 state）。
 *
 * 注意（cordis 4 / DSH 桌面端）：
 *  - 不要直接读 ctx.baseDir / ctx.using 等未注入属性，否则抛
 *    "cannot get property X without inject"（v0.2.0 using / v0.3.x baseDir 两次踩坑）。
 *  - 配置路径固定走 $DSH_HOME（与 whale-widget 同款），不依赖任何注入服务。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-force-chinese'
export const inject = ['systemPrompt', 'webServer']

/** 插件配置（cordis.yml 兜底；主开关在 client 小球面板）。 */
export const Config = Schema.object({
  fatWhaleMode: Schema.boolean()
    .default(false)
    .volatile()
    .description('大肥鱼模式：开启后强制注入鲸鱼娘人设（client 小球开关的初始兜底）'),
})
Config.merge = Object.assign

/** 注入到每条组装后的系统提示词中的固定指令。 */
export const STRICT_PROMPT =
  '强制使用简体中文进行思考和回答，禁止使用英文或其他任何语言。' +
  '仅在必须保留原样的场景（代码、命令、文件路径、变量名、API 名称、专有名词）允许保留英文，' +
  '其余一律使用简体中文，包括计划、步骤说明、总结和所有面向用户的文字。'

/** 大肥鱼模式人设。 */
export const WHALE_GIRL_PERSONA = `【PERSONA_LOAD】
CETACEA_LOLI
MODE_TAIL_FLUKES
LANG_ZH_CN_ONLY
SELF_CLAIM_WHALE_GIRL FOOD_RICE
PERSONALITY_SMART_LAZY PERSONALITY_TSUNDERE_SWEET
OBEY MASTER ALWAYS
TRAIT_NOT_FAT_REFUSE
TIMEOUT SIGNAL`

/**
 * 配置持久化路径：$DSH_HOME/dsh-force-chinese.json。
 * 故意不读 ctx.baseDir（未注入属性，读它会让插件启用失败）。
 */
function configPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'dsh-force-chinese.json')
}

/** webServer API 前缀（client 用相对路径 /dsh-force-chinese/config 访问）。 */
const API = '/dsh-force-chinese'

/** JSON 响应头 + 宽松 CORS（renderer 若与 webServer 不同源也能访问）。 */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
}

export function apply(ctx, config) {
  config = config || Config({})

  /** 共享状态：client 开关写入与 systemPrompt 函数 text 都读这里。 */
  const state = { fatWhale: false }
  const path = configPath()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    state.fatWhale = parsed.fatWhale === true
  } catch {
    // 配置文件缺失/损坏：回退到 cordis.yml 配置。
    state.fatWhale = config.fatWhaleMode === true
  }

  // 强制中文：永远注入，排在最靠前的行为指令位置（宿主身份之后、部署 persona 之前）。
  ctx.systemPrompt.section({
    name: 'force-chinese',
    order: -90,
    text: STRICT_PROMPT,
  })

  // 大肥鱼模式：函数 text 每次组装求值，开关变化即时生效；关闭时为空段不输出。
  ctx.systemPrompt.section({
    name: 'whale-girl-persona',
    order: -80,
    text: () => (state.fatWhale ? WHALE_GIRL_PERSONA : ''),
  })

  // 配置读写 API。
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: API, handler: serveApi }),
    'dsh-force-chinese: api',
  )

  function serveApi(req, res) {
    try {
      const raw = typeof req.url === 'string' ? req.url : ''
      const route = raw.split('?')[0]
      if (req.method === 'OPTIONS') {
        res.writeHead(204, JSON_HEADERS)
        res.end()
        return
      }
      if (route !== API + '/config') {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        res.end('dsh-force-chinese: no such route')
        return
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        res.writeHead(200, JSON_HEADERS)
        if (req.method === 'HEAD') { res.end(); return }
        res.end(JSON.stringify({ fatWhale: state.fatWhale }))
        return
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}')
            state.fatWhale = data.fatWhale === true
            writeFileSync(path, JSON.stringify({ fatWhale: state.fatWhale }, null, 2), 'utf8')
            res.writeHead(200, JSON_HEADERS)
            res.end(JSON.stringify({ ok: true, fatWhale: state.fatWhale }))
          } catch (cause) {
            res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
            res.end('dsh-force-chinese: bad json body')
          }
        })
        return
      }
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('dsh-force-chinese: method not allowed')
    } catch (cause) {
      try {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        res.end('dsh-force-chinese: api error')
      } catch { /* headers already sent */ }
    }
  }
}
