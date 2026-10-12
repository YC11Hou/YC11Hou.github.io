---
lang: zh
project: 0_honor_internship
title: "荣耀人形机器人：面向 VLA 的真机强化学习"
source_hash: b1ae248d5011
---

在荣耀自研**人形机器人**上开展工作：遥操作数据采集、回放、训练与真机部署，并针对自定义操作任务研究**视觉-语言-动作（VLA）**模型的**真机强化学习**算法。

<nav class="contrib">
  <p>我做了什么 · 点击卡片跳转</p>
  <ol>
    <li><a href="#loop"><strong>端到端 VLA 流程</strong><span>采集 → 训练 → 部署，实验室从零搭建</span></a></li>
    <li><a href="#data-design"><strong>离线数据设计</strong><span>4 类数据：跟踪 + 恢复</span></a></li>
    <li><a href="#infra"><strong>人工接管训练基础设施</strong><span>接管 · Actor–Learner–Robot 闭环 · 新任务 ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>真机强化学习算法</strong><span>RECAP · RAPID · 移动操作</span></a></li>
    <li><a href="#rove"><strong>复现 ROVE</strong><span>自主成功率 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>真机调试</strong><span>6 个 bug，均由探针定位</span></a></li>
  </ol>
</nav>

## 演示

### 扰动下的真机推理

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

真机上的自主抓取放置：在回合进行中扰动物体（左）和目标篮子（右），策略会重新跟踪并完成任务。机械手始终不停地运动，策略也从不等待物体静止——它学到的是视觉跟踪与抗扰动能力，而不是一条固定的抓放轨迹。

### 面向鲁棒性的数据设计

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

四类遥操作示教数据：标准示教、抓取阶段扰动、放置阶段扰动，以及从抓取失败状态中恢复——旨在让策略学会恢复，而不只是重复。

### 真机 SFT：前后对比

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

离线训练的策略无法完成的任务，通过真机学习闭环在机器人上学会：人工接管数据回流到训练中，随着新检查点不断下发，接管比例持续下降。

## 1. 端到端 VLA 流程 {#loop}

我入职后从零搭建了上海实验室：机器人配置、两套遥操作设备（Pico VR 与动作捕捉）、数据采集员培训，以及训练流程。任务是抓取放置（瓶子 → 篮子），使用单一固定指令。

{% include svg_figure.liquid name="honor_pipeline" caption="端到端真机流程。GR00T N1.7（3B）在冻结视觉-语言骨干的情况下进行后训练；37 维动作选自 115 维机器人状态。由于没有验证集，每 2K 步保存一次检查点，并通过真机 rollout 选择；损失在约 15K 步后趋于平稳。" %}

{% include svg_figure.liquid name="honor_chunk" caption="推理时的动作块交接。在还剩 15 步时请求下一个动作块；推理期间已过时的动作被丢弃，重叠部分做线性交叉淡化，因此机器人在块与块之间不会卡顿。" %}

**在机器人上**，放置阶段几乎从不失败——即使篮子被快速拖动，策略也能跟上。抓取失败与物体位置相关；追溯下来问题出在数据（固定站姿、采集时没有局部运动，模型因此始终无法建立距离感），而不是机械臂精度。成果：实验室拥有了自己的“采集 → 微调 → 真机验证”迭代闭环，不再依赖外部交付的模型。

## 2. 离线数据设计 {#data-design}

**为什么是这四类数据。** 类别 ①–③（标准、抓取阶段扰动、放置阶段扰动）教策略_跟踪_移动的物体或容器。类别 ④ 教策略_恢复_：从抓取失败后悬停的位姿出发，示教会降低手部、重新抓取并放置。没有它，策略往往意识不到抓取已经失败——它会抬着空手移到篮子上方，“放置”一个并不存在的物体。四类数据大致均衡；上方演示中的鲁棒性来自这套数据设计，而不是超参数调优。

## 3. 人工接管的真机训练基础设施 {#infra}

### 3.1 人工接管与干预驱动的数据流水线 {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">遥操作员在回合中途接管，随后交还控制权（3 倍速，无声）。</p>

**平滑的人工接管。** 在真机上学习要求人可以随时接管而机器人不发生跳变。接管时，VLA 指令话题被重定向到遥操作话题，控制器输出的是在上一个 VLA 动作基础上的_增量_，而不是遥操作员的绝对关节角。

