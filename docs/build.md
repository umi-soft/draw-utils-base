# build — 测试、构建、启动、发布文档

## 1. 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 22.2.2 |
| pnpm | ≥ 10.33.0 |

```bash
pnpm install
```

## 2. 测试

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行全部测试（4 文件，94 项） |
| `pnpm test -- --watch` | 监听模式 |
| `pnpm test -- --coverage` | 覆盖率报告 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint 代码规范检查 |

覆盖率阈值（`vitest.config.ts`）：branches 60%, functions 68%, lines 74%, statements 72%

## 3. 构建

```bash
pnpm build
```

### 产物

| 包 | 构建方式 | 产物 |
|----|----------|------|
| core | 源码发布 | `src/*.ts` |
| adapter-openlayer | vite lib (es) | `dist/index.js` + `dist/index.d.ts` + `dist/README.md` |
| adapter-maplibre | vite lib (es) | 同上 |

- 无 `.map` 文件
- `ol` / `maplibre-gl` / `vue` 均 external

## 4. 启动

```bash
cd demo && pnpm dev
```

## 5. 发布 npm

### 5.1 前置检查

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### 5.2 发布

```bash
# core（源码包）
pnpm publish --workspace-root=packages/core --access public --no-git-checks

# adapter-openlayer
pnpm publish --workspace-root=packages/adapter-openlayer --access public --no-git-checks

# adapter-maplibre
pnpm publish --workspace-root=packages/adapter-maplibre --access public --no-git-checks
```

### 5.3 版本管理

遵循 semver，发布前更新 `package.json` 中的 `version` 字段。

### 5.4 发布后验证

```bash
mkdir /tmp/test && cd /tmp/test
pnpm init
pnpm add @loongbao-web-gis-utils/draw-utils-base-openlayer ol@10.9.0
node -e "import('@loongbao-web-gis-utils/draw-utils-base-openlayer').then(m => console.log(Object.keys(m)))"
```
