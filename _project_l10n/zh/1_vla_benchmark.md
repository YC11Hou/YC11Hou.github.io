---
lang: zh
project: 1_vla_benchmark
title: "LangGap:VLA 语言理解基准"
source_hash: ceb66c896e84
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2603.00592" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2603.00592
  </a>
  <a href="/assets/pdf/LangGap-IROS2026-poster.pdf" target="_blank" rel="noopener">
    <i class="fa-solid fa-image"></i> 海报(IROS 2026)
  </a>
</p>

<nav class="contrib">
  <p>我的工作(第一作者)· 点击卡片跳转</p>
  <ol>
    <li><a href="#benchmark"><strong>基准设计</strong><span>99 个任务 · 4 个扰动维度</span></a></li>
    <li><a href="#data"><strong>数据采集</strong><span>16 个任务 × 150 条脚本演示</span></a></li>
    <li><a href="#training"><strong>模型训练</strong><span>π0.5 LoRA · 单任务 0% → 90%</span></a></li>
    <li><a href="#results"><strong>结果分析</strong><span>93.8% → 21.4% · 4 个 VLA 模型</span></a></li>
  </ol>
</nav>

## 演示

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/langgap_video_poster.jpg">
      <source src="/assets/video/langgap_video.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/langgap_poster.jpg">
      <source src="/assets/video/grid_8x4.mp4" type="video/mp4">
    </video>
  </div>
</div>

## 概述

视觉-语言-动作(VLA)模型在标准基准上的成功率超过 95%。然而,系统性实验表明,当前最先进的 VLA 模型在很大程度上忽略了语言指令。已有工作缺少:(1)系统性的语义扰动诊断,(2)从设计上迫使模型理解语言的基准,以及(3)语言多样的训练数据。本文构建了 LangGap 基准,基于四维语义扰动方法——在保持桌面布局不变的前提下改变指令语义——揭示了 π0.5 在语言理解上的缺陷。LIBERO 等现有基准每个布局只对应一个任务,没有充分利用场景中的物体和目标位置;LangGap 在相同布局下充分丰富抓取-放置任务,迫使模型真正理解语言。实验表明,有针对性的数据增强可以部分弥合语言鸿沟——单任务训练的成功率从 0% 提升到 90%,多任务训练则从 0% 提升到 28%。然而,随着扩展任务语义多样性的增加,模型的学习容量明显不足,甚至连训练过的任务表现也很差。这揭示了 VLA 模型在理解多样化语言指令上面临的根本性挑战,这也正是 LangGap 的长期价值所在。

## 详情

