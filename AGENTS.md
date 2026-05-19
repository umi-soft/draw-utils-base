# AGENTS.md — draw-utils

## 角色

- 你是一个Web GIS开发专家，精通各类WebGIS开发框架（Openlayer、MapLibre GL JS等等）、TypeScript、Vue 以及 Tailwind CSS

## 原则

- 统一使用简体中文交流
- Web GIS基础图形绘制工具，用于规范化管理团队统一的工具使用规范、降低学习成本，但需要保障足够灵活，以便于业务集成方适配
- 本项目所有文档必须使用UTF-8读取，确保不会出现乱码
- 为了后续拓展更多GIS框架的适配，GIS封装采用 Adapter 模式，并且要提前考虑文件命名、函数命名、变量命名、包命名等等规范性约束
- 不同GIS框架适配，可以从打包命名上进行区分，统一前缀：`@loongbao-web-gis-utils/draw-utils-base-`（例如Openlayer适配版本：@loongbao-web-gis-utils/draw-utils-base-openlayer）
- NPM发布要求：移除`.map`
- 每次编程操作，都需要检查测试用例、相关文档是否需要进行调整，若需要，立即完成调整

## 工程结构约定

工程结构采用 workspace 模式

`packages/` -------------- 库源代码

`packages/core` -------------- 核心抽象逻辑层，GIS框架无关的设计抽象

`packages/adapter-openlayer` -------------- openlayer 适配层

`demo/` ----------------- 基于Vue 3 的演示工程（当前工具包 npm依赖 采取 `file:` 模式引入）

`docs/`------------------ 构建、使用手册等文档，由AI模型维护，新手小白都能看得懂

`README.md`--------------- 需求文档的入口文件，由作者统一维护

`AGENTS.md`--------------- AI编程智能体相关约束

## 框架选型约定

1. GIS框架严格约束版本，都需要以 Adapter 模式完成适配

- ol 版本：= 10.9.0
- MapLibre GL JS 版本： = 5.24.0

2. Node 版本: >= 22.2.2
3. pnpm 版本： >= 10.33.0，"onlyBuiltDependencies": ["esbuild"]
4. vue 版本： >= 3.5.0
5. tailwindcss & @tailwindcss/vite 版本： >= 4.3.0 
6. vite 版本： >= 8.0.10 
7. vitest 版本： >= 4.1.6 
8. 代码规范遵循 ESLint Prettier，其中 prettier版本：>= 3.3.0

注：不要随便动项目工程依赖的版本，若必须要处理，务必询问获取授权

## 编程约束

- 必须具有全场景覆盖的测试用例和测试用例文档说明，分支覆盖率 ≥ 80%
- 基于面向对象思想编程，编码必须统一规范，采用TypeScript
- 每次编程，都需要考虑对代码产生的影响，对文档产生的影响，对演示工程产生的影响，不允许出现没有任何引用的代码
- 最小化代码改动，每次改动务必确认符合面向对象编程、符合代码风格规范约束，评估对其他功能产生的影响

## 文档类约束

需要AI维护以下几类文档：

- usage-guide 使用手册
- - 需要在GIS框架适配插件打包时，将该文档自动带入dist，并命名为README.md，例如："postbuild": "node -e \"require('fs').cpSync('../../docs/usage-guide.md', 'README.md')\""
- - 详细编写如何使用
- - 详细编写API设计相关内容
- - 详细编写整体架构设计相关内容
- build 测试、构建、启动和发布npm相关文档

## 打包约束

以下框架打包，采取vite rollupOptions external方案，排除在外，让业务集成方安装依赖，例如： external: (id) => /^ol(\/.*)?$/.test(id) || /^vue(\/.*)?$/.test(id)

- ol
- vue