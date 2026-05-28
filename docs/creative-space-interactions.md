# SonicBridge — Creative Space 前端交互文档

> Branch: `dev` | 2026-05-25
>
> 涵盖 Creative Space 页面中所有可交互元素。

---

## 页面布局

```
┌──────────────┬──────────────────────────────┬──────────────┐
│  DAW 面板    │       主区域 (Spotlight)       │ 成员列表     │
│  (w-72)      │   - 视频网格 / 聚光灯模式      │              │
│              │   - RoomAudioRenderer         │  [聊天按钮]  │
├──────────────┴──────────────────────────────┴──────────────┤
│              浮动控制栏 (底部居中)                            │
└────────────────────────────────────────────────────────────┘
```

## 渲染阶段

页面有 3 个互斥的渲染状态：

| 阶段 | 条件 | 交互 |
|------|------|------|
| Loading | 正在获取 LiveKit token | 仅 spinner + "Connecting to Creative Space..." |
| Error | token 获取失败 | 错误信息 + **Retry** 按钮 |
| Connected | token 获取成功 | 完整 UI |

---

## 1. DAW Audio Bridge 面板 (左侧栏，固定 w-72)

### 断开 / 错误状态

| 元素 | 类型 | 功能 |
|------|------|------|
| 状态 LED | 显示 | 绿色=Connected, 黄色=Connecting, 灰色=Disconnected, 红色=Error/Missing |
| 插件名称+版本 | 显示 | 连接时显示 |
| 错误消息 | 显示 (红色背景) | lastError 文本 |
| **Reconnect** | Button (全宽) | 尝试重连 VST WebSocket |
| Port 输入框 | Number input | 输入插件 WebSocket 端口号 |
| **Connect** | Button | 保存端口并触发重连 |

### 已连接状态

| 元素 | 类型 | 功能 |
|------|------|------|
| **Level** 音量表 | 显示 (`VstVolumeMeter`) | 实时 L/R/Peak 电平 (dBFS) |
| **Audio** 信息区 | 显示 | Sample Rate (kHz)、Channels (Stereo/2ch) |
| **Broadcast to Room** | Checkbox | 启用/禁用将 DAW 音频发布到 LiveKit 房间 |
| Published 状态 | 显示 | 绿色=已发布, 黄色=正在发布 |

---

## 2. 主区域 — SpotlightView

取代了旧的 `ParticipantGrid`，支持 Grid 和 Spotlight 两种显示模式。

### 空状态（无 tracks）

| 元素 | 类型 | 功能 |
|------|------|------|
| 带宽节省提示 | 显示 | videoWatchEnabled=false 时: 🔋 + "Video paused" + 提示 |
| 等待协作者提示 | 显示 | 正常时: ◈ + "Waiting for collaborators..." + 邀请提示 |

### Grid 模式（≤2 tracks 或 spotlight 未激活）

| 元素 | 类型 | 功能 |
|------|------|------|
| Track tile | `ParticipantTile` | 参与者视频 / 屏幕共享画面 |
| **双击 tile** | 手势 | 进入该 track 的 spotlight 模式 (仅 ≥3 tracks 时可用) |

### Spotlight 模式（≥3 tracks 且已选中焦点）

| 元素 | 类型 | 功能 |
|------|------|------|
| 主 spotlight tile | `ParticipantTile` (大) | 占据主区域 |
| 身份标签 | 显示 (左下 overlay) | 参与者名称（屏幕共享时追加 "— Screen"） |
| **Exit Spotlight** | Button (右上 overlay) | 退出 spotlight 回到 grid |
| 缩略图条 | 可点击缩略图 | 点击切换 spotlight 焦点到该 track |

**自动行为：** 有人开始屏幕共享 → 自动 spotlight 该屏幕共享。屏幕共享结束 → 自动退出 spotlight。当 spotlight 的 track 消失（参与者离开）→ 自动退出。

---

## 3. 成员列表 (右侧栏上方)

| 元素 | 类型 | 功能 |
|------|------|------|
| **People** 标题 + 计数 | 显示 | X 人 |
| 参与者头像 | 显示 | 首字母，说话时绿色 glow pulse |
| 参与者名称 + "You" 标签 | 显示 | 本人显示紫色 "You" badge |
| 状态灯 (4 个) | 显示 | Mic: 绿=On/红=Off, Cam: 绿=On/红=Off, Screen: 蓝=On/灰=Off, DAW: 紫=Active/灰=Off (仅本人行) |
| 统计信息行 | 显示 | 音频比特率、视频分辨率+fps+比特率、屏幕共享分辨率+fps+比特率 |
| 底部图例 | 显示 | Mic / Cam / Screen / DAW 四种颜色 |

---

## 4. 聊天面板 (ChatPanel，右侧栏下方)

| 元素 | 类型 | 功能 |
|------|------|------|
| **💬 聊天按钮** | Toggle | 打开/关闭聊天面板，未读显示蓝色计数 badge (99+) |
| **✕** | Button | 关闭聊天面板 |
| 消息列表 | 可滚动 (auto-scroll) | 本人消息蓝底右对齐，他人灰底左对齐 |
| 发送者 + 时间 | 显示 | 每条消息 |
| 消息输入框 | Text input | |
| **Send** | Submit | 发送 LiveKit chat 消息。空或发送中 disabled（显示 "..."） |

**未读逻辑：** 面板关闭时收到新消息 → 累计 unreadCount。打开面板 → 清零。

---

## 5. 浮动控制栏 (ControlBar，底部居中固定)

共 **10 个交互控件 + 状态指示 + Leave**：

