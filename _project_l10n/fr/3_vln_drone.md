---
lang: fr
project: 3_vln_drone
title: "Navigation vision-langage pour drone autonome"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Code : github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>Ce que j'ai fait · cliquez sur une carte pour y accéder</p>
  <ol>
    <li><a href="#pipeline"><strong>Pipeline de trajectoires</strong><span>A* sur réseau · décollage → croisière → atterrissage</span></a></li>
    <li><a href="#overview"><strong>Jeu de données</strong><span>90 scènes · plus de 10 000 trajectoires, en open source</span></a></li>
  </ol>
</nav>

## Démo

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/vln_highlights_poster.jpg">
      <source src="/assets/video/vln_highlights.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/vln_overview_poster.jpg">
      <source src="/assets/video/vln_overview.webm" type="video/webm">
    </video>
  </div>
</div>

<div class="media-row">
  <div>
    <img src="/assets/img/p3_3dvln.jpg" alt="Vue égocentrique pendant la génération de trajectoire">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Trajectoire en 3 étapes : décollage, croisière, atterrissage">
  </div>
</div>

## Vue d'ensemble {#overview}

Conception d'un pipeline robuste pour générer des trajectoires de navigation 3D variées dans le simulateur Habitat, afin d'entraîner des politiques de navigation vision-langage (VLN) pour des robots aériens.

**Motivation :** les jeux de données VLN existants concernent des robots terrestres sur des graphes de navigation discrets ; un drone a besoin de trajectoires 3D continues de décollage → croisière → atterrissage, et aucun jeu de données de ce type n'existait, nous l'avons donc construit de zéro.

**Simulateur :** Habitat, avec 90 scènes d'intérieur.

**Échelle :** 90 scènes × 200 à 300 paires départ-arrivée chacune → **plus de 10 000** trajectoires 3D en trois étapes avec instructions en langage naturel, publiées en open source sur GitHub.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Pipeline de génération en quatre étapes. L'A* sur réseau planifie sur des primitives de mouvement en (x, y, θ) : le drone tourne tout en avançant, au lieu des virages à angle droit de l'A* sur grille (schéma ci-dessous, à titre illustratif)." %}

1. **Génération des paires départ-arrivée** — Pour chacune des 90 scènes, générer 200 à 300 paires départ-arrivée 2D aléatoires comme points de départ et d'arrivée de la navigation.

2. **Planification du chemin de croisière 2D** — Déterminer une altitude de croisière constante adaptée à chaque scène, puis planifier à cette altitude un chemin 2D naturel avec **Lattice A\***. Contrairement à l'A\* sur grille classique, qui produit des virages rigides à angle droit, Lattice A\* planifie sur des primitives de mouvement dans l'espace d'états continu $$(x, y, \theta)$$ et produit des chemins lisses où l'agent tourne tout en avançant. Heuristique :

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Elle pénalise les virages serrés afin d'obtenir des trajectoires de vol lisses et réalistes.

3. **Assemblage de la trajectoire 3D** — Ajouter un segment de **décollage** au début et un segment d'**atterrissage** à la fin de chaque chemin de croisière pour former une trajectoire 3D complète. Collecter des observations RGB-D le long de tout le chemin sous forme de vidéo.

4. **Génération des instructions** — Utiliser un modèle vidéo-vers-texte pour produire des instructions de navigation en langage naturel à partir des vidéos d'observation collectées, ce qui donne un jeu de données VLN complet.

La conception est volontairement simplifiée — le drone ne change pas fréquemment d'altitude en cours de vol — mais le décollage et l'atterrissage combinés aux instructions sont déjà difficiles pour les modèles actuels. L'entraînement de politiques sur ce jeu de données est poursuivi par des collègues du laboratoire.
