---
lang: zh
project: 4_exploration_vehicle
title: "基于前沿点的自主探索车"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>我的工作（本科毕业设计，队长）· 点击卡片跳转</p>
  <ol>
    <li><a href="#architecture"><strong>系统架构</strong><span>3 层 · 2 种任务模式</span></a></li>
    <li><a href="#hardware"><strong>硬件集成</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>伤员定位</strong><span>YOLOv11 掩码 + 深度 → 地图</span></a></li>
    <li><a href="#odometry"><strong>SLAM 里程计桥接</strong><span>Cartographer TF → /odometry</span></a></li>
    <li><a href="#frontier"><strong>前沿点探索</strong><span>信息增益 vs. 行驶代价</span></a></li>
    <li><a href="#experiments"><strong>现场实验</strong><span>3 个场地 × 3 种速度 × 3 次运行</span></a></li>
  </ol>
</nav>

## 演示

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="{{ '/assets/img/exploration_demo_poster.jpg' | relative_url }}">
      <source src="{{ '/assets/video/exploration_demo.mp4' | relative_url }}" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="{{ '/assets/img/exploration_demo2_poster.jpg' | relative_url }}">
      <source src="{{ '/assets/video/exploration_demo2.mp4' | relative_url }}" type="video/mp4">
    </video>
  </div>
</div>

## 概述

灾后搜救是与时间的赛跑，而废墟、高温或辐射往往使现场过于危险，人员无法率先进入。本项目构建了一台小型履带机器人，替救援人员先行一步：它在未知的室内空间中自主探索，边行驶边建图，并在地图上标出发现的每一个人，让救援人员在进入之前就知道该往哪里去。

全部算法都在机载 ROS 2 上运行：**Cartographer** 负责 SLAM，**Navigation2** 负责规划与控制，**YOLOv11** 搭配深度相机负责发现伤员，而我编写的**前沿点探索**节点负责决定下一步去哪里。

## 1. 系统架构与任务模式 {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="系统架构。Jetson（主机）运行整套 ROS 2 软件栈，并通过 USB 与各传感器通信；STM32（从机）驱动电机并通过 IIC 读取 IMU，两块板子之间通过 UART 通信。" %}

机器人有两种工作模式。在**探索模式**下，它为未知建筑建图，并在行进中记录伤员；在**救援模式**下，它重新加载该地图，依次驶向每一个已记录的伤员。

{% include svg_figure.liquid name="vehicle_modes" caption="两种模式的任务流程。探索模式循环执行“建图 → 前沿点 → 导航”，直到不再有有价值的前沿点，同时伤员检测并行运行；救援模式使用 AMCL 在已保存的地图上定位，并逐一前往存储的伤员位置。" %}

## 2. 硬件集成 {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="履带式机器人平台，顶部装有 LiDAR，前方装有深度相机" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>机器人平台：履带底盘上搭载 Jetson，顶部为 2D LiDAR，前方为 RGB-D 相机。</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>组件</th><th>作用</th><th>关键参数</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>机载计算机，运行全部 ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>用于 SLAM 和代价地图的 2D LiDAR</td><td>ToF · 0.05–12 m 量程 · 8–12 Hz 扫描</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>用于伤员检测的 RGB-D 相机</td><td>深度 0.6–8 m · 最高 640×480 @ 30 fps · RGB 视场角 66.01° × 40.2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>电机控制与 IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>MG513 DC motors</strong></td><td>履带驱动</td><td>最高 1.1 m/s · 3 kg 载重</td></tr>
  </tbody>
</table>
</div>

## 3. 伤员检测与三维定位 {#localization}

仅有边界框不足以把一个人定位到地图上：框的四角落在地面和背后的墙上，框内的深度大多是背景。因此检测器采用 **YOLOv11 分割**，只使用人体掩码内的深度像素。

{% include svg_figure.liquid name="vehicle_localize" caption="伤员定位。分割掩码在对齐后的深度图中选出人体像素；中值滤波去除噪声和离群值，剩余像素的均值即为距离 d_tar。掩码中心的水平位置给出方位角 θ_off，再由里程计提供的机器人位姿把该点从相机坐标系变换到地图坐标系。" %}

设 $$x_{cen}$$ 为掩码的水平中心，$$W_{img}$$ 为图像宽度，$$\theta_{FOV}$$ 为相机的水平视场角：

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

