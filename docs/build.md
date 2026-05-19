# build — 测试、构建、启动、发布文档

## 1. 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 22.2.2 |
| pnpm | ≥ 10.33.0 |
| Git | ≥ 2.x |

### 安装依赖

```bash
pnpm install
```

pnpm workspace 自动安装 `packages/*` 和 `demo/` 下的所有依赖。

### .npmrc 配置

`pnpm-workspace.yaml` 中已配置：

```yaml
onlyBuiltDependencies:
  - esbuild
```

---

## 2. 测试

### 运行测试

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行全部测试（3个测试文件，78 项） |
| `pnpm test -- --watch` | 监听模式，文件变更自动重跑 |
| `pnpm test -- --coverage` | 运行全部测试 + 生成覆盖率报告 |
| `pnpm typecheck` | TypeScript 类型检查（`tsc -b` 项目引用模式） |
| `pnpm lint` | ESLint 代码规范检查 |

### 覆盖率阈值

配置在 `vitest.config.ts`：

```typescript
thresholds: {
  branches: 70,
  functions: 75,
  lines: 75,
  statements: 75,
}
```

覆盖率报告自动生成到 `coverage/` 目录（`text` + `lcov` 格式）。

### 测试文件结构

```
packages/core/__tests__/types.test.ts           # 核心类型定义测试
packages/adapter-openlayer/__tests__/
  ├── ol-draw-util.test.ts                       # 主类测试（生命周期/状态机/7种图形/CRUD）
  └── style.test.ts                              # 样式工具测试
```

> 测试用例详细清单见 `docs/test-cases.md`。

### 如何解读覆盖率

```
 % Coverage report from v8
| File       | % Stmts | % Branch | % Funcs | % Lines |
|------------|---------|----------|---------|---------|
| ol-draw-util.ts | 74.95 | 64.46 | 71.42 | 77.80 |
```

- **Stmts**：语句覆盖率 — 源代码中有多少条语句被至少执行过一次
- **Branch**：分支覆盖率 — 如 `if/else`、`switch`、三元表达式的每条分支是否都被覆盖
- **Funcs**：函数覆盖率 — 有多少函数被调用过
- **Lines**：行覆盖率 — 有多少代码行被执行过

> 当前分支覆盖率偏低主要原因是 OL 交互的回调（`modifystart`/`modifyend`/`translating`）需真实浏览器 DOM 和地图实例才能触发。

---

## 3. 构建

### 构建全部包

```bash
pnpm build
```

递归执行 `packages/*/` 下所有包的 `build` 脚本。

### 各包构建详情

#### `packages/core`

TypeScript 源码包，构建为空操作（`"build": "true"`）。实际发布时作为源码包直接导出 `.ts` 文件，由消费方 tsconfig 包含。

```
packages/core/src/
  ├── index.ts            # 统一导出
  ├── types/
  │   ├── coordinate.ts   # Coordinate 坐标类型
  │   ├── detail.ts       # 7 种要素详情类型
  │   ├── draw-state.ts   # DrawState 枚举
  │   ├── feature.ts      # FeatureInfo 判别联合类型
  │   └── index.ts
  └── abstract/
      ├── draw-basic-util.ts  # IWebGisDrawBasicUtil 抽象类
      └── index.ts
```

#### `packages/adapter-openlayer`

```bash
pnpm --filter @loongbao-web-gis-utils/draw-utils-base-openlayer build
```

使用 Vite 打包为 ES Module：

```
dist/
  ├── index.js       # ES Module（仅一个 js 文件）
  └── README.md      # 使用手册（postbuild 从 docs/usage-guide.md 复制）
```

打包约束：

- **external**：`ol` 和 `vue` 通过 `rollupOptions.external` 排除在 bundle 外，由业务方自行安装
- **无 .map**：`sourcemap: false`，不生成 sourcemap 文件
- **postbuild**：自动调用 `node -e "require('fs').cpSync('../../docs/usage-guide.md', 'README.md')"` 将使用手册复制到 dist 目录

```typescript
// packages/adapter-openlayer/vite.config.ts
export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: {
      external: (id: string) => /^ol(\/.*)?$/.test(id) || /^vue(\/.*)?$/.test(id),
    },
    sourcemap: false,
  },
})
```

---

## 4. 启动演示工程

```bash
cd demo
pnpm dev
```

或从根目录：

```bash
pnpm --filter draw-utils-base-demo dev
```

Vite 开发服务器启动后访问 `http://localhost:5173`。

### 演示工程结构

```
demo/
  ├── index.html
  ├── package.json
  ├── vite.config.ts           # Vite + Vue + Tailwind
  └── src/
      ├── main.ts              # Vue 入口
      ├── App.vue              # 主组件（地图 + 侧栏控制面板）
      └── style.css            # Tailwind + OL CSS
```

演示功能：
- OpenStreetMap 底图
- 侧栏按钮选择 7 种图形类型
- 双击地图完成绘制
- 单击选中要素 → 编辑 / 删除
- 双击任意位置结束编辑

---

## 5. 发布到 NPM

### 5.1 发布的包

发布范围 `@loongbao-web-gis-utils`，包名遵循统一前缀约定：

| 包名 | 说明 |
|------|------|
| `@loongbao-web-gis-utils/draw-utils-base-core` | 核心抽象（类型 + 抽象类） |
| `@loongbao-web-gis-utils/draw-utils-base-openlayer` | OL 适配实现 |

### 5.2 发布前检查清单

```bash
# 1. 确保所有检查通过
pnpm lint
pnpm typecheck
pnpm test

# 2. 确保覆盖率达标
pnpm test -- --coverage

# 3. 构建
pnpm build

# 4. 检查 dist 产物
ls packages/adapter-openlayer/dist/
# 应包含: index.js, README.md（无 .map 文件）
```

### 5.3 版本号更新

遵循 semver 规范：

```bash
# 更新 core
cd packages/core
pnpm version patch  # 0.0.1 → 0.0.2（bug fix）
pnpm version minor  # 0.0.2 → 0.1.0（新功能）
pnpm version major  # 0.1.0 → 1.0.0（破坏性变更）

# 更新 adapter-openlayer（版本号应与 core 同步）
cd packages/adapter-openlayer
pnpm version patch
```

### 5.4 发布

```bash
# 方式一：分发包单独发布
pnpm --filter @loongbao-web-gis-utils/draw-utils-base-core publish --access public
pnpm --filter @loongbao-web-gis-utils/draw-utils-base-openlayer publish --access public

# 方式二：使用 pnpm 的 publish 命令（需先登录 npm）
cd packages/core && pnpm publish --access public
cd ../adapter-openlayer && pnpm publish --access public
```

### 5.5 发布注意事项

1. **core 包**：发布前需确认 `package.json` 中 `private: false`
2. **adapter-openlayer 包**：发布前需确认 `main` 和 `types` 指向 dist 产物，而非源码
3. **无 .map**：确认 `sourcemap: false`（AGENTS.md 要求）
4. **external**：确认 `ol` 和 `vue` 在 `rollupOptions.external` 中，不会被打包进 bundle
5. **README.md**：确认 postbuild 脚本执行成功，dist 目录包含 README.md

### 5.6 发布后验证

```bash
# 在独立项目中安装测试
mkdir /tmp/test-install && cd /tmp/test-install
pnpm init
pnpm add @loongbao-web-gis-utils/draw-utils-base-openlayer ol@10.9.0

# 验证导入
node -e "import('@loongbao-web-gis-utils/draw-utils-base-openlayer').then(m => console.log(Object.keys(m)))"
```
