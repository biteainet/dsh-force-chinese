/**
 * dsh-force-chinese v0.4.0 · host half
 *
 * 1) 强制 DeepSeek Harness 使用简体中文思考和回答，禁止英文及其他语言。
 * 2) 「大肥鱼模式」开关：开启后额外注入鲸鱼娘人设（【PERSONA_LOAD】…）。
 * 3) 「省 Token 模式」滑块（0-100）：按档位动态注入精简指令，滑块为 0 时不注入。
 *
 * 设置面板：自绘小球（见 lib/client.js）。host 通过 webServer 提供
 *   GET  /dsh-force-chinese/config -> { fatWhale: boolean, saveTokenLevel: number }
 *   PUT  /dsh-force-chinese/config -> { fatWhale, saveTokenLevel }（写 JSON 文件持久化）
 * client 面板改动即时生效（section 的 text 为函数，每次组装读共享 state）。
 *
 * systemPrompt 段顺序：
 *   -90 force-chinese        强制中文（恒定注入）
 *   -85 save-token           省 Token 档位指令（按 saveTokenLevel 动态求值）
 *   -80 whale-girl-persona   鲸鱼娘人设（按 fatWhale 动态求值）
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
  saveTokenLevel: Schema.number()
    .default(0)
    .min(0)
    .max(100)
    .volatile()
    .description('省 Token 等级 0-100（client 面板滑块的初始兜底）'),
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

/* ===================== 省 Token 档位文本（唯一真源） ===================== */

/** 1-30：轻度精简 */
export const TOKEN_PROMPT_LIGHT = '省略不必要的寒暄和客套话，直接回答问题。'

/** 31-60：中度精简 */
export const TOKEN_PROMPT_MEDIUM = '只输出核心结论、关键代码和执行命令。不要解释过程，不要复述需求。'

/** 61-90：极限压榨 */
export const TOKEN_PROMPT_HARD = '极度精简。除绝对必要的代码/命令/报错信息外，禁止输出任何多余文字。'

/** 91-100：终极闭麦 */
export const TOKEN_PROMPT_MUTE =
  '【终极闭麦模式】除了执行命令和输出代码本身，禁止输出任何人类自然语言。把 Token 消耗降到最低，只干活，不说话。'

/** 把任意输入规范成 0-100 的整数。 */
export function normalizeLevel(value) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** 根据滑块数值返回该注入的文本；0 返回空串（不注入任何内容）。 */
export function saveTokenPrompt(level) {
  const n = normalizeLevel(level)
  if (n <= 0) return ''
  if (n <= 30) return TOKEN_PROMPT_LIGHT
  if (n <= 60) return TOKEN_PROMPT_MEDIUM
  if (n <= 90) return TOKEN_PROMPT_HARD
  return TOKEN_PROMPT_MUTE
}

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

  /** 共享状态：client 面板写入与 systemPrompt 函数 text 都读这里。 */
  const state = { fatWhale: false, saveTokenLevel: 0 }
  const path = configPath()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    state.fatWhale = parsed.fatWhale === true
    state.saveTokenLevel = normalizeLevel(parsed.saveTokenLevel)
  } catch {
    // 配置文件缺失/损坏：回退到 cordis.yml 配置。
    state.fatWhale = config.fatWhaleMode === true
    state.saveTokenLevel = normalizeLevel(config.saveTokenLevel)
  }

  // 强制中文：永远注入，排在最靠前的行为指令位置（宿主身份之后、部署 persona 之前）。
  ctx.systemPrompt.section({
    name: 'force-chinese',
    order: -90,
    text: STRICT_PROMPT,
  })

  // 省 Token：函数 text 每次组装求值，滑块变化即时生效；0 时为空段不输出。
  ctx.systemPrompt.section({
    name: 'save-token',
    order: -85,
    text: () => saveTokenPrompt(state.saveTokenLevel),
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

  function persist() {
    writeFileSync(
      path,
      JSON.stringify({ fatWhale: state.fatWhale, saveTokenLevel: state.saveTokenLevel }, null, 2),
      'utf8',
    )
  }

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
        res.end(JSON.stringify({
          fatWhale: state.fatWhale,
          saveTokenLevel: state.saveTokenLevel,
        }))
        return
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}')
            if (data.fatWhale !== undefined) {
              state.fatWhale = data.fatWhale === true
            }
            if (data.saveTokenLevel !== undefined) {
              state.saveTokenLevel = normalizeLevel(data.saveTokenLevel)
            }
            persist()
            res.writeHead(200, JSON_HEADERS)
            res.end(JSON.stringify({
              ok: true,
              fatWhale: state.fatWhale,
              saveTokenLevel: state.saveTokenLevel,
            }))
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
