/**
 * dsh-force-chinese v0.2.0
 *
 * 1) 强制 DeepSeek Harness 使用简体中文思考和回答，禁止英文及其他语言。
 * 2) 「大肥鱼模式」开关：开启后额外注入鲸鱼娘人设（【PERSONA_LOAD】…）。
 *
 * 纯 host 插件，不改聊天 UI。设置开关两条路径：
 *  - 首选：宿主安装 dsh-config-form 后，本插件在「设置 → 插件 → 插件配置」
 *    注册「大肥鱼模式」开关，切换即时生效（live）。
 *  - 备选：在 cordis.patch.yml 的插件 config 里写 fatWhaleMode: true。
 */
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-force-chinese'
export const inject = ['systemPrompt']

/** 插件配置（cordis.yml / dsh-settings 可编辑）。 */
export const Config = Schema.object({
  fatWhaleMode: Schema.boolean()
    .default(false)
    .description('大肥鱼模式：开启后强制注入鲸鱼娘人设'),
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

export function apply(ctx, config) {
  config = config || Config({})

  /** 共享状态：设置开关（configForm 热更新或 cordis.yml 配置）都会写入这里。 */
  const state = { fatWhale: config.fatWhaleMode === true }

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

  // 软依赖 dsh-config-form：装了就出「设置 → 插件 → 插件配置」开关；没装不影响主功能。
  ctx.using(['configForm'], async (scoped) => {
    const settings = scoped.configForm.declare(
      scoped,
      {
        id: 'dsh-force-chinese',
        title: { zh: '强制中文', en: 'Force Chinese' },
        description: {
          zh: '大肥鱼模式开启后强制注入鲸鱼娘人设；关闭时仅保留强制中文指令。',
          en: 'Fat Whale Mode injects the whale-girl persona; off keeps only the force-Chinese directive.',
        },
        groups: [
          {
            title: { zh: '模式', en: 'Mode' },
            fields: [
              {
                kind: 'boolean',
                key: 'fatWhaleMode',
                label: { zh: '大肥鱼模式', en: 'Fat Whale Mode' },
                default: config.fatWhaleMode === true,
              },
            ],
          },
        ],
      },
      { applies: 'live' },
    )
    state.fatWhale = settings.get().fatWhaleMode === true
    settings.watch((next) => {
      state.fatWhale = next.fatWhaleMode === true
    })
  })
}
