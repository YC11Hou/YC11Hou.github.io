---
layout: page
title: Projects
permalink: /projects/
description: Research and engineering work, organised by degree stage.
nav: true
nav_order: 2
i18n: projects
eyebrow: 03 — Projects
pagenav: h2,h3
---

{% assign t = site.data.i18n.en %}

<!-- pages/projects.md -->
<div class="projects">
  {% comment %} ---------- Master's ---------- {% endcomment %}
  <section class="proj-stage" id="master">
    <header class="proj-stage-head">
      <h2 class="proj-stage-title" data-i18n="projects.master">{{ t.projects.master }}</h2>
      <span class="proj-stage-period mono">2025 — 2026</span>
    </header>

    <div class="proj-group">
      <h3 class="proj-group-title mono"><span data-i18n="projects.honor">{{ t.projects.honor }}</span> <span class="proj-group-note" data-i18n="projects.honor_note">{{ t.projects.honor_note }}</span></h3>
      {% assign honor_projects = site.projects | where: "org", "honor" | sort: "importance" %}
      {% for project in honor_projects %}
        {% include project_row.liquid %}
      {% endfor %}
    </div>

    <div class="proj-group">
      <h3 class="proj-group-title mono"><span data-i18n="projects.nus">{{ t.projects.nus }}</span> <span class="proj-group-note" data-i18n="projects.nus_note">{{ t.projects.nus_note }}</span></h3>
      {% assign nus_projects = site.projects | where: "org", "nus" | sort: "importance" %}
      {% for project in nus_projects %}
        {% include project_row.liquid %}
      {% endfor %}
    </div>

  </section>

{% comment %} ---------- Bachelor's ---------- {% endcomment %}
  <section class="proj-stage" id="bachelor">
    <header class="proj-stage-head">
      <h2 class="proj-stage-title" data-i18n="projects.bachelor">{{ t.projects.bachelor }}</h2>
      <span class="proj-stage-period mono">2021 — 2025</span>
    </header>

    <div class="proj-group">
      <h3 class="proj-group-title mono"><span data-i18n="projects.nuaa">{{ t.projects.nuaa }}</span> <span class="proj-group-note" data-i18n="projects.nuaa_note">{{ t.projects.nuaa_note }}</span></h3>
      {% assign nuaa_projects = site.projects | where: "org", "nuaa" | sort: "importance" %}
      {% for project in nuaa_projects %}
        {% include project_row.liquid %}
      {% endfor %}
    </div>

  </section>
</div>
