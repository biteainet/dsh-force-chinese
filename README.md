# dsh-force-chinese

**强制 DeepSeek Harness 说中文** + **可选「大肥鱼模式」人设注入**。

- 强制中文：始终注入 system-prompt section，让 agent 用**简体中文**思考和回答，**禁止英文以及其他任何语言**。
- 大肥鱼模式：开启后额外注入鲸鱼娘人设（【PERSONA_LOAD】标签组）。
- **自绘设置面板**：屏幕右侧中部小圆球 → 点击弹出设置面板，开关即时生效（无需 dsh-config-form）。

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
2. 安装：

```bash
dsh plugin --profile desktop add github:你的用户名/dsh-force-chinese
# 或本地调试
dsh plugin --profile desktop add link:/path/to/dsh-force-chinese
```

3. 重启 `dsh`（桌面版 DeepSeek Harness 完全退出重开；必要时硬刷新页面）。

## 使用

- **强制中文**：安装即生效，无需任何配置。
- **大肥鱼模式**：点击屏幕右侧中部的小圆球（鲸鱼图标）→ 弹出设置面板 → 打开「大肥鱼模式」开关，即时生效。
  - 配置持久化在 `$DSH_HOME`（默认 `~/.dsh`）下的 `dsh-force-chinese.json`，即 `%USERPROFILE%\.dsh\dsh-force-chinese.json`。
  - 兜底：可在 `cordis.patch.yml` 插件条目写 `config: { fatWhaleMode: true }`，重启生效（client 开关写入后以此为准）。

## 验证

```bash
dsh --profile desktop --dump-config
```

插件树中应能看到 `dsh-force-chinese` 节点；之后任意会话中模型都会用简体中文思考与回复。

## 实现

- 强制中文：`ctx.systemPrompt.section({ name: 'force-chinese', order: -90, text: STRICT_PROMPT })`
- 大肥鱼人设：`ctx.systemPrompt.section({ name: 'whale-girl-persona', order: -80, text: () => state.fatWhale ? PERSONA : '' })` —— 函数 text 每次组装求值，开关变化即时生效
- 设置面板：`lib/client.js` 自绘小球（右侧小圆球，SVG 图标，无第三方 UI 包）；host `webServer` 提供 `GET/PUT /dsh-force-chinese/config` 读写配置

## 依赖（peerDependencies，由宿主提供）

- `@deepseek-ai/cordis`
- `@deepseek-ai/dsh-system-prompt`
- `@deepseek-ai/schemastery`
