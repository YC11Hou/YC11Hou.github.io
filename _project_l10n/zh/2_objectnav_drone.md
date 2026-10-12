---
lang: zh
project: 2_objectnav_drone
title: "AION：空中室内目标导航"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>我的工作（第二作者）· 点击卡片跳转</p>
  <ol>
    <li><a href="#framework"><strong>双策略框架</strong><span>目标不在视野内时进行探索</span></a></li>
    <li><a href="#exploration"><strong>探索策略</strong><span>深度开阔区域线索 + 奖励</span></a></li>
    <li><a href="#evaluation"><strong>评测</strong><span>AI2-THOR + 多房间 IsaacSim</span></a></li>
  </ol>
</nav>

## 演示

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## 概述

目标导航（Object-Goal Navigation，ObjectNav）要求智能体在未知环境中自主探索，并导航至由语义标签指定的目标物体。已有工作主要研究二维运动下的零样本 ObjectNav，而将其扩展到具备三维运动能力的空中平台仍缺乏探索。空中机器人机动性强、搜索效率高，但也在空间感知、动态控制和安全保障方面带来新的挑战。本文提出 AION，用于不依赖外部定位或全局地图的纯视觉空中 ObjectNav。AION 是一个端到端的双策略强化学习（RL）框架，将探索与抵达目标两种行为解耦为两个专门的策略。我们在 AI2-THOR 基准上评测 AION，并使用高保真无人机模型在 IsaacSim 中进一步评估其实时性能。实验结果表明，AION 在探索、导航效率和安全性的各项综合指标上均取得更优表现。

## 详情

**1. 任务**

面向无人机的室内目标导航，具备 **三维运动**：无人机需在没有任何先验地图或外部定位的情况下，自主探索未知环境，并导航至由语义标签指定的目标物体（例如“laptop”“microwave”）。

**我的职责：** 我负责探索策略的设计、训练与验证。

**为何需要两个策略：** 已有工作使用单一的抵达目标策略（LSTM + CLIP 文本–视觉对齐）。在 AI2-THOR 中这已足够，因为房间较小，转一圈后通常就能看到目标；但当目标位于另一个房间时，CLIP 没有可对齐的内容，智能体便会原地打转。因此我们按目标是否在视野内拆分行为，将其扩展到无人机的三维运动，并从单房间扩展到多房间环境。

**2. 框架**
{: #framework}

一个双策略 RL 框架，根据目标可见性在两种模式间切换：

- **探索模式** — 在未知空间中最大化空间覆盖
- **抵达目标模式** — 朝检测到的目标物体做视觉伺服

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="AION 双策略架构">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="基于深度的 ROI 提取">
  </div>
</div>

**3. 探索模式**
{: #exploration}

**输入：**
深度图 + ROI（感兴趣区域）。ROI 用于识别深度图中开阔、可通行的区域，模拟人在行进时本能地望向开阔空间的行为。ROI 通过基于 OpenCV 的方法提取，提供方向性线索（质心位置 $$(d_x, d_y)$$ 与平均深度 $$\bar{z}$$），而非未知空间的绝对信息。

**奖励：**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$：朝开阔空间移动的奖励
- $$R_{center}$$：偏航角偏离 ROI 质心的惩罚
- $$R_{safe}$$：碰撞 / 障碍物过近惩罚
- 外加覆盖面积奖励

将原始 RGB-D 直接输入 LSTM 并不能产生探索行为；正是 ROI 线索让循环策略获得明确的方向感，且无需里程计或地图。据我们所知，这是首个纯视觉、无地图的空中机器人探索策略。

**4. 抵达目标模式**

**输入：**
RGB 图像 + 冻结的 CLIP 文本嵌入（对齐文本与视觉特征，用于零样本物体识别）+ 物体 / 类别边界框。

**奖励：**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$：缩短与目标欧氏距离的奖励
- $$R_{bbox}$$：目标边界框在视野中居中并变大的奖励（表明正在接近物体）
- $$R_{parent}$$：父类奖励——例如目标是桌上的 laptop 时，到达该桌子即可获得部分奖励
- $$R_{suc}$$：任务成功奖励
- $$R_{collision}$$：碰撞惩罚

**5. 动作空间**

离散的 **三维** 动作——前进、左转 / 右转、上升、下降等。

**6. 评测**
{: #evaluation}

在两个模拟器上评测：AI2-THOR（含已见 / 未见物体划分的标准基准）和 IsaacSim（更大的多房间环境，目标可能位于另一个房间）。

AI2-THOR 的单个房间无法检验探索能力——目标往往一开始就可见——因此我们在 IsaacSim 中构建了多房间评测（Chemistry Lab、Beechwood、Ihlen），目标放置在起始位置不可见的房间中。只有抵达目标策略的方法会原地打转；加入探索策略后，无人机会朝开阔空间前进，并跨房间找到目标。

{% include svg_figure.liquid name="aion_thor" caption="AI2-THOR 基准在两种物体划分上的结果。AION 在两种划分的所有指标上均领先；在 18/4 未见划分上，SR 比 MJO 高 4.3 个点，SPL 高 3.5 个点。" %}

{% include svg_figure.liquid name="aion_isaac" caption="IsaacSim 在三个多房间场景中使用高保真无人机模型的跨场景评测。每个点代表一次试验（每个物体、每个场景五次）；AION 在 60 次试验中成功 52 次，而探索策略结合 MJO 与 SSNet 分别为 40 次和 35 次。" %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="IsaacSim 场景与目标物体">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Beechwood 中的探索轨迹">
  </div>
</div>
