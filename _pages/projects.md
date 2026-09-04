---
layout: page
title: Projects
permalink: /projects/
description: Research and engineering work, organised by degree stage.
nav: true
nav_order: 2
eyebrow: 03 — Projects
---

<!-- pages/projects.md -->
<div class="projects">
  {% comment %} ---------- Master's ---------- {% endcomment %}
  <section class="proj-stage" id="master">
    <header class="proj-stage-head">
      <h2 class="proj-stage-title">Master's</h2>
      <span class="proj-stage-period mono">2025 — present</span>
    </header>

    <div class="proj-group">
      <h3 class="proj-group-title mono">Honor Device Co., Ltd. <span class="proj-group-note">Summer internship · Shanghai</span></h3>
      {% assign honor_projects = site.projects | where: "org", "honor" | sort: "importance" %}
      {% for project in honor_projects %}
        {% include project_row.liquid %}
      {% endfor %}
    </div>
    <div class="proj-group">
      <h3 class="proj-group-title mono">National University of Singapore <span class="proj-group-note">Research · NUS CORE Lab</span></h3>
      {% assign nus_projects = site.projects | where: "org", "nus" | sort: "importance" %}
      {% for project in nus_projects %}
        {% include project_row.liquid %}
      {% endfor %}
    </div>

  </section>

  {% comment %} ---------- Bachelor's ---------- {% endcomment %}
  <section class="proj-stage" id="bachelor">
    <header class="proj-stage-head">
      <h2 class="proj-stage-title">Bachelor's</h2>
      <span class="proj-stage-period mono">2021 — 2025</span>
    </header>

    <div class="proj-group">
      <h3 class="proj-group-title mono">Nanjing University of Aeronautics and Astronautics <span class="proj-group-note">Electronic & Communication Engineering</span></h3>
      {% assign nuaa_projects = site.projects | where: "org", "nuaa" | sort: "importance" %}
      {% for project in nuaa_projects %}
        {% include project_row.liquid %}
      {% endfor %}
    </div>
  </section>
</div>