{% include svg_figure.liquid name="honor_fsm" caption="切换状态机与接管输出规则。接管同样会写入数据，因此每个回合都清楚哪些帧来自人类。" %}

**干预驱动的数据流水线。** 每个回合都会被持久化，操作员只能向下否决成功分类器的判断，不能把失败提升为成功；分类器的决策以及假阳性/假阴性统计会一并记录。缓冲区是有界的 numpy 环形缓冲，按成功/失败分桶，采用软删除 FIFO 和加权采样（PER 重要性修正），并提供 HTTP 审核接口，使每个回合在进入训练前都可被检查。在另一轮中，138 个采集回合里有 127 个作为成功进入缓冲区（11 个完全自主，116 个含接管示教）。

{% include svg_figure.liquid name="honor_datapipe" caption="从机器人到 Learner：每个回合（包括失败回合）都会被记录、判定并上传；Learner 按结果对回合分桶。下方：一轮真机数据的构成（每回合 142–416 帧）。" %}

### 3.2 分布式真机学习闭环 {#online-loop}

**复现了 Hi-ORS 拒绝采样闭环，并将其从 π0 + Dobot 机械臂移植到 GR00T N1.7 + 人形机器人。** 三台机器同时运行。

{% include svg_figure.liquid name="honor_arch" caption="Actor–Learner–Robot 架构。Actor 驱动策略控制机器人，只有成功的回合会送达 Learner，Learner 每 1,000 步把可训练权重推回 Actor。" %}

{% include svg_figure.liquid name="honor_gates" caption="回合进入训练前的关卡。成功分类器是作用于单帧左相机图像的 ResNet18，带单 logit 输出头，使用 BCE + pos_weight 在 572 个回合上训练（按回合划分数据集、在线增广、标签由夹爪信号自动导出；帧级 F1 为 0.976）。它只有在连续 20 帧得分高于 0.8 后才会锁存——这一滞回机制是在首次真机实验后加入的，当时分类器在 1–2 秒内就宣告成功，假阳性塞满了缓冲区。每个 batch 中都混入基础示教锚点，以防遗忘。" %}

### 3.3 真机 SFT 结果：约 140 个回合内，新任务从 ≈ 0% 提升到 50%+ {#results}

当策略停滞时，操作员通过 Pico 接管；接管数据直接流入 Learner，接管比例则作为实时指标。**场景 1** 把瓶子移到右侧，那里的离线数据很稀疏。**场景 2** 把整个布局左右对调（篮子在左、瓶子在右）——与所有离线数据恰好相反，因此离线 SFT 基线约为 0%。

