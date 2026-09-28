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

An autonomous rescue robot designed to explore unknown indoor environments and mark the locations of injured persons. The robot autonomously navigates, builds a map in real time, and detects casualties along the way.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/p1_robot_real.jpg" alt="Hardware overview" style="max-width: 70%; border-radius: 12px;">
</div>

## Hardware

- **Jetson Orin NX 16GB** — onboard compute (Ubuntu 22.04, ROS2 Humble)
- **RPLIDAR C1** — 2D LiDAR for SLAM and mapping
- **Orbbec Astra Pro Plus** — 3D depth camera for YOLO-based casualty detection
- **STM32F407VET6 / MPU6050** — motor control and IMU
- **MG513 DC Motors** — differential drive

## Software Stack

- **Cartographer** — real-time SLAM (mapping and localization)
- **Navigation2** — point-to-point autonomous navigation
- **YOLOv11** — casualty detection via depth camera

## Key Contribution: Information-Gain Frontier Exploration

Standard frontier exploration creates redundant paths. We formulate an optimized frontier selection that balances new information against travel cost:

$$f^* = \arg\max_{f \in F} \left( w_1 \cdot I_f - w_2 \cdot D_f \right)$$

where $$I_f$$ is the information gain of frontier $$f$$ and $$D_f$$ is the navigation cost. The robot selects the frontier that maximizes expected coverage while minimizing unnecessary travel.

{% include svg_figure.liquid name="vehicle_loop" caption="Exploration loop. Every 2 s the map is rebuilt and frontiers are extracted along the boundary of known free space; the frontier with the best information-gain-versus-travel-cost score becomes the next Nav2 goal, and scores update as the map grows — steady exploration without redundant paths." %}

<div style="margin: 1.5em 0;">
  <img src="/assets/img/p1_frontier_map.jpg" alt="Frontier-based exploration running on the robot: live map, frontiers and camera view" style="width: 100%; border-radius: 4px;">
</div>

Simple by today's standards, but a complete real-robot loop built from individual parts — the deployment skills used in every later project started here.
