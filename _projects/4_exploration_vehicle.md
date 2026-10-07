---
layout: page
title: Frontier-Based Autonomous Exploration Vehicle
description: Led a team to develop an autonomous exploration system using ROS2 and LiDAR. Implemented SLAM algorithms including Cartographer and Navigation2 for real-time mapping and path planning. Integrated YOLOv11 for object detection and deployed the complete system on embedded hardware.
img: assets/img/exploration_poster.jpg
preview_video: /assets/video/exploration_preview.mp4
importance: 4
category: bachelor
org: nuaa
i18n_key: vehicle
start: 2024-09
end: 2025-04
meta: ROS 2 · Jetson Orin NX · Team lead
---

<nav class="contrib">
  <p>What I did (undergraduate thesis, team lead) · click a card to jump</p>
  <ol>
    <li><a href="#architecture"><strong>System architecture</strong><span>3 layers · 2 task modes</span></a></li>
    <li><a href="#hardware"><strong>Hardware integration</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Casualty localization</strong><span>YOLOv11 mask + depth → map</span></a></li>
    <li><a href="#odometry"><strong>SLAM odometry bridge</strong><span>Cartographer TF → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Frontier exploration</strong><span>Information gain vs. travel cost</span></a></li>
    <li><a href="#experiments"><strong>Field experiments</strong><span>3 sites × 3 speeds × 3 runs</span></a></li>
  </ol>
</nav>

## Demo

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

## Overview

Search and rescue after a disaster is a race against time, and debris, heat or radiation often make the site too dangerous for people to enter first. This project builds a small tracked robot that goes in ahead of them: it explores an unknown indoor space on its own, builds the map as it drives, and marks every person it finds on that map, so rescuers know where to go before they set foot inside.

Everything runs on board in ROS 2: **Cartographer** for SLAM, **Navigation2** for planning and control, **YOLOv11** with a depth camera for finding casualties, and my **frontier-exploration** node that decides where to go next.

## 1. System architecture & task modes {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="System architecture. The Jetson (host) runs the whole ROS 2 stack and talks to the sensors over USB; the STM32 (slave) drives the motors and reads the IMU over IIC, and the two boards talk over UART." %}

The robot works in two modes. In **exploration mode** it maps an unknown building and records casualties as it goes; in **rescue mode** it reloads that map and drives to each recorded casualty in turn.

{% include svg_figure.liquid name="vehicle_modes" caption="Task flow of the two modes. Exploration repeats map → frontier → navigate until no useful frontier is left, while casualty detection runs alongside; rescue localizes on the saved map with AMCL and visits the stored casualty positions one by one." %}

## 2. Hardware integration {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="The tracked robot platform with a LiDAR on top and a depth camera at the front" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>The platform: a tracked chassis carrying the Jetson, a 2D LiDAR on top and an RGB-D camera at the front.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Component</th><th>Role</th><th>Key specification</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Onboard computer, runs all of ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>2D LiDAR for SLAM and costmaps</td><td>ToF · 0.05–12 m range · 8–12 Hz scan</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>RGB-D camera for casualty detection</td><td>Depth 0.6–8 m · up to 640×480 @ 30 fps · RGB FOV 66.01° × 40.2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Motor control and IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>MG513 DC motors</strong></td><td>Tracked drive</td><td>Up to 1.1 m/s · 3 kg payload</td></tr>
  </tbody>
</table>
</div>

## 3. Casualty detection & 3D localization {#localization}

A bounding box is not enough to place a person on a map: its corners fall on the floor and the wall behind, so the depth inside it is mostly background. The detector therefore uses **YOLOv11 segmentation**, and only depth pixels inside the person's mask are used.

{% include svg_figure.liquid name="vehicle_localize" caption="Casualty localization. The segmentation mask selects the person's pixels in the aligned depth image; a median filter removes noise and outliers, and the mean of what remains is the range d_tar. The horizontal position of the mask centre gives the bearing θ_off, and the robot pose from odometry carries the point from the camera frame into the map." %}

