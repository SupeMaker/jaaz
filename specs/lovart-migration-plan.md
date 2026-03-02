# 页面结构逆向分析 & 网页迁移执行计划

**由 Agent-β（爬虫工程师）和 Agent-γ（全栈开发）联合输出**

---

## 一、页面结构逆向分析

### 1.1 首页（Home）

**原始 Jaaz 结构：**
- `routes/index.tsx` → Home 组件
- `components/home/CanvasList.tsx` → 画布列表
- `components/home/CanvasCard.tsx` → 画布卡片
- `components/TopMenu.tsx` → 顶部导航

**Lovart 目标结构：**
- Hero 区域（渐变标题 + 副标题 + 背景光晕）
- 任务类型选择器（6 种类型 pill 按钮）
- ChatTextarea 输入框
- FeatureCards 特性展示网格（3×2）
- MultimodalShowcase 多模态输出展示
- ChatCanvas 介绍区
- CanvasList 项目列表

**DOM 层级关系：**
```
Home (flex-col h-screen)
├── ScrollArea
│   ├── TopMenu
│   ├── Hero Section (relative, min-h-[calc(100vh-200px)])
│   │   ├── Gradient Glow (absolute, blur-120)
│   │   ├── h1 (gradient text)
│   │   ├── p (subtitle)
│   │   ├── TaskTypeSelector (flex-wrap gap-2)
│   │   └── ChatTextarea (max-w-xl)
│   ├── FeatureCards (grid 3-col)
│   ├── MultimodalShowcase (flex-wrap gap-4)
│   ├── ChatCanvas Section (text-center)
│   └── CanvasList (grid 4-col responsive)
```

### 1.2 画布工作区（Canvas）

**原始 Jaaz 结构：**
- `routes/canvas.$id.tsx` → Canvas 页面
- `components/canvas/CanvasExcali.tsx` → Excalidraw 画布
- `components/canvas/CanvasHeader.tsx` → 画布头部
- `components/canvas/pop-bar/` → PopBar 弹出工具条
- `components/chat/Chat.tsx` → 聊天面板

**Lovart 增强点：**
- CanvasHeader 增加 WorkModeIndicator（Talk/Tab/Tune）
- PopBar 增加 7 个编辑操作按钮（Upscale/RemoveBg/EditElement/EditText/Expand/Redraw/Download）
- ChatTextarea 增加 OutputModeSelector（多模态输出选择）

**PopBar DOM 结构：**
```
CanvasPopbarWrapper (absolute, pointer-events-none)
└── CanvasPopbarContainer (motion.div, z-20)
    └── flex container (backdrop-blur-lg, rounded-lg)
        ├── CanvasPopbar (Add to Chat)
        ├── CanvasMagicGenerator (Magic Generate)
        ├── Divider (w-px h-5 bg-border)
        └── PopbarActions
            ├── Upscale (Maximize2 icon)
            ├── RemoveBg (Eraser icon)
            ├── EditElement (Pencil icon)
            ├── EditText (Type icon)
            ├── Expand (Expand icon)
            ├── Redraw (Paintbrush icon)
            └── Download (Download icon)
```

### 1.3 设置页（Settings）

**原始 Jaaz 结构：**
- `components/settings/dialog/index.tsx` → 设置对话框
- `components/settings/dialog/sidebar.tsx` → 侧边栏导航
- `components/settings/dialog/providers.tsx` → 提供商配置
- `components/settings/dialog/proxy.tsx` → 代理设置

**Lovart 增强点：**
- 新增 `brand.tsx` 品牌设置面板
- Sidebar 增加 Brand 菜单项（Palette 图标）
- 品牌设置包含：品牌名称、Logo 上传、色板管理、字体配置

---

## 二、网页迁移执行计划

### 阶段 1：设计系统（已完成 ✅）

| 任务 | 文件 | 状态 |
|---|---|---|
| CSS 变量体系对齐 Lovart 暗色风格 | `assets/style/index.css` | ✅ |
| oklch dark 主题变量更新 | `assets/style/index.css` | ✅ |
| Lovart 设计令牌（purple/blue/teal/gradient） | `assets/style/index.css` | ✅ |