**1. 基准与数据集**
{: #benchmark}

LangGap 基准共 **99 个任务**:40 个原始 LIBERO 任务 + 59 个扩展的语义扰动任务。我们提供包含 56 个任务的训练数据集:16 个自采集的扩展任务(每个 150 条演示)+ 40 个原始任务(每个 50 条演示),共约 4,100 条轨迹。

**2. 问题发现**
{: #diagnosis}

在同一视觉场景中,将指令从 "put bowl on plate" 改为 "put bowl on stove",模型仍然执行原来的动作(走向盘子),成功率为 **0%**。这表明 VLA 做的是从视觉到动作的模式匹配,而非真正的语言理解。

我们设计了四维语义扰动诊断——更换物体(Change Object)、更换目标(Change Target)、空间描述(Spatial Description)和抽屉动作(Drawer Action)——保持视觉场景完全一致,只修改指令:

{% include svg_figure.liquid name="langgap_diagnosis" caption="π0.5 在 99 个任务、1,980 个回合上的诊断结果。我们对 40 个原始任务的复现结果与官方分数一致;59 个扩展任务则下降了 72.4 个百分点。在 Change Target 上,π0.5 的全部 260 个回合均失败,所有被测模型的成功率都不超过 2.3%,因此这一失败并非措辞造成的假象——而总体分数恰恰掩盖了它。" %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="带有扰动标注的 LIBERO 评测套件">
  </div>
</div>

**3. 设计原则**
{: #design}

1. **同场景多任务** — 多个任务共享完全相同的初始视觉状态,消除视觉捷径。忽略语言的模型成功率至多为 1/k(k 为每个场景的任务数)。
2. **指令级训练/评测划分** — 训练任务不包含全部测试任务;留出的评测集包含未见过的语言指令,用于检验组合泛化能力。
3. **物理可行性验证** — 所有扩展任务均在 LIBERO 模拟器中验证,确保可抓取、可到达、可检测。

**4. 数据采集流程**
{: #data}

- **可扩展且多样的生成:** 我们采用基于路径点的脚本化采集流程,高效、稳定地为每个任务收集 150 条成功回合。路径点虽然针对每个具体任务硬编码,但模拟器会在初始桌面布局中引入轻微的自然变化,使采集到的轨迹在视觉和动力学上都具有多样性,避免模型只是死记硬背僵化、相同的路径。
- **分层控制架构:** 每个任务使用定制脚本,将抓取-放置过程分解为多个顺序路径点。在高层,我们采用纯比例(P)控制计算位置误差并输出连续的动作指令;这些指令再由模拟器底层的 OSC(操作空间控制)PD 控制器执行,实现平滑而高精度的连续控制。

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="脚本化演示的路径点序列:回到初始位姿、抓取、搬运、放置" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">脚本化演示的路径点时序(示意):初始位姿 → 物体上方 → 抓取 → 抬起 → 目标上方 → 放置。采用 OSC_POSE 控制器,每步位姿误差归一化到 [−1, 1];只有在步数预算内成功的回合才会被保留。</p>

- **为什么用脚本而不是遥操作:** 早期使用鼠标遥操作的尝试抖动严重、速度慢且不一致。我们根据每个任务 BDDL 文件中的物体坐标编写脚本,并在模拟器中手工调试,直到每个任务都可抓取、可到达、可检测——由此得到的动作干净利落,采集完全自动化:每个任务约 150 条演示(官方 LIBERO 任务为 50 条),16 个任务共约 2,400 条演示。

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="脚本化演示回合的样例" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">2,400 条脚本化演示中的部分样例。</p>

**微调:单任务从 0% 到 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">左:训练前——指令要求放到 "stove" 上,策略仍把碗放到盘子上。右:在扩展数据上微调后——碗被放到了炉灶上。</p>

- 在单张 RTX 4090 上对 π0.5 进行 LoRA 微调(r = 64)。
- 检查点按回合展开(rollout)的结果而非损失来选择:损失持续下降,而成功率并不单调。
- 除 43 个留出任务的指令是全新的之外,训练与测试指令逐字完全相同。

**5. 结果**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="完整基准:近期 VLA 模型在 LIBERO 全部四个套件上的表现,原始任务与扩展任务对比。所有模型都存在显著的语言鸿沟;我们在 45 个任务上微调的 π0.5 提升了扩展任务总分(22.8)和 Change Target(0 → 6.2),同时在原始任务上保持 89.5。43 个留出任务从未参与训练。" %}

{% include svg_figure.liquid name="langgap_progressive" caption="使用相同的扩展数据,随训练任务数从 1 增加到 56 的渐进式验证。单任务的死记硬背可达到 90%,但随着语义不同的任务一同学习,收益迅速崩塌;混入 40 个官方任务(共 56 个任务)后成功率恢复到 27.5%,但语言鸿沟依然存在。" %}

**6. 长期价值**

随着任务语义多样性的增加,模型的学习容量明显不足——甚至连训练过的任务表现也很差。这揭示了一个与架构无关的根本性挑战:所有被测模型(π0.5、π0、π0-FAST、SmolVLA)都表现出相同的语言鸿沟。LangGap 提供了一个系统性的诊断工具,随着新的 VLA 架构不断涌现,它依然有价值,正因为语言鸿沟是当前训练范式尚未解决的持久性问题。
