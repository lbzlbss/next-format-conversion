# 首页（工具台）

> 覆盖 `src/app/page.jsx`。全局见 `../MASTER.md`。

## 布局

- 左栏 288px：`bg-mf-sidebar`，Logo + 折叠分组导航（动效与图片转换）+ AI 对话入口
- 顶栏 sticky：`bg-mf-surface/90`，标题 + 搜索 + 知识库 + 图标按钮
- 主区：`bg-mf-canvas`，工具卡片 `mf-card`
- 右栏 360px（md+）：参数 `Settings` 面板

## 移动端

- 侧栏隐藏；顶栏 `Select` 切换 `activeKey`
- 搜索框 `sm:` 以上显示

## 交互

- 导航激活：`.mf-sidebar-nav-btn.is-active`（蓝色左边线 + 浅蓝底）
- Wiki 链接：侧栏或顶栏「知识库」→ `/wiki`
