---
layout: page
permalink: /repositories/
title: repositories
description: My GitHub profile and repositories.
nav: false
---

<div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
  {% for user in site.data.repositories.github_users %}
    {% include repository/repo_user.liquid username=user %}
  {% endfor %}
</div>

---

## Repositories

<div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
  {% for repo in site.data.repositories.github_repos %}
    {% include repository/repo.liquid repository=repo %}
  {% endfor %}
</div>

<p style="text-align: center; color: gray; margin-top: 2rem;">More repositories with open-source code from my research projects coming soon.</p>
