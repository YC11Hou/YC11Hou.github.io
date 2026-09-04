---
layout: page
title: Frontier-Based Autonomous Exploration Vehicle
description: Led a team to develop an autonomous exploration system using ROS2 and LiDAR. Implemented SLAM algorithms including Cartographer and Navigation2 for real-time mapping and path planning. Integrated YOLOv11 for object detection and deployed the complete system on embedded hardware.
img: assets/img/p1_robot_real.jpg
importance: 4
category: bachelor
org: nuaa
meta: ROS 2 · Jetson Orin NX · Team lead
---

## Demo

<div class="media-row">
  <div class="ratio-16x9">
    <iframe src="https://drive.google.com/file/d/1haxn_iNXpebKC7ZddG_swejB8xaGpgRc/preview" allow="autoplay" allowfullscreen></iframe>
  </div>
  <div class="ratio-16x9">
    <iframe src="https://drive.google.com/file/d/11dCs_qUwQSNqTOiaHjU_bLXyb7nuTHjx/preview" allow="autoplay" allowfullscreen></iframe>
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
