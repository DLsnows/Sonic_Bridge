# SonicBridge — Notification 系统前端交互文档

> Branch: `dev` | 2026-05-25
>
> 涵盖通知系统的完整前端行为，包括数据流、组件位置和用户交互。

---

## 架构概览

```
API (后端)                        Store (前端)                      UI (组件)
─────────                        ──────                           ──────
GET /api/notifications     →  notifications[], unreadCount   →  (不再直接渲染)
GET /api/notifications/    →  unreadByProject               →  Sidebar 项目 badge
    unread-counts                 { [projectId]: { total,      ProjectCardWrapper badge
                                                   threads,    NavCardLink 卡片 badge
                                                   files,
                                                   events } }
POST /api/notifications    →  markRead(id)                  →  (乐观更新)
PATCH /api/notifications   →  markAllRead()                 →  (乐观清空)
POST /api/notifications    →  recordProjectView(pid)        →  进入项目时清除 badge
    /view
PATCH /api/notifications   →  recordProjectView (批量)      →  markAllRead 触发
    /view
```

## 核心概念

### UnreadEntry 结构
```ts
{ total: number; threads: number; files: number; events: number }
```
- `total` = threads + files + events（用于 sidebar badge 和项目卡片 badge）
- 分项值用于 NavCardLink 各子页面的独立 badge

### Dismissed 机制 (localStorage)
- Key: `"notif-dismissed"`
- 存储每个项目的已忽略计数：`{ [projectId]: UnreadEntry }`
- **作用：** 当用户查看项目/标签页后，对应的未读计数被"驳回"并持久化到 localStorage
- **规则：** 实际的未读数 = 服务端返回的计数 - dismissed 计数（结果取 ≥0）
- 一旦 `recordProjectView` 被调用，该项目的所有 dismissed 累加（不会因刷新丢失）

---

## 组件位置

### 1. Sidebar（侧边栏项目列表）

**位置：** 所有已认证页面的左侧栏

| 元素 | 类型 | 功能 |
|------|------|------|
| 项目项 badge | 红点数字 (右上角) | 显示 `unreadByProject[projectId].total`。点击项目时不清零（由 recordProjectView 处理） |

**轮询：** Sidebar 挂载时每 30 秒调用 `fetchUnreadCounts()`。

---

### 2. Dashboard 项目卡片（`ProjectCardWrapper`）

**位置：** `/` 项目列表页

| 元素 | 类型 | 功能 |
|------|------|------|
| 项目卡片 badge | 红点数字 (右上角) | 显示 `unreadByProject[projectId].total` |

---

### 3. NavCardLink（项目概览导航卡片）

**位置：** `/projects/[id]` 项目概览页面的 4 个导航卡片

| 元素 | 类型 | 功能 |
|------|------|------|
| Discussion 卡片 badge | 红点数字 (右上角) | 显示 `unreadByProject[projectId].threads` |
| Files 卡片 badge | 红点数字 (右上角) | 显示 `unreadByProject[projectId].files` |
| Schedule 卡片 badge | 红点数字 (右上角) | 显示 `unreadByProject[projectId].events` |
| Creative Space 卡片 | 无 badge | 无通知 |

**点击行为：** 点击卡片时调用 `recordTabView(projectId, tab)`，只清除该 tab 的通知计数。

---

## 交互流程

### 用户进入项目（`recordProjectView`）

```
点击 sidebar 项目 / dashboard 卡片
  → 1. 累加该项目的 dismissed 计数 (localStorage)
  → 2. 从 unreadByProject 中删除该项目 (乐观)
  → 3. POST /api/notifications/view { projectId } (更新服务端 lastViewedAt)
```

**效果：** 该项目的所有未读 badge（sidebar + 卡片 + 子页 nav card）全部消失。

### 用户进入子页面 tab（`recordTabView`）

```
点击 NavCardLink (e.g. Discussion)
  → 1. 累加该 tab 的 dismissed 计数 (localStorage)
  → 2. 将该 tab 的计数置零 (乐观)
  → 3. POST /api/notifications/view { projectId } (更新服务端 lastViewedAt)
```

**效果：** 仅该 tab 的 badge 消失，其他 tab 的 badge 保留。

### 轮询刷新（`fetchUnreadCounts`）

```
每 30 秒
  → GET /api/notifications/unread-counts
  → 获取服务端原始计数
  → 减去 localStorage 中 dismissed 的计数
  → 如果某项目 total ≤ 0，从 unreadByProject 中移除
  → 更新 store
```

### 通知类型

| type | 来源 | referenceType | 说明 |
|------|------|---------------|------|
| `new_post` | discussionPosts (新 thread) | `discussion_post` | 项目中创建了新讨论帖 |
| `new_reply` | discussionPosts (新 reply) | `discussion_post` | 项目中创建了新回复 |
| `reply_to_user` | notifications 表 | `discussion_post` | 有人回复了你的帖子 |
| `new_event` | scheduleEvents | `schedule_event` | 项目中创建了新事件 |
| `new_file` | files | `file` | 项目中上传了新文件 |

**持久化 vs 临时：**
- `new_post` / `reply_to_user`：有 DB 行 (notifications 表)，markRead 调用 POST `/api/notifications`
- `new_reply` / `new_event` / `new_file`：**无 DB 行**（从 source table 查询），markRead 仅做本地状态更新

---

## 数据流总结

```
后端活动 → [persistent: notifications table / ephemeral: source-table query]
              ↓
         未读计数 = 创建时间 > lastViewedAt 的记录数
              ↓
         GET /api/notifications/unread-counts
              ↓
         store.unreadByProject (减去 localStorage dismissed)
              ↓
    ┌────────┼────────┬──────────────┐
    ↓        ↓        ↓              ↓
Sidebar  Dashboard  NavCardLink   NavCardLink
项目badge 卡片badge (Discussion)  (Files/Schedule)
(total)   (total)   (threads)     (files/events)
```

## 完整交互清单

| # | 交互 | 触发位置 | 结果 |
|---|------|----------|------|
| 1 | 进入项目 | Sidebar 项目点击 / Dashboard 卡片点击 | `recordProjectView`：清除该项目所有 badge |
| 2 | 进入 Discussion | NavCardLink (Discussion) 点击 | `recordTabView`：仅清除 threads badge |
| 3 | 进入 Files | NavCardLink (Files) 点击 | `recordTabView`：仅清除 files badge |
| 4 | 进入 Schedule | NavCardLink (Schedule) 点击 | `recordTabView`：仅清除 events badge |
| 5 | 轮询 | Sidebar 30s interval | `fetchUnreadCounts`：刷新 unreadByProject |
| 6 | 访问任何页 | Sidebar 挂载时 | 初始化轮询 |