### 阶段 2：首页重构（已完成 ✅）

| 任务 | 文件 | 状态 |
|---|---|---|
| Hero 渐变标题 + 背景光晕 | `routes/index.tsx` | ✅ |
| TaskTypeSelector 任务类型选择器 | `components/home/TaskTypeSelector.tsx` | ✅ |
| FeatureCards 特性展示网格 | `components/home/FeatureCards.tsx` | ✅ |
| MultimodalShowcase 多模态展示 | `components/home/MultimodalShowcase.tsx` | ✅ |
| ChatCanvas 介绍区 | `routes/index.tsx` | ✅ |
| i18n 翻译更新（中/英） | `i18n/locales/*/home.json` | ✅ |

### 阶段 3：画布工作区增强（已完成 ✅）

| 任务 | 文件 | 状态 |
|---|---|---|
| WorkModeIndicator Talk/Tab/Tune | `components/canvas/WorkModeIndicator.tsx` | ✅ |
| CanvasHeader 集成 WorkMode | `components/canvas/CanvasHeader.tsx` | ✅ |
| PopbarActions 7 个编辑按钮 | `components/canvas/pop-bar/PopbarActions.tsx` | ✅ |
| CanvasPopbarContainer 集成 | `components/canvas/pop-bar/CanvasPopbarContainer.tsx` | ✅ |
| EventBus 新增 7 个画布事件 | `lib/event.ts` | ✅ |
| i18n 翻译更新（中/英） | `i18n/locales/*/canvas.json` | ✅ |

### 阶段 4：品牌设置 + 多模态（已完成 ✅）

| 任务 | 文件 | 状态 |
|---|---|---|
| SettingBrand 品牌设置面板 | `components/settings/dialog/brand.tsx` | ✅ |
| Settings Sidebar 增加 Brand 项 | `components/settings/dialog/sidebar.tsx` | ✅ |
| Settings Dialog 集成 Brand | `components/settings/dialog/index.tsx` | ✅ |
| OutputModeSelector 多模态选择 | `components/chat/OutputModeSelector.tsx` | ✅ |
| ChatTextarea 集成 OutputMode | `components/chat/ChatTextarea.tsx` | ✅ |
| i18n 翻译更新（中/英） | `i18n/locales/*/settings.json` | ✅ |

### 阶段 5：Lovart 核心功能实现（已完成 ✅）

| 任务 | 文件 | 状态 |
|---|---|---|
| MCoT 思维链推理面板 | `components/chat/MCoTReasoningPanel.tsx` | ✅ |
| Chat 集成 MCoT 动态步骤 | `components/chat/Chat.tsx` | ✅ |
| SmartLayers 语义图层面板 | `components/canvas/SmartLayersPanel.tsx` | ✅ |
| CampaignSuite 营销矩阵 | `components/canvas/CampaignSuite.tsx` | ✅ |
| HistorySnapshots 历史快照 | `components/canvas/HistorySnapshots.tsx` | ✅ |
| CanvasExport 多格式导出（PNG/JPG/SVG/PDF/ZIP） | `components/canvas/CanvasExport.tsx` | ✅ |
| 批量生成上限提升至 40 张 + 快捷预设 | `components/chat/ChatTextarea.tsx` | ✅ |
| 模型类型扩展支持 audio | `components/settings/AddModelsList.tsx` | ✅ |
| i18n 翻译更新（中/英） | `i18n/locales/*/chat.json`, `canvas.json` | ✅ |

### 阶段 6：提供商设置卡片式重构（已完成 ✅）

| 任务 | 文件 | 状态 |
|---|---|---|
| CommonSetting 卡片式布局 + 连通性测试 | `components/settings/CommonSetting.tsx` | ✅ |
| AddModelsList 升级（audio 类型 + 颜色编码） | `components/settings/AddModelsList.tsx` | ✅ |
| providers.tsx 卡片网格 + 空状态 + 毛玻璃底栏 | `components/settings/dialog/providers.tsx` | ✅ |
| AddProviderDialog 图标替换 emoji | `components/settings/AddProviderDialog.tsx` | ✅ |