每个位置都随地图一并保存，它们就是救援模式随后驶向的目标点。

## 4. SLAM 里程计桥接 {#odometry}

Cartographer 以 TF 变换的形式给出机器人位姿，而导航和定位节点需要带速度的 `nav_msgs/Odometry` 数据流。一个小型桥接节点负责把前者转换为后者：

1. 查询 `map → odom` 和 `odom → base_link`，合成机器人位姿 $$T_{mb} = T_{mo} \cdot T_{ob}$$，得到位置 $$p = [x, y, z]^T$$ 和姿态四元数 $$q$$。
2. 将 $$q$$ 转换为横滚角、俯仰角和偏航角。
3. 对时间求差分：$$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$，偏航角速度则由经过角度回绕处理的偏航角差得到。
4. 发布包含位姿、速度和协方差的 `/odometry/filtered`。

## 5. 优化的前沿点探索 {#frontier}

经典的前沿点探索总是驶向最近的前沿点，这会在细小的角落里浪费时间，还会在地图上来回折返。我的节点对每个前沿点打分，权衡它**能揭示多少未知空间**与机器人**到达它需要行驶多远**：

1. **预处理** — 订阅 Cartographer 的占据栅格，并将其重塑为二维数组。
2. **检测前沿点** — 对已知空闲空间与未知空间之间的边界做 Canny 边缘检测。
3. **决策** — 选出增益与代价权衡最优的前沿点，作为下一个目标发送给 Nav2。

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ 是前沿点 $$f$$ 半径 $$r$$ 范围内未知栅格的加权数量；$$D_f$$ 是从机器人位置 $$p$$ 出发的路径长度；$$w_1, w_2$$ 用于调节两者的权衡。

{% include svg_figure.liquid name="vehicle_loop" caption="探索循环。每 2 秒重建一次地图，并沿已知空闲空间的边界提取前沿点；信息增益与行驶代价之比得分最优的前沿点成为下一个 Nav2 目标，得分随地图扩展而更新——探索稳步推进，没有冗余路径。" %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="前沿点可视化地图：前沿点、机器人、选中的前沿点和已定位的伤员" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="同一时刻的 RViz 视图，显示 Cartographer 地图和 Nav2 代价地图" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>一次运行中同一时刻的两种视图。左：前沿点地图，红线为前沿点，深蓝色圆点为机器人，绿色圆点为选中的前沿点，橙色圆点为已定位的伤员。右：RViz，显示 Cartographer 的地图和 Nav2 的膨胀代价地图。</figcaption>
</figure>

## 6. 现场实验 {#experiments}

真实的救援发生在庞大而复杂的空间中，且时间紧迫，因此测试只问一个简单的问题：**机器人在五分钟内能搜索多大的面积？** 实验在三个布局各异的室内环境中进行，设置三档速度限制，每档运行三次，共 27 次。

{% include svg_figure.liquid name="vehicle_sites" caption="三个测试场地（上）以及在各速度限制下五分钟内建成的地图。地图仅表示形状，未按统一比例绘制。白色为已探索的空闲区域，灰色为未知区域，黑色标示障碍物，红线为前沿点；橙色圆点为已定位的伤员，蓝色圆点为机器人，绿色圆点为下一个前沿点。" %}

{% include svg_figure.liquid name="vehicle_area" caption="五分钟内搜索的面积。不同环境对速度限制提高的响应各不相同。" %}

**数据说明了什么。** 最佳速度限制取决于场地布局。在**狭长开阔的教学区走廊**中，速度更快的机器人自然覆盖更多面积。在**狭窄的宿舍走廊**中，一旦限速超过 0.6 m/s，转弯和狭窄通道就会限制收益。在**杂乱的实验室**中，0.9 m/s 的探索量并不比 0.6 m/s 多。因此，单一的手工调定速度限制只能是一种折中。

## 7. 总结

按今天的标准来看它并不复杂，但这是一个由传感器、嵌入式控制、SLAM、导航、感知和决策等各个部分搭建起来的完整真机闭环，而此后每个项目所用到的部署能力都始于此。

实验也指明了后续的方向。毕业论文提出了两个方向：用无模型强化学习在线调节速度限制等探索参数，取代手工调参；以及用基于模型的端到端强化学习，仅凭视觉取代模块化的 LiDAR 软件栈。基于学习的导航，正是我后来研究所沿循的主线。
