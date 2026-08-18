# Daily Stock Analysis — Nuxt 3 重构版

把原 Python (FastAPI + SQLAlchemy + React SPA) 项目重构为 **Nuxt 3 前后端不分离 (SSR) + MongoDB** 架构，
可部署于 **Vercel**（已含 Cron 定时分析）或 Cloudflare。

> 本目录 `app-nuxt/` 为独立子工程，原 Python 代码保持不动，便于渐进式迁移。

## 技术栈

- **前端/后端同体**：Nuxt 3（Vue 3）+ Nitro server routes（SSR，前后端不分离）
- **数据库**：MongoDB（本地 `mongodb://127.0.0.1:27017` 或 Atlas）
- **样式**：Tailwind CSS
- **校验**：Zod（数据模型 schema）
- **部署**：Vercel（`vercel.json` 声明 build + Cron）；Nitro 预设自动探测平台
- **定时分析**：Vercel Cron → `POST /api/cron/daily`（工作日晚间，对应原 `00-daily-analysis.yml` 的 BJT 18:00）

## 快速开始

```bash
cd app-nuxt
cp .env.example .env        # 填 MONGODB_URI / STOCK_LIST / LLM key
npm install
npm run dev                 # http://localhost:3000
```

本地无 LLM key 也能跑通：分析服务 fail-open，使用确定性占位报告（与原项目 dry-run 语义一致）。

## 目录结构

```
app-nuxt/
├─ nuxt.config.ts           # Nuxt 配置 + runtimeConfig（env 注入）
├─ vercel.json              # Vercel 构建 + Cron 配置
├─ .env.example             # 统一环境变量模板
├─ server/
│  ├─ utils/                # db.ts(Mongo 单例) config.ts(类型化配置)
│  ├─ models/schemas.ts     # Zod 文档 schema（对应原 30 张表）
│  ├─ services/             # 业务服务（迁移自 Python）
│  │  ├─ fetcher.ts         # 行情获取（Mock + 可扩展真实源，fail-open）
│  │  ├─ analyzer.ts        # LLM 分析（OpenAI 兼容，fail-open）
│  │  └─ pipeline.ts        # 单股分析编排 + 落库
│  └─ api/                  # server routes（对应原 FastAPI 端点）
│     ├─ analysis/analyze.post.ts
│     ├─ history.get.ts / history/[queryId].get.ts
│     ├─ health.get.ts
│     └─ cron/daily.post.ts # 定时分析入口
├─ pages/                   # Nuxt 页面（SSR）
│  ├─ index.vue             # 触发分析 + 最近报告
│  ├─ history.vue           # 历史列表
│  ├─ history/[queryId].vue # 报告详情（Markdown SSR）
│  └─ about.vue
├─ layouts/default.vue      # 侧边导航布局
└─ assets/css/main.css      # Tailwind 入口
```

## 环境变量

见 `.env.example`。关键点：
- `MONGODB_URI` / `MONGODB_DB`：替代原 `DATABASE_PATH`（SQLite）
- `STOCK_LIST`：自选股（逗号分隔）
- LLM：`GEMINI_API_KEY` / `OPENAI_API_KEY` / `OPENAI_BASE_URL`
- `CRON_SECRET`：保护 `/api/cron/daily`（Vercel 托管 Cron 自带签名，可留空）
- `NUXT_PUBLIC_*`：暴露给浏览器，勿放密钥

## 数据模型（MongoDB Collections）

对应原 `src/storage.py` 的 30 张 SQLAlchemy 表，核心集合见 `server/models/schemas.ts`：
`analysis_history`、`stock_daily`、`decision_signal`、`backtest`、`task`、`portfolio*`、`alert*`、`screening_run`、`intelligence`、`system_config` 等。
原 JSON 字符串字段（payload/source_chain）改为嵌套文档。

## 部署（Vercel）

1. 导入仓库，根目录设为 `app-nuxt/`（Framework 选 Nuxt.js，自动识别 `vercel.json`）。
2. 在 Dashboard → Environment Variables 注入 `.env.example` 中的变量（或用 Vercel 加密环境变量 `@name`）。
3. 确保 `MONGODB_URI` 指向 Atlas（白名单 Vercel 出站 IP 或用 `0.0.0.0/0`+强密码）。
4. Cron 已在 `vercel.json` 声明：`0 10 * * 1-5` → `POST /api/cron/daily`。

## 迁移进度

### 已完成（垂直切片·范式模板）
- [x] Nuxt 3 工程骨架 + SSR + Tailwind
- [x] MongoDB 连接单例（Vercel 友好的 globalThis 缓存）
- [x] 类型化环境变量 + `.env.example`
- [x] 数据模型层（Zod schema，核心集合）
- [x] 个股分析垂直切片：fetcher → analyzer → pipeline → 落库
- [x] API：触发分析 / 历史列表 / 历史详情 / 健康 / Cron
- [x] 页面：首页 / 历史列表 / 历史详情（Markdown SSR）/ 关于
- [x] Vercel 部署配置 + Cron

### 待迁移（按同样范式批量推进）
- [ ] 真实数据源接入（`fetcher.ts`：Tushare/YFinance/Eastmoney/Longbridge + fallback）
- [ ] 新闻/情报检索（`SearchService` → `analyzer` 的 news 输入）
- [ ] 大盘复盘（`market_review` → `/api/analysis/market-review` + 页面）
- [ ] 回测引擎（`backtest_engine` → `/api/backtest` + 页面）
- [ ] 决策信号统计页面
- [ ] 持仓组合（portfolio）
- [ ] 预警规则（alerts）
- [ ] 选股（screening）
- [ ] 通知渠道落地（`notification`：企业微信/飞书/Telegram/邮件，cron 后推送）
- [ ] Agent 流式对话（`/api/agent` + SSE）
- [ ] 鉴权（`ADMIN_AUTH_ENABLED` → Nuxt 中间件）
- [ ] 股票索引自动补全（`stocks.index.json` 静态资源）
- [ ] 其余 10+ 个 React 页面 → Vue 组件迁移
