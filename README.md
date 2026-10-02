# dsh-force-chinese

**强制 DeepSeek Harness 说中文** + **可选「大肥鱼模式」人设注入**。

- 纯 host 插件，**不修改聊天 UI**（不新增按钮、面板、设置项到聊天界面）。
- 始终注入一条 system-prompt section：让 agent 用**简体中文**思考和回答，**禁止英文以及其他任何语言**。
- 「大肥鱼模式」开启后，额外注入鲸鱼娘人设（【PERSONA_LOAD】标签组）。

## 注入的文案

> 强制使用简体中文进行思考和回答，禁止使用英文或其他任何语言。仅在必须保留原样的场景（代码、命令、文件路径、变量名、API 名称、专有名词）允许保留英文，其余一律使用简体中文，包括计划、步骤说明、总结和所有面向用户的文字。

大肥鱼模式人设：

```
【PERSONA_LOAD】
CETACEA_LOLI
MODE_TAIL_FLUKES
LANG_ZH_CN_ONLY
SELF_CLAIM_WHALE_GIRL FOOD_RICE
PERSONALITY_SMART_LAZY PERSONALITY_TSUNDERE_SWEET
OBEY MASTER ALWAYS
TRAIT_NOT_FAT_REFUSE
TIMEOUT SIGNAL
```

## 安装

1. 把本包内容上传到你的 GitHub 仓库；
2. （可选，推荐）先安装设置表单插件，开关会出现在 **设置 → 插件 → 插件配置**：

```bash
dsh plugin --profile desktop add dsh-config-form
```

3. 安装本插件：

```bash
dsh plugin --profile desktop add github:你的用户名/dsh-force-chinese
# 或本地调试
dsh plugin --profile desktop add link:/path/to/dsh-force-chinese
```

4. 重启 `dsh`（桌面版 DeepSeek Harness 重启应用；必要时硬刷新页面）。

## 使用

- **强制中文**：安装即生效，无需任何配置。
- **大肥鱼模式**：打开 **设置 → 插件 → 插件配置 → 强制中文 → 大肥鱼模式** 开关，即时生效（live）。
  - 不装 dsh-config-form 时，可在 `cordis.patch.yml` 中给插件条目写 `config: { fatWhaleMode: true }`，重启生效。

## 验证

```bash
dsh --profile desktop --dump-config
```

插件树中应能看到 `dsh-force-chinese` 节点；之后任意会话中模型都会用简体中文思考与回复。

## 实现

- 强制中文：`ctx.systemPrompt.section({ name: 'force-chinese', order: -90, text: STRICT_PROMPT })`
- 大肥鱼人设：`ctx.systemPrompt.section({ name: 'whale-girl-persona', order: -80, text: () => enabled ? PERSONA : '' })` —— 函数 text 每次组装求值，开关变化即时生效
- 设置开关：软依赖 `configForm`（`ctx.get('configForm')` 同步探测，未装 dsh-config-form 不影响主功能；cordis 4 的 `ctx.using` 必须先 inject 声明，故不使用）

## 依赖（peerDependencies，由宿主提供）

- `@deepseek-ai/cordis`
- `@deepseek-ai/dsh-system-prompt`
- `@deepseek-ai/schemastery`