---

## 三、新增文件清单

| 文件路径 | 用途 |
|---|---|
| `specs/lovart-design-whitepaper.md` | 网站功能与设计白皮书 |
| `specs/lovart-migration-plan.md` | 本文件：逆向分析 & 迁移计划 |
| `components/home/TaskTypeSelector.tsx` | 任务类型选择器 |
| `components/home/FeatureCards.tsx` | 特性展示卡片 |
| `components/home/MultimodalShowcase.tsx` | 多模态输出展示 |
| `components/canvas/WorkModeIndicator.tsx` | Talk.Tab.Tune 工作模式指示器 |
| `components/canvas/pop-bar/PopbarActions.tsx` | PopBar 编辑操作按钮组 |
| `components/settings/dialog/brand.tsx` | 品牌设置面板 |
| `components/chat/OutputModeSelector.tsx` | 多模态输出类型选择器 |
| `components/chat/MCoTReasoningPanel.tsx` | MCoT 思维链推理可视化面板 |
| `components/canvas/SmartLayersPanel.tsx` | 语义图层（主体/背景/文字/前景）管理面板 |
| `components/canvas/CampaignSuite.tsx` | 营销矩阵（多平台一键延展）组件 |
| `components/canvas/HistorySnapshots.tsx` | 历史快照（版本回溯）组件 |

## 四、修改文件清单

| 文件路径 | 修改内容 |
|---|---|
| `assets/style/index.css` | dark 主题变量对齐 Lovart 风格 + 设计令牌 |
| `routes/index.tsx` | 首页重构：Hero + 任务选择器 + 特性卡片 + 多模态展示 |
| `components/canvas/CanvasHeader.tsx` | 集成 WorkModeIndicator |
| `components/canvas/pop-bar/CanvasPopbarContainer.tsx` | 集成 PopbarActions |
| `components/settings/dialog/sidebar.tsx` | 增加 Brand 菜单项 |
| `components/settings/dialog/index.tsx` | 增加 Brand 面板路由 |
| `components/chat/ChatTextarea.tsx` | 集成 OutputModeSelector + 批量生成上限 40 + 快捷预设 |
| `components/chat/Chat.tsx` | 集成 MCoT 思维链推理面板，动态生成推理步骤 |
| `components/chat/ModelSelectorV3.tsx` | 模型卡片重构：类型标签 + 能力图标 + 灵动布局 |
| `components/canvas/CanvasExport.tsx` | 多格式导出：PNG/JPG/SVG/PDF/ZIP |
| `components/settings/CommonSetting.tsx` | 卡片式布局 + 连通性测试 + 模型类型统计 |
| `components/settings/AddModelsList.tsx` | 新增 audio 类型 + 颜色编码标签 + 卡片式模型项 |
| `components/settings/dialog/providers.tsx` | 卡片网格 + 空状态 + 毛玻璃底栏 |
| `components/settings/AddProviderDialog.tsx` | emoji 替换为图标 |
| `lib/event.ts` | 新增 7 个画布编辑事件 |
| `i18n/locales/zh-CN/home.json` | 首页翻译扩展 |
| `i18n/locales/en/home.json` | 首页翻译扩展 |
| `i18n/locales/zh-CN/canvas.json` | 画布翻译扩展 + smartLayers/campaignSuite/history |
| `i18n/locales/en/canvas.json` | 画布翻译扩展 + smartLayers/campaignSuite/history |
| `i18n/locales/zh-CN/chat.json` | 聊天翻译扩展 + mcot 思维链推理步骤 |
| `i18n/locales/en/chat.json` | 聊天翻译扩展 + mcot 思维链推理步骤 |
| `i18n/locales/zh-CN/settings.json` | 设置翻译扩展 |
| `i18n/locales/en/settings.json` | 设置翻译扩展 |
