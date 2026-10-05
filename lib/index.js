/**
 * dsh-force-chinese v0.4.0 · host half
 * 
 * 合并了“强制中文”与“可调节省 Token 模式”
 * 持久化文件依然保存在 $DSH_HOME/dsh-force-chinese.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-force-chinese'
export const inject = ['systemPrompt', 'webServer']

export const Config = Schema.object({
  fatWhaleMode: Schema.boolean()
    .default(false)
    .volatile()
    .description('大肥鱼模式：开启后强制注入鲸鱼娘人设'),
  saveTokenLevel: Schema.number()
    .default(0)
    .volatile()
    .description('省 Token 强度 (0-100)'),
})
Config.merge = Object.assign

export const STRICT_PROMPT =
  '强制使用简体中文进行思考和回答，禁止使用英文或其他任何语言。' +
  '仅在必须保留原样的场景（代码、命令、文件路径、变量名、API 名称、专有名词）允许保留英文，' +
  '其余一律使用简体中文，包括计划、步骤说明、总结和所有面向用户的文字。'

export const WHALE_GIRL_PERSONA = `【PERSONA_LOAD】
CETACEA_LOLI
MODE_TAIL_FLUKES
LANG_ZH_CN_ONLY
SELF_CLAIM_WHALE_GIRL FOOD_RICE
PERSONALITY_SMART_LAZY PERSONALITY_TSUNDERE_SWEET
OBEY MASTER ALWAYS
TRAIT_NOT_FAT_REFUSE
TIMEOUT SIGNAL`

function configPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'dsh-force-chinese.json')
}

const API = '/dsh-force-chinese'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
}

export function apply(ctx, config) {
  config = config || Config({})

  // 共享状态
  const state = { 
    fatWhale: false,
    saveTokenLevel: 0
  }
  const path = configPath()

  // 读取持久化配置
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    state.fatWhale = parsed.fatWhale === true
    state.saveTokenLevel = typeof parsed.saveTokenLevel === 'number' ? parsed.saveTokenLevel : 0
  } catch {
    state.fatWhale = config.fatWhaleMode === true
    state.saveTokenLevel = config.saveTokenLevel || 0
  }

  // 1. 强制中文（永远注入）
  ctx.systemPrompt.section({
    name: 'force-chinese',
    order: -90,
    text: STRICT_PROMPT,
  })

  // 2. 可调节省 Token 模式
  ctx.systemPrompt.section({
    name: 'save-token-mode',
    order: -85, // 紧跟强制中文之后
    text: () => {
      const level = state.saveTokenLevel;
      if (level <= 0) return '';
      
      let prompt = "【省 Token 模式已开启，请严格按照以下要求回复：】\n";
      if (level < 30) {
        prompt += "省略不必要的寒暄和客套话，直接回答问题。\n";
      } else if (level < 60) {
        prompt += "只输出核心结论、关键代码和执行命令。不要解释过程，不要复述需求。\n";
      } else if (level < 90) {
        prompt += "极度精简。除绝对必要的代码/命令/报错信息外，禁止输出任何多余文字。\n";
      } else {
        prompt += "【终极闭麦模式】除了执行命令和输出代码本身，禁止输出任何人类自然语言。把 Token 消耗降到最低，只干活，不说话。\n";
      }
      return prompt;
    },
  })

  // 3. 大肥鱼模式
  ctx.systemPrompt.section({
    name: 'whale-girl-persona',
    order: -80,
    text: () => (state.fatWhale ? WHALE_GIRL_PERSONA : ''),
  })

  // 配置读写 API
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
        res.end(JSON.stringify({ fatWhale: state.fatWhale, saveTokenLevel: state.saveTokenLevel }))
        return
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}')
            if (typeof data.fatWhale === 'boolean') state.fatWhale = data.fatWhale
            if (typeof data.saveTokenLevel === 'number') state.saveTokenLevel = data.saveTokenLevel
            
            // 写入 DSH_HOME 目录
            writeFileSync(path, JSON.stringify({ 
              fatWhale: state.fatWhale, 
              saveTokenLevel: state.saveTokenLevel 
            }, null, 2), 'utf8')
            
            res.writeHead(200, JSON_HEADERS)
            res.end(JSON.stringify({ ok: true, fatWhale: state.fatWhale, saveTokenLevel: state.saveTokenLevel }))
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