---
lang: fr
project: 2_objectnav_drone
title: "AION : navigation aérienne en intérieur vers un objet cible"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>Ce que j'ai fait (deuxième auteur) · cliquez sur une carte pour y accéder</p>
  <ol>
    <li><a href="#framework"><strong>Cadre à double politique</strong><span>Explorer lorsque la cible est hors du champ de vision</span></a></li>
    <li><a href="#exploration"><strong>Politique d'exploration</strong><span>Indice de région ouverte en profondeur + récompenses</span></a></li>
    <li><a href="#evaluation"><strong>Évaluation</strong><span>AI2-THOR + IsaacSim multi-pièces</span></a></li>
  </ol>
</nav>

## Démo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Aperçu

La navigation vers un objet cible (ObjectNav) exige qu'un agent explore de manière autonome un environnement inconnu et se dirige vers des objets cibles désignés par une étiquette sémantique. Alors que les travaux antérieurs ont surtout étudié l'ObjectNav zero-shot en locomotion 2D, son extension aux plateformes aériennes, capables de locomotion 3D, reste peu explorée. Les robots aériens offrent une meilleure maniabilité et une recherche plus efficace, mais ils soulèvent aussi de nouveaux défis en matière de perception spatiale, de contrôle dynamique et de garanties de sécurité. Dans cet article, nous proposons AION pour l'ObjectNav aérienne par la vision, sans localisation externe ni cartes globales. AION est un cadre d'apprentissage par renforcement (RL) de bout en bout à double politique, qui sépare les comportements d'exploration et d'atteinte de l'objectif en deux politiques spécialisées. Nous évaluons AION sur le benchmark AI2-THOR, puis mesurons ses performances en temps réel dans IsaacSim avec des modèles de drones haute fidélité. Les résultats expérimentaux montrent qu'AION obtient de meilleures performances sur l'ensemble des métriques d'exploration, d'efficacité de navigation et de sécurité.

## Détails

**1. Tâche**

Navigation en intérieur vers un objet cible pour drones avec **locomotion 3D** : le drone doit explorer de manière autonome un environnement inconnu et rejoindre un objet cible désigné par une étiquette sémantique (par ex. « laptop », « microwave »), sans carte préalable ni localisation externe.

**Mon rôle :** j'ai conçu, entraîné et validé la politique d'exploration.

**Pourquoi deux politiques :** les travaux antérieurs utilisent une seule politique d'atteinte de l'objectif (LSTM + alignement texte–vision CLIP). Cela suffit dans AI2-THOR, où les pièces sont petites et où la cible est généralement visible après un seul demi-tour ; mais lorsque la cible se trouve dans une autre pièce, CLIP n'a rien à aligner et l'agent tourne sur place. Nous séparons donc le comportement selon que la cible est visible ou non, l'étendons au mouvement 3D pour les drones, et passons de pièces isolées à des environnements multi-pièces.

**2. Cadre**
{: #framework}

Un cadre RL à double politique qui bascule entre deux modes selon la visibilité de la cible :

- **Mode exploration** — maximiser la couverture spatiale dans l'espace inconnu
- **Mode atteinte de l'objectif** — asservissement visuel vers l'objet cible détecté

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="Architecture à double politique d'AION">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Extraction de la ROI à partir de la profondeur">
  </div>
</div>

**3. Mode exploration**
{: #exploration}

**Entrée :**
Carte de profondeur + ROI (région d'intérêt). La ROI identifie les zones ouvertes et navigables dans l'image de profondeur, à l'image de l'instinct humain qui pousse à regarder vers les espaces dégagés pour se déplacer. La ROI est extraite par des méthodes basées sur OpenCV et fournit un indice directionnel (position du centroïde $$(d_x, d_y)$$ et profondeur moyenne $$\bar{z}$$), plutôt qu'une information absolue sur l'espace inconnu.

**Récompenses :**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$ : récompense pour se déplacer vers l'espace ouvert
- $$R_{center}$$ : pénalité pour l'écart de lacet par rapport au centroïde de la ROI
- $$R_{safe}$$ : pénalité de collision / de proximité d'un obstacle
- plus un bonus de surface couverte

Fournir directement du RGB-D brut à un LSTM ne produit pas de comportement d'exploration ; c'est l'indice de ROI qui donne à la politique récurrente un fort sens de la direction, sans odométrie ni carte. À notre connaissance, il s'agit de la première politique d'exploration purement visuelle et sans carte pour les robots aériens.

**4. Mode atteinte de l'objectif**

**Entrée :**
Image RGB + embedding textuel CLIP figé (aligne les caractéristiques textuelles et visuelles pour la reconnaissance d'objets zero-shot) + boîte englobante de l'objet / de la classe.

**Récompenses :**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$ : récompense pour la réduction de la distance euclidienne à la cible
- $$R_{bbox}$$ : récompense pour le centrage et l'agrandissement de la boîte englobante de la cible dans le champ de vision (signe que l'on s'approche de l'objet)
- $$R_{parent}$$ : récompense de classe parente — par ex. atteindre un bureau rapporte une récompense partielle si la cible est un laptop posé dessus
- $$R_{suc}$$ : récompense de réussite de la tâche
- $$R_{collision}$$ : pénalité de collision

**5. Espace d'actions**

Actions **3D** discrètes — avancer, tourner à gauche/droite, monter, descendre, etc.

**6. Évaluation**
{: #evaluation}

Évaluation sur deux simulateurs : AI2-THOR (benchmark standard avec des splits d'objets vus/non vus) et IsaacSim (environnements multi-pièces plus vastes où la cible peut se trouver dans une autre pièce).

Les pièces isolées d'AI2-THOR ne permettent pas de tester l'exploration — la cible est souvent visible dès le départ — nous avons donc construit une évaluation multi-pièces dans IsaacSim (Chemistry Lab, Beechwood, Ihlen) avec des cibles placées dans des pièces non visibles au départ. Les méthodes dotées uniquement d'une politique d'atteinte de l'objectif tournent sur place ; avec la politique d'exploration, le drone se dirige vers l'espace ouvert et trouve la cible à travers les pièces.

{% include svg_figure.liquid name="aion_thor" caption="Benchmark AI2-THOR sur deux splits d'objets. AION est en tête sur toutes les métriques des deux splits ; sur le split non vu 18/4, il dépasse MJO de 4,3 points en SR et de 3,5 en SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="Évaluation inter-scènes dans IsaacSim sur trois scènes multi-pièces avec des modèles de drones haute fidélité. Chaque point correspond à un essai (cinq par objet et par scène) ; AION réussit 52 essais sur 60, contre 40 et 35 pour l'exploration combinée à MJO et à SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="Scènes IsaacSim et objets cibles">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Trajectoires d'exploration dans Beechwood">
  </div>
</div>
