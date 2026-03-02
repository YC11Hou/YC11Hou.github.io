---
layout: page
title: VLA Language Understanding Benchmark
description: Designed a systematic semantic perturbation evaluation framework revealing that state-of-the-art VLA models ignore language instructions despite high benchmark scores. Proposed multi-task same-scene training approach and constructed augmented dataset for fine-tuning.
preview_video: /assets/video/grid_8x4.mp4
importance: 1
category: master
---

## Demo

<video controls style="width: 100%;">
  <source src="/assets/video/iros_final.mp4" type="video/mp4">
</video>

## Overview

Vision-Language-Action (VLA) models are expected to follow language instructions to perform robotic manipulation tasks. However, our systematic evaluation reveals that state-of-the-art VLA models largely **ignore language instructions** despite achieving high benchmark scores.

We designed a **semantic perturbation evaluation framework** that tests whether models truly understand language by modifying instructions in semantically meaningful ways. Our findings show critical gaps in language grounding across leading VLA architectures.

## Key Features

- **Semantic Perturbation Framework**: Systematic evaluation methodology for VLA language understanding
- **Multi-Task Same-Scene Training**: Proposed approach to improve language grounding
- **Augmented Dataset**: Constructed fine-tuning dataset for better instruction following
