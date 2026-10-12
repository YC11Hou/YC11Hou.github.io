---
lang: fr
project: 1_vla_benchmark
title: "LangGap : un benchmark de compréhension du langage pour les VLA"
source_hash: ceb66c896e84
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2603.00592" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2603.00592
  </a>
  <a href="/assets/pdf/LangGap-IROS2026-poster.pdf" target="_blank" rel="noopener">
    <i class="fa-solid fa-image"></i> Poster (IROS 2026)
  </a>
</p>

<nav class="contrib">
  <p>Ce que j'ai fait (premier auteur) · cliquez sur une carte pour y accéder</p>
  <ol>
    <li><a href="#benchmark"><strong>Conception du benchmark</strong><span>99 tâches · 4 dimensions de perturbation</span></a></li>
    <li><a href="#data"><strong>Collecte de données</strong><span>16 tâches × 150 démonstrations scriptées</span></a></li>
    <li><a href="#training"><strong>Entraînement du modèle</strong><span>π0.5 LoRA · tâche unique 0 % → 90 %</span></a></li>
    <li><a href="#results"><strong>Analyse des résultats</strong><span>93,8 % → 21,4 % · 4 modèles VLA</span></a></li>
  </ol>
</nav>

## Démo

<div class="media-row">
  <div class="ratio-16x9">
    <video controls preload="metadata" poster="/assets/img/langgap_video_poster.jpg">
      <source src="/assets/video/langgap_video.mp4" type="video/mp4">
    </video>
  </div>
  <div class="ratio-16x9">
    <video autoplay loop muted playsinline preload="metadata" poster="/assets/img/langgap_poster.jpg">
      <source src="/assets/video/grid_8x4.mp4" type="video/mp4">
    </video>
  </div>
</div>

## Aperçu

Les modèles vision-langage-action (VLA) dépassent 95 % de réussite sur les benchmarks usuels. Pourtant, nos expériences systématiques montrent que les VLA de pointe ignorent en grande partie les instructions en langage naturel. Les travaux antérieurs manquent de : (1) diagnostics systématiques par perturbation sémantique, (2) un benchmark qui impose par construction la compréhension du langage, et (3) données d'entraînement linguistiquement diversifiées. Cet article construit le benchmark LangGap, fondé sur une méthode de perturbation sémantique à quatre dimensions — on fait varier la sémantique de l'instruction en gardant fixe la disposition sur la table — qui met en évidence les lacunes de π0.5 en compréhension du langage. Les benchmarks existants comme LIBERO n'attribuent qu'une seule tâche par disposition, sous-exploitant les objets et les emplacements cibles disponibles ; LangGap diversifie pleinement les tâches de saisie et de dépose pour une même disposition, obligeant les modèles à comprendre réellement le langage. Les expériences montrent qu'un enrichissement ciblé des données peut réduire en partie cet écart : le taux de réussite passe de 0 % à 90 % en entraînement mono-tâche, et de 0 % à 28 % en entraînement multi-tâche. Toutefois, à mesure que la diversité sémantique des tâches étendues augmente, la capacité d'apprentissage du modèle se révèle largement insuffisante, et même les tâches vues à l'entraînement sont mal réussies. Cela révèle une difficulté fondamentale pour les VLA face à des instructions linguistiques variées — c'est précisément là que réside la valeur à long terme de LangGap.

## Détails