{% include svg_figure.liquid name="honor_curve" caption="真机 SFT 期间每个回合中遥操作步数的占比，以及下发给 Actor 的检查点。每次检查点更新后接管都会下降；第 86 回合前后的上升对应切换到场景 2。在测试阶段（检查点 5000–7000），接管比例降至 18.8%。" %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>场景</th><th>相对离线数据的变化</th><th>回合数</th><th>离线 SFT</th><th>真机 SFT 后</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>瓶子在右侧（离线数据中稀疏）</td><td>20</td><td>未测量</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>篮子在左、瓶子在右（布局镜像）</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

此处为完全自主的成功率。冻结骨干为何仍能学会镜像布局：失败模式是_完全不动_，而不是朝错误方向运动——视觉理解完好，缺的只是动作映射。

## 4. 真机强化学习算法 {#algorithms}

### 4.1 RECAP 式的优势条件训练 {#recap}

拒绝采样是优势的二值退化情形：保留所有成功，丢弃所有失败。**将 π0.6 RECAP 的优势标注（参照 RLinf）移植到 GR00T N1.7**，从而使用_全部_数据，把“好 vs. 坏”作为输入条件而非过滤器——失败回合成为负样本而不是浪费。

{% include svg_figure.liquid name="honor_recap" caption="RECAP 式流水线。失败惩罚 c_fail = 1000 超过最长成功（1,000 帧）与最短失败（57 帧）之间的差距，因此每个失败的排名都低于每个成功。n = 20 步对应论文在 20 Hz 下 1 秒的时间跨度。负样本只用于塑造无条件的 CFG 分支。" %}

{% include svg_figure.liquid name="honor_value_net" caption="价值网络。GR00T 骨干保持冻结、不接收梯度；图像与文本 token 分别做均值池化，因为图像 token 远多于文本 token，单一均值会稀释语言条件。RLinf 追加一个可学习的 CLS token 并使用单个线性头；而 GR00T 骨干不接受额外的输入嵌入，因此我们改用池化并增加一个隐藏层。原子分布示意图仅作说明。" %}

在 V 就绪之前，基于规则的标签作为后备：所有成功帧为正，失败回合的自主帧为负，每次接管之前的 20 帧一律改写为负。价值网络单独训练，只有当留出回合（每 10 个回合取 1 个）上的 Spearman ρ 超过 0.55 时才被接受：试运行达到 ρ = 0.647（平台期 0.59），损失从 4.52 降到 0.76，而打乱标签的对照组绝对 ρ 始终 ≤ 0.26，未通过该标准——说明这一标准是有意义的。基于 V 的标签与基于规则的标签一致率仅为 0.31，因此价值网络仍是瓶颈，真机 A/B 对比也未能完成。

### 4.2 RAPID：噪声空间中的快速适应 {#rapid}

**RAPID**（_Rapid Adaptation from Physical Interventions via Diffusion-noise_，基于扩散噪声的物理干预快速适应），思路与 DSRL 相近：训练新检查点需要时间，在其落地之前机器人依然无法完成任务。RAPID 保持 VLA 权重冻结，只替换 flow matching 的初始噪声，使人刚刚做出的修正在下次出现相似状态时可以被复用。它在 8 月下旬接入了真机推理。

{% include svg_figure.liquid name="honor_rapid" caption="RAPID。离线阶段，人类修正通过冻结的策略被反演为能复现它们的初始噪声（64 个精细步；4 步 Euler 过于粗糙），并存入以观测为键的记忆库。部署时，检索到的噪声先与高斯噪声做球面插值，再进行正常的 flow-matching 采样。" %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="DSBC 噪声网络。一个小型 MLP 直接把检索键映射为初始噪声，取代最近邻查找；VLA 本身保持冻结。H 为 GR00T 动作头的 40 步动作时域（每次推理执行 30 步）；D 为其动作维度。" %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="在计数任务的 24 个接管回合上的离线验证。DSBC 在每个 K 上都领先（54.9–57.0）；记忆检索在 K = 1–2 时仅为 20，K ≥ 4 时为 45–49；部分加噪稳定在 37；memory_delta 低于 8。指标是 DTW 增益，而非真机成功率。" %}

该审计是**预先注册**的：审计通过；反演为有条件通过（重建误差 0.232，位于 0.10–0.30 区间内）；离散度在重跑后被降级为脆弱；迁移通过（p ≈ 1e-21）。在这些标准下，“K < 10 时检索占优”的论断被**放弃**——实验设计否定了我自己的假设——系统最终收敛为以 DSBC 为主路径、记忆检索为可选前端。后续计划是把 DSBC 蒸馏进策略、对记忆条目做软淘汰，并接入真机强化学习。

### 4.3 扩展到移动操作 {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">人形机器人自主走向台面并抓取瓶子——7 段真机视频，5 倍速，无声；黄色地面标记为行走路径参考。</p>

整套系统——接管、真机学习闭环、RECAP 和 RAPID——无需重写，就从桌面抓取放置迁移到了带行走的任务。

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>移动操作数据</th><th>数值</th></tr></thead>
  <tbody>
    <tr><td>采集的行走回合</td><td>507 个回合 · 181K 帧</td></tr>
    <tr><td>经 6 项筛选标准后保留</td><td>326 个回合</td></tr>
    <tr><td>合并后的训练集</td><td><strong>848 个回合 · 306K 帧（+71%）</strong></td></tr>
    <tr><td>每回合路径长度中位数</td><td>0.32 m → <strong>3.2 m</strong></td></tr>
  </tbody>
</table>
</div>

**关于指标，说实话：**真机 SFT 阶段有完整的数据（55% / 50%）。切换到移动操作任务后，所有组件都已实现并接入，但在该任务上没有取得指标层面的提升：当时全身硬件与运动控制栈的成熟度不足以支持系统性的真机评估。

## 5. 复现 ROVE {#rove}

**任务。**人形机器人原地站立——双脚固定、不行走——用手拿起一部手机：这是精细操作，轻微的对不准就会很快导致人工接管。

ROVE（小鹏，arXiv:2606.17011）保留了 RECAP 的优势条件骨架（§4.1），改变的是人工接管的计分方式。我在 RECAP 流水线之上通过一个算法开关复现了它——默认的 RECAP 路径保持逐位一致，由自测保证——并把论文的算法 1 作为离线循环运行：部署并采集 → 阶段感知回报 → 价值刷新 → 优势与标签 → 条件 SFT。只有第一步需要机器人，其余四步一条命令即可跑完。

### 5.1 阶段感知回报 {#rove-return}

在 RECAP 下，被人救回的回合仍算作成功：其回报逐步上升一直到 0，因此_导致_接管的自主动作看起来像是稳步推进。唯一的补救是一条固定规则，把接管前的 20 帧标为负。ROVE 把这样的回合分成三段——自主执行、适应（人仍在把机器人拉回正轨）和恢复——并在 t_r（适应结束时刻）记入失败惩罚 C_fail。导致接管的自主段现在按失败水平计分，而恢复段保持其正常的剩余时间回报。

{% include svg_figure.liquid name="honor_rove_return" caption="阶段感知回报（论文式 2）：每步 −1，在 t_r 处记 C_fail，空闲帧（操作员切换模式）被剔除。未标注时，t_r 回退为接管时刻 + 40 帧（2 秒）；论文的消融实验显示，把 t_r 放在接管起点会损失 30 个百分点，因此默认值宁晚勿早。C_fail 必须大于正样本池中的最长跨度，否则失败回合的得分会高于恢复：在这批数据上实测下界为 919，所以取 C_fail = 1000（论文的 500 在这里偏小）。回报在 38 个归档回合上与手算结果逐位一致。" %}

### 5.2 乐观价值估计（OVE） {#rove-ove}

普通的蒙特卡洛回归学到的是_平均_回报。在经常以接管告终的状态中，平均值本来就低，所以导致接管的动作其优势接近于零，永远不会被标为负。OVE 在 MC 预训练之后对同一个标量价值头继续微调，使用 16 步 TD 目标（来自网络的 EMA 副本）和 τ = 0.7 的期望分位数（expectile）损失，该损失对低估的惩罚大于对高估的惩罚。于是 V 估计的是一个状态在_一切顺利时_的价值：接管前的状态被估得很高，而它们的实际回报很低，负优势便落在导致接管的动作上。优势时域同样是 16 步——正好是一个动作块，也是标签所依附的单位——并且前 40% 的帧被标为正。

每个价值检查点都由留出回合上的 Spearman ρ 把关：即预测 V 与实际回报之间的秩一致性（1 表示顺序完全相同）。MC 阶段在完整数据池上必须达到 ρ ≥ 0.55；OVE 阶段只在成功回合上评判（ρ ≥ 0.70），因为 OVE 在趋向失败的状态上按设计就会偏离平均回报，所以完整数据池上 ρ 较低是预期现象，而非退化。

{% include svg_figure.liquid name="honor_rove_rho" caption="三次价值训练中留出集上的 Spearman ρ（阴影：OVE 阶段）。纯净 rollout：切换到 OVE 后成功集 ρ 保持在 0.744–0.806，而完整数据池 ρ 从 0.735 降至 0.69，符合预期；0.70 的门槛即由这次运行确定。示教 + rollout：成功集 ρ 从 0.731 滑落到 0.628——留出集的 85% 是纯净示教，乐观自举把它们全部推向顶部，使排序被压缩。iter0 数据池，直接热启动进入 OVE：完整数据池 ρ 为 0.68–0.71，成功集 ρ 为 0.63–0.67，低于门槛。三个数据池的留出集不同，因此各面板之间的 ρ 不可直接比较。" %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="留出接管回合上的价值曲线：真实回报、MC 价值与 OVE 价值，并标出负优势的帧" loading="lazy" width="1400" height="653">
  <figcaption>在一个含接管的留出回合上复现论文图 6（x：帧，已剔除空闲帧；y：归一化价值）。在 t_r 之前，OVE 价值（蓝）高于 MC 价值（橙）——在分布内偏乐观——随后在 t_r 处跃升，并在恢复阶段跟随真实回报。红点标出 OVE 优势为负的帧：它们集中在接管之前和适应段。</figcaption>
</figure>

### 5.3 结果 {#rove-results}

机器人上的自主成功率从 40%（基础检查点，n = 77）提升到 **52%**（ROVE iter0，n = 192）；人工辅助成功的回合占比从 45% 降到 20%，而失败占比从 14% 升到 28%。

{% include svg_figure.liquid name="honor_rove_robot" caption="每个检查点下所有已记录真机回合的结果，由操作员判定。Base 64000：8 月下旬至 9 月上旬；base 80000：9 月上旬至中旬；ROVE iter0：9 月 17–23 日。" %}

iter0 通过离线循环的一轮训练得到：一个包含 2,068 个回合的价值数据池（示教与真机 rollout 共 534K 帧，留出 207 个回合），标签正样本比例恰为 40.0%，并从 80K 步的基础检查点出发做条件 SFT，共 8,000 步（lr 1e-4），在单张 H20 GPU 上耗时 18 小时 17 分钟。

{% include svg_figure.liquid name="honor_rove_sft" caption="iter0 条件 SFT 损失。200 步滑动均值到第 1,000 步从 0.54 降至 0.047，到第 8,000 步降至 0.025。" %}

**关于指标，说实话：**三组数据来自不同的日期、操作员和提示集，所以这只是观察，而不是 A/B 测试——与基础检查点及 RECAP 对照组的交错评估仍待进行。iter0 的采集也没有记录接管段，因此在修复该日志之前，下一轮缺少 ROVE 的核心信号。

## 6. 真机调试 {#debugging}

这些问题没有一个能靠离线审查代码发现——它们只在长时间的真机运行中才暴露，并且每个都是借助探针或量化指标定位的。

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>现象</th><th>探针 / 证据</th><th>根因 → 修复</th></tr></thead>
  <tbody>
    <tr><td>微调后泛化能力下降</td><td>留出损失在第 2000 步从 0.0048 升到 0.0222（×4.6）；动作方向余弦从 0.995 → 0.979 → 0.961</td><td>基础数据混合器把 mp4 按 BGR 读取，而冻结的视觉塔期望 RGB——一半的梯度预算在学噪声；改一个默认值即修复。锚点仅覆盖 29 个回合（5.6%）→ 扩大基础缓冲区</td></tr>
    <tr><td>缓冲区被假成功填满</td><td>回合在第 24 步和第 29 步就锁存为“成功”；Learner 在这些数据上训练了 1,000+ 步</td><td>锁存与复位共用一个 0.5 阈值，没有滞回 → 改为 p &gt; 0.8 持续 20 帧锁存，p ≤ 0.3 持续 3 帧复位。后来一个未复位的物体在 11 个回合中产生了 2,536 个垃圾步——刚好超过 2,500 步的训练阈值：从第一次实验起就应逐帧审计</td></tr>
    <tr><td>训练、部署和 RL 中行为不一致</td><td>逐字段对比三条流水线中的观测</td><td>夹爪 DDS 类型、相机上下颠倒、手部位置初始化、头部位置索引 → 9 项修复清单</td></tr>
    <tr><td>回合开始时机器人转向</td><td>偏航漂移中位数 31°</td><td>偏航锚点过期 + 每个块都完全重新锚定 → 3°/块的速率限制加 20° 上限；6 次验证运行：锚定误差 0.0°，第一秒内转向 ≤ 1.6°</td></tr>
    <tr><td>相机帧过期</td><td>83 个回合中有 77 个存在 47% 的连续重复帧；源 61 Hz，解码 54.9 Hz，负载下有效约 10.6 Hz</td><td>增加了帧新鲜度的可观测性</td></tr>
    <tr><td>“模型不动”</td><td>训练端客户端卡在重试中</td><td>Actor / Learner 端口不匹配。教训：每一次“模型不动”，都应先查通信或观测，再查权重</td></tr>
  </tbody>
</table>
</div>