With $$x_{cen}$$ the horizontal centre of the mask, $$W_{img}$$ the image width and $$\theta_{FOV}$$ the camera's horizontal field of view:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Each position is saved with the map, and these are the goals the rescue mode later drives to.

## 4. SLAM odometry bridge {#odometry}

Cartographer provides the robot pose as TF transforms, while the navigation and localization nodes expect a `nav_msgs/Odometry` stream with velocities. A small bridge node converts one into the other:

1. Look up `map → odom` and `odom → base_link` and compose the robot pose, $$T_{mb} = T_{mo} \cdot T_{ob}$$, giving position $$p = [x, y, z]^T$$ and orientation quaternion $$q$$.
2. Convert $$q$$ to roll, pitch and yaw.
3. Differentiate in time: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, and the yaw rate from the wrapped yaw difference.
4. Publish `/odometry/filtered` with pose, twist and covariance.

## 5. Optimized frontier exploration {#frontier}

Classic frontier exploration drives to the nearest frontier, which wastes time on tiny pockets and doubles back across the map. My node scores every frontier by **how much unknown space it would reveal** against **how far the robot must drive** to reach it:

1. **Preprocess** — subscribe to Cartographer's occupancy grid and reshape it into a 2D array.
2. **Detect frontiers** — run Canny edge detection on the boundary between known free space and unknown space.
3. **Decide** — pick the frontier with the best gain–cost trade-off and send it to Nav2 as the next goal.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ counts the weighted unknown cells within radius $$r$$ of frontier $$f$$; $$D_f$$ is the path length from the robot position $$p$$; $$w_1, w_2$$ set the trade-off.

{% include svg_figure.liquid name="vehicle_loop" caption="Exploration loop. Every 2 s the map is rebuilt and frontiers are extracted along the boundary of known free space; the frontier with the best information-gain-versus-travel-cost score becomes the next Nav2 goal, and scores update as the map grows — steady exploration without redundant paths." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Frontier visualization map: frontiers, robot, chosen frontier and located casualties" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="RViz view of the same moment with the Cartographer map and the Nav2 costmap" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>The same moment of a run in two views. Left, the frontier map: red lines are frontiers, the dark-blue dot is the robot, the green dot is the chosen frontier and orange dots are located casualties. Right, RViz with Cartographer's map and Nav2's inflated costmap.</figcaption>
</figure>

## 6. Field experiments {#experiments}

A real rescue is a large, complex space under time pressure, so the test asks a simple question: **how much area does the robot search in five minutes?** It was run in three indoor environments with different layouts, under three speed limits, three runs each — 27 runs in total.

{% include svg_figure.liquid name="vehicle_sites" caption="The three test sites (top) and a map built in five minutes at each speed limit. Maps show shape only and are not drawn to a common scale. White is explored free space, grey is unknown, black marks obstacles and red lines are frontiers; orange dots are located casualties, the blue dot is the robot and the green dot is the next frontier." %}

{% include svg_figure.liquid name="vehicle_area" caption="Area searched in five minutes. Each environment responds differently to a higher speed limit." %}

**What the numbers say.** The best speed limit depends on the layout. In the **long, open teaching-area corridor**, a faster robot simply covers more ground. In the **narrow dormitory corridor**, turns and tight passages cap the gain once the limit passes 0.6 m/s. In the **cluttered laboratory**, 0.9 m/s explores no more than 0.6 m/s. A single hand-tuned speed limit is therefore a compromise.

## 7. Takeaways

Simple by today's standards, but a complete real-robot loop built from individual parts — sensors, embedded control, SLAM, navigation, perception and decision-making — and the deployment skills used in every later project started here.

The experiments also pointed to what came next. The thesis proposed two directions: tuning exploration parameters such as the speed limit online with model-free RL instead of by hand, and replacing the modular LiDAR stack with model-based, end-to-end RL from vision alone. Learning-based navigation is the line my later research followed.