**1. Benchmark et jeu de données**
{: #benchmark}

Le benchmark LangGap compte **99 tâches** au total : 40 tâches LIBERO d'origine + 59 tâches étendues par perturbation sémantique. Nous fournissons un jeu d'entraînement de 56 tâches : 16 tâches étendues collectées par nos soins (150 démonstrations chacune) + 40 tâches d'origine (50 démonstrations chacune), soit environ 4 100 trajectoires.

**2. Découverte du problème**
{: #diagnosis}

Lorsque l'on change l'instruction de « put bowl on plate » → « put bowl on stove » dans la même scène visuelle, le modèle exécute toujours l'action d'origine (il va vers l'assiette) et obtient **0 % de réussite**. Cela montre que les VLA font de la mise en correspondance motif visuel → action plutôt que de comprendre réellement le langage.

Nous concevons un diagnostic par perturbation sémantique à quatre dimensions — Change Object, Change Target, Spatial Description et Drawer Action — en conservant une scène visuelle identique et en ne modifiant que l'instruction :

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnostic de π0.5 sur 99 tâches et 1 980 épisodes. Notre nouvelle exécution des 40 tâches d'origine retrouve le score officiel ; les 59 tâches étendues perdent 72,4 points. Sur Change Target, π0.5 échoue sur les 260 épisodes et aucun modèle testé ne dépasse 2,3 %, de sorte que l'échec ne tient pas à la formulation — et le score agrégé le masque." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="Suites d'évaluation LIBERO avec annotations des perturbations">
  </div>
</div>

**3. Principes de conception**
{: #design}

1. **Multi-tâche à scène identique** — Plusieurs tâches partagent le même état visuel initial, ce qui élimine les raccourcis visuels. Un modèle qui ignore le langage atteint au plus 1/k de réussite (k = nombre de tâches par scène).
2. **Partition entraînement/évaluation au niveau des instructions** — Les tâches d'entraînement ne couvrent pas toutes les tâches de test ; l'évaluation sur données exclues contient des instructions jamais vues afin de tester la généralisation compositionnelle.
3. **Validation de la faisabilité physique** — Toutes les tâches étendues sont vérifiées dans le simulateur LIBERO pour garantir qu'elles sont saisissables, atteignables et détectables.

**4. Chaîne de collecte des données**
{: #data}

- **Génération extensible et diversifiée :** Nous employons une chaîne de collecte scriptée, fondée sur des points de passage, pour recueillir efficacement et de façon stable 150 épisodes réussis par tâche. Si les points de passage sont codés en dur pour chaque tâche, le simulateur introduit de légères variations naturelles dans les dispositions initiales sur la table. Les trajectoires collectées sont ainsi diversifiées visuellement et dynamiquement, ce qui empêche les modèles de simplement mémoriser des trajectoires rigides et identiques.
- **Architecture de contrôle hiérarchique :** Chaque tâche utilise un script dédié qui décompose la saisie et la dépose en plusieurs points de passage successifs. Au niveau supérieur, nous appliquons un contrôle purement proportionnel (P) pour calculer les erreurs de position et produire des commandes d'action continues. Ces commandes sont ensuite exécutées par le contrôleur PD OSC (Operational Space Control) de bas niveau du simulateur, ce qui assure un contrôle continu fluide et très précis.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Séquence de points de passage d'une démonstration scriptée : origine, saisie, transport, dépose" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Chronologie des points de passage d'une démonstration scriptée (illustrative) : origine → au-dessus de l'objet → saisie → levage → au-dessus de la cible → dépose. Contrôleur OSC_POSE avec erreur de pose à chaque pas normalisée dans [−1, 1] ; un épisode n'est conservé que s'il réussit dans la limite du budget de pas.</p>

- **Pourquoi des scripts plutôt que la téléopération :** les premiers essais de téléopération à la souris étaient saccadés, lents et irréguliers. Les scripts, écrits à partir des coordonnées des objets dans le fichier BDDL de chaque tâche, ont été ajustés à la main en simulation jusqu'à ce que chaque tâche soit saisissable, atteignable et détectable — les actions obtenues sont propres et la collecte est entièrement automatique : ~150 démonstrations par tâche (contre 50 pour les tâches LIBERO officielles), soit 16 tâches ≈ 2 400 démonstrations.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Échantillon de déroulements de démonstrations scriptées" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Un échantillon des 2 400 démonstrations scriptées.</p>

**Fine-tuning : de 0 % à 90 % sur une tâche unique**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">À gauche : avant l'entraînement — l'instruction dit « stove », mais la politique pose quand même le bol sur l'assiette. À droite : après fine-tuning sur les données étendues — le bol est posé sur la cuisinière.</p>

- π0.5 avec LoRA (r = 64) sur une seule RTX 4090.
- Les checkpoints sont choisis d'après les déroulements, et non d'après la perte : la perte continue de diminuer alors que le taux de réussite n'est pas monotone.
- Les instructions d'entraînement et de test sont strictement identiques, à l'exception des 43 tâches exclues, dont les instructions sont nouvelles.

**5. Résultats**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Benchmark complet : modèles VLA récents sur les quatre suites LIBERO, tâches d'origine contre tâches étendues. Tous les modèles présentent un écart de langage important ; notre π0.5 fine-tuné sur 45 tâches améliore le total étendu (22,8) et Change Target (0 → 6,2) tout en conservant 89,5 sur les tâches d'origine. Les 43 tâches exclues n'ont jamais servi à l'entraînement." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Validation progressive avec les mêmes données étendues, le nombre de tâches d'entraînement passant de 1 à 56. La mémorisation d'une tâche unique atteint 90 %, mais les gains s'effondrent lorsque des tâches sémantiquement différentes sont apprises ensemble ; l'ajout des 40 tâches officielles (56 tâches) rétablit 27,5 %, alors que l'écart de langage demeure." %}

**6. Valeur à long terme**

À mesure que la diversité sémantique des tâches augmente, la capacité d'apprentissage du modèle se révèle largement insuffisante — même les tâches vues à l'entraînement sont mal réussies. Cela révèle une difficulté fondamentale, indépendante de l'architecture : tous les modèles testés (π0.5, π0, π0-FAST, SmolVLA) présentent le même écart de langage. LangGap fournit un outil de diagnostic systématique qui garde sa valeur à mesure que de nouvelles architectures VLA apparaissent, précisément parce que l'écart de langage est un problème persistant que les paradigmes d'entraînement actuels n'ont pas encore résolu.
