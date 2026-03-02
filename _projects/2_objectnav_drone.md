---
layout: page
title: "AION: Aerial Indoor Object-Goal Navigation"
description: End-to-end dual-policy RL framework for vision-based aerial ObjectNav without external localization or global maps. Evaluated on AI2-THOR and IsaacSim.
img: assets/img/aion_thumbnail.jpg
video: https://www.youtube.com/embed/TgsUm6bb7zg
importance: 2
category: master
---

## Demo

<div class="video-container">
  <iframe src="https://www.youtube.com/embed/TgsUm6bb7zg" allowfullscreen></iframe>
</div>

## Overview

Object-Goal Navigation (ObjectNav) requires an agent to autonomously explore unknown environments and navigate toward target objects specified by semantic labels. While prior work has primarily studied zero-shot ObjectNav under 2D locomotion, extending it to aerial platforms with 3D locomotion remains underexplored.

**AION** is an end-to-end dual-policy reinforcement learning framework that decouples exploration and goal-reaching behaviors into two specialized policies. It enables vision-based aerial ObjectNav without relying on external localization or global maps.

## Key Features

- **Dual-Policy RL**: Separate specialized policies for exploration and goal-reaching
- **Vision-Based**: RGB-D perception without external localization or global maps
- **3D Locomotion**: Designed for aerial robots with superior maneuverability
- **Sim-to-Real**: Evaluated on AI2-THOR and IsaacSim with high-fidelity drone models

## Resources

- [arXiv Paper](https://arxiv.org/abs/2601.15614)
