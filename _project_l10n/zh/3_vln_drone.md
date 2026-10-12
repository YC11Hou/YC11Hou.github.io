---
lang: zh
project: 3_vln_drone
title: "自主无人机的视觉语言导航"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> 代码：github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>我的工作 · 点击卡片跳转</p>
  <ol>
    <li><a href="#pipeline"><strong>轨迹生成流水线</strong><span>Lattice A* · 起飞 → 巡航 → 降落</span></a></li>
    <li><a href="#overview"><strong>数据集</strong><span>90 个场景 · 10,000+ 条轨迹，已开源</span></a></li>
  </ol>
</nav>

## 演示

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/vln_highlights_poster.jpg">
      <source src="/assets/video/vln_highlights.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/vln_overview_poster.jpg">
      <source src="/assets/video/vln_overview.webm" type="video/webm">
    </video>
  </div>
</div>

<div class="media-row">
  <div>
    <img src="/assets/img/p3_3dvln.jpg" alt="轨迹生成过程中的第一人称视角">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="三阶段轨迹：起飞、巡航、降落">
  </div>
</div>

## 概述 {#overview}

构建了一条稳健的流水线，在 Habitat 模拟器中生成多样化的 3D 导航轨迹，用于训练空中机器人的视觉语言导航（VLN）策略。

**动机：** 现有 VLN 数据集面向地面机器人，基于离散的导航图；无人机则需要三维空间中连续的起飞 → 巡航 → 降落轨迹，而此前并无这样的数据集，因此我们从零构建了一个。

**模拟器：** Habitat，包含 90 个室内场景。

**规模：** 90 个场景 × 每个场景 200–300 组起点—终点对 → **10,000+** 条带语言指令的三阶段 3D 轨迹，已在 GitHub 开源。

## 流水线 {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="四步生成流水线。Lattice A* 在 (x, y, θ) 空间中基于运动基元进行规划，无人机可以边前进边转向，而不像 Grid A* 那样只能做直角转弯（下方为示意草图）。" %}

1. **起点—终点对生成** — 为 90 个场景中的每一个随机生成 200–300 组 2D 起点—终点对，作为导航端点。

2. **2D 巡航路径规划** — 为每个场景确定合适的恒定巡航高度，然后使用 **Lattice A\*** 在该高度上规划自然的 2D 路径。标准 Grid A\* 会产生生硬的直角转弯，而 Lattice A\* 在连续状态空间 $$(x, y, \theta)$$ 中基于运动基元进行规划，生成的路径平滑，智能体可以边前进边转向。启发函数：

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   该函数对急转弯施加惩罚，从而保证飞行轨迹平滑且贴近真实。

3. **3D 轨迹拼装** — 在每条巡航路径之前加上**起飞**段、之后加上**降落**段，构成完整的 3D 轨迹，并沿整条路径以视频形式采集 RGB-D 观测。

4. **指令生成** — 使用视频转文本模型，根据采集到的观测视频生成自然语言导航指令，最终得到完整的 VLN 数据集。

该设计刻意做了简化——无人机在飞行途中不会频繁改变高度——但结合指令后，起飞与降落对当前的模型而言已经相当困难。基于该数据集的策略训练由实验室同学继续推进。