| # | 图标 | 类型 | 功能 |
|---|------|------|------|
| 1 | 🎤/🔇 | Mic 开关 | 开启: 启动 mic pipeline (echoCancellation + noiseSuppression/voiceIsolation) → publish track。关闭: stop pipeline → unpublish。绿=On, 红=Off |
| 2 | ▼ | Device selector | 弹出 `DeviceSelector` (audioinput 设备列表) |
| 3 | 📹/📷 | Camera 开关 | `setCameraEnabled(!isCameraEnabled)`。绿=On, 红=Off |
| 4 | ▼ | Device selector | 弹出 `DeviceSelector` (videoinput 设备列表) |
| 5 | 🖥 | Screen share 开关 | 使用 media-settings store 中的 screen share 配置 (分辨率/fps)。蓝=Sharing, 灰=Off |
| 6 | 👁/👁‍🗨 | 视频观看开关 | 暂停/恢复视频订阅以节省带宽。灰=On, 琥珀=Bandwidth saving |
| 7 | 🎚 | 混音器开关 | 打开/关闭 `AudioMixer` 面板。蓝=Open, 灰=Closed |
| 8 | ⚙ | 媒体设置开关 | 打开/关闭 `MediaSettingsPanel` 模态框。蓝=Open, 灰=Closed |
| — | | 分隔线 | |
| 9 | 绿点/红点 | 连接状态 | "Live" (绿色脉冲) / "Off" (红色) |
| 10 | Leave | Button | `router.push(/projects/[id])` |

---

## 6. DeviceSelector 弹出菜单

| 元素 | 类型 | 功能 |
|------|------|------|
| 标题 | 显示 | "Input Device" / "Camera" |
| "Loading devices..." | 显示 | 枚举设备中 |
| 设备列表项 | Button | 点击切换活动设备 (`room.switchActiveDevice`) |
| **Cancel** | Button | 关闭弹出 |

---

## 7. MediaSettingsPanel 模态框

分三个区域：

### Microphone

| 元素 | 类型 | 范围 |
|------|------|------|
| **Opus Bitrate** | Range slider | 192–640 kbps, step 32 kbps |
| **Send Buffer** | Range slider | 8–2048ms, step 8ms |
| **Receive Buffer** | Range slider | 8–2048ms, step 8ms |
| **Noise Reduction** | Toggle buttons (3) | **Off** (白) / **Suppression** (绿) / **Voice Iso (Chrome)** (紫)。切换时自动重启 mic pipeline |

### Camera

| 元素 | 类型 | 选项 |
|------|------|------|
| **Frame Rate** | Toggle buttons (3) | 15 / 30 / 60 fps |
| **Resolution** | Toggle buttons (2) | 720p / 1080p |
| **Bitrate** | Range slider | 0.5–5 Mbps, step 250 kbps |

### Screen Share

| 元素 | 类型 | 选项 |
|------|------|------|
| **Frame Rate** | Toggle buttons (3) | 15 / 30 / 60 fps |
| **Resolution** | Toggle buttons (3) | 720p / 1080p / Original |
| **Bitrate** | Range slider | 0.5–5 Mbps, step 250 kbps |

---

## 8. AudioMixer 面板 (浮动，居中顶部)

### Inputs 区域

| 元素 | 类型 | 功能 |
|------|------|------|
| Header **✕** | Button | 关闭面板 |
| **Local Microphone** 电平条 | 显示 | 颜色按级别: 蓝→绿→黄→红 |
| **Local Microphone** Gain | Range slider | 0–200%, step 1% |
| **DAW Audio (VST)** 电平表 | `VstVolumeMeter` | 仅连接+发布时显示 |
| **DAW Audio (VST)** 音量 | Range slider | 0–200%, step 1% |
| **Opus Bitrate** (LiveKit encoder) | Range slider | 192–640 kbps, step 32 kbps |

### Outputs 区域

| 元素 | 类型 | 功能 |
|------|------|------|
| "No other participants" | 显示 | 无远程参与者时 |
| 远程参与者音量 | Range slider (每人一个) | 0–200%, step 1%，独立调节 |

---

## 9. 连接错误状态

| 元素 | 类型 | 功能 |
|------|------|------|
| ⚠ 图标 + 错误标题 | 显示 | "Connection Failed" |
| 错误消息 | 显示 | |
| **Retry** | Button | 中止当前请求，重新 fetch token |

---

## 完整操作清单 (38 项)

**实时音视频 (9):**
1. Mic 开关 — 2. Mic 设备选择 — 3. Camera 开关 — 4. Camera 设备选择 — 5. Screen share 开关 — 6. 视频观看暂停/恢复 — 7. 混音器开关 — 8. 媒体设置开关 — 9. Leave

**Spotlight (4):**
10. 双击进入 spotlight — 11. 缩略图切换焦点 — 12. Exit Spotlight — 13. 屏幕共享自动 spotlight

**媒体设置 (12):**
14. Opus Bitrate — 15. Send Buffer — 16. Receive Buffer — 17. Noise Reduction 模式 — 18. Camera FPS — 19. Camera Resolution — 20. Camera Bitrate — 21. Screen FPS — 22. Screen Resolution — 23. Screen Bitrate

**DAW 桥 (4):**
24. Reconnect — 25. Port + Connect — 26. Broadcast toggle — 27. DAW Volume

**混音器 (5):**
28. Mic Gain — 29. DAW Volume — 30. Opus Bitrate (LiveKit) — 31. 远程参与者音量 (每人)

**聊天 (3):**
32. 面板开关 — 33. 消息发送 — 34. 未读清零

**连接 (1):**
35. 连接失败 Retry
