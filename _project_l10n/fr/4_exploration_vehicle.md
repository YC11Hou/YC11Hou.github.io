---
lang: fr
project: 4_exploration_vehicle
title: "Véhicule d'exploration autonome par frontières"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>Ce que j'ai fait (mémoire de licence, chef d'équipe) · cliquez sur une carte pour y accéder</p>
  <ol>
    <li><a href="#architecture"><strong>Architecture du système</strong><span>3 couches · 2 modes de tâche</span></a></li>
    <li><a href="#hardware"><strong>Intégration matérielle</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Localisation des victimes</strong><span>Masque YOLOv11 + profondeur → carte</span></a></li>
    <li><a href="#odometry"><strong>Pont d'odométrie SLAM</strong><span>TF Cartographer → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Exploration par frontières</strong><span>Gain d'information vs. coût de déplacement</span></a></li>
    <li><a href="#experiments"><strong>Expériences de terrain</strong><span>3 sites × 3 vitesses × 3 essais</span></a></li>
  </ol>
</nav>

## Démo

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

## Vue d'ensemble

La recherche et le sauvetage après une catastrophe est une course contre la montre, et les débris, la chaleur ou les radiations rendent souvent le site trop dangereux pour que des personnes y entrent en premier. Ce projet construit un petit robot à chenilles qui s'y engage avant elles : il explore seul un espace intérieur inconnu, construit la carte au fil de son déplacement et marque sur cette carte chaque personne trouvée, afin que les secouristes sachent où aller avant d'y pénétrer.

Tout s'exécute à bord sous ROS 2 : **Cartographer** pour le SLAM, **Navigation2** pour la planification et le contrôle, **YOLOv11** avec une caméra de profondeur pour repérer les victimes, et mon nœud d'**exploration par frontières** qui décide de la destination suivante.

## 1. Architecture du système et modes de tâche {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Architecture du système. Le Jetson (hôte) exécute toute la pile ROS 2 et communique avec les capteurs par USB ; le STM32 (esclave) pilote les moteurs et lit l'IMU via IIC, et les deux cartes communiquent par UART." %}

Le robot fonctionne selon deux modes. En **mode exploration**, il cartographie un bâtiment inconnu et enregistre les victimes au passage ; en **mode sauvetage**, il recharge cette carte et se rend tour à tour auprès de chaque victime enregistrée.

{% include svg_figure.liquid name="vehicle_modes" caption="Déroulement des deux modes. L'exploration répète carte → frontière → navigation jusqu'à ce qu'il ne reste plus de frontière utile, tandis que la détection des victimes tourne en parallèle ; le sauvetage se localise sur la carte enregistrée avec AMCL et rejoint une à une les positions de victimes stockées." %}

## 2. Intégration matérielle {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="La plateforme robotique à chenilles avec un LiDAR au sommet et une caméra de profondeur à l'avant" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>La plateforme : un châssis à chenilles portant le Jetson, un LiDAR 2D au sommet et une caméra RGB-D à l'avant.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Composant</th><th>Rôle</th><th>Spécification clé</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Ordinateur embarqué, exécute tout ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>LiDAR 2D pour le SLAM et les costmaps</td><td>ToF · portée 0,05–12 m · balayage 8–12 Hz</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>Caméra RGB-D pour la détection des victimes</td><td>Profondeur 0,6–8 m · jusqu'à 640×480 @ 30 fps · champ RGB 66,01° × 40,2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Contrôle moteur et IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>Moteurs CC MG513</strong></td><td>Entraînement à chenilles</td><td>Jusqu'à 1,1 m/s · charge utile 3 kg</td></tr>
  </tbody>
</table>
</div>

## 3. Détection des victimes et localisation 3D {#localization}

Une boîte englobante ne suffit pas pour placer une personne sur une carte : ses coins tombent sur le sol et sur le mur derrière, si bien que la profondeur qu'elle contient est surtout celle de l'arrière-plan. Le détecteur utilise donc la **segmentation YOLOv11**, et seuls les pixels de profondeur situés dans le masque de la personne sont retenus.

{% include svg_figure.liquid name="vehicle_localize" caption="Localisation des victimes. Le masque de segmentation sélectionne les pixels de la personne dans l'image de profondeur alignée ; un filtre médian supprime le bruit et les valeurs aberrantes, et la moyenne du reste donne la distance d_tar. La position horizontale du centre du masque donne le relèvement θ_off, et la pose du robot issue de l'odométrie reporte le point du repère caméra dans la carte." %}

Avec $$x_{cen}$$ le centre horizontal du masque, $$W_{img}$$ la largeur de l'image et $$\theta_{FOV}$$ le champ de vision horizontal de la caméra :

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Chaque position est enregistrée avec la carte ; ce sont les objectifs que le mode sauvetage rejoint ensuite.

## 4. Pont d'odométrie SLAM {#odometry}

Cartographer fournit la pose du robot sous forme de transformations TF, alors que les nœuds de navigation et de localisation attendent un flux `nav_msgs/Odometry` avec les vitesses. Un petit nœud pont convertit l'un en l'autre :

1. Rechercher `map → odom` et `odom → base_link` et composer la pose du robot, $$T_{mb} = T_{mo} \cdot T_{ob}$$, ce qui donne la position $$p = [x, y, z]^T$$ et le quaternion d'orientation $$q$$.
2. Convertir $$q$$ en roulis, tangage et lacet.
3. Dériver dans le temps : $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, et la vitesse de lacet à partir de la différence de lacet ramenée dans l'intervalle.
4. Publier `/odometry/filtered` avec la pose, le twist et la covariance.

## 5. Exploration par frontières optimisée {#frontier}

L'exploration classique par frontières se dirige vers la frontière la plus proche, ce qui fait perdre du temps dans de minuscules poches et oblige à revenir sur ses pas à travers la carte. Mon nœud évalue chaque frontière en comparant **la quantité d'espace inconnu qu'elle révélerait** à **la distance que le robot doit parcourir** pour l'atteindre :

1. **Prétraitement** — s'abonner à la grille d'occupation de Cartographer et la remettre en forme de tableau 2D.
2. **Détection des frontières** — appliquer la détection de contours de Canny à la limite entre l'espace libre connu et l'espace inconnu.
3. **Décision** — choisir la frontière offrant le meilleur compromis gain–coût et l'envoyer à Nav2 comme prochain objectif.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ compte les cellules inconnues pondérées dans un rayon $$r$$ autour de la frontière $$f$$ ; $$D_f$$ est la longueur du chemin depuis la position $$p$$ du robot ; $$w_1, w_2$$ règlent le compromis.

{% include svg_figure.liquid name="vehicle_loop" caption="Boucle d'exploration. Toutes les 2 s, la carte est reconstruite et les frontières sont extraites le long de la limite de l'espace libre connu ; la frontière au meilleur score gain d'information / coût de déplacement devient le prochain objectif Nav2, et les scores sont mis à jour à mesure que la carte s'étend — une exploration régulière sans trajets redondants." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Carte de visualisation des frontières : frontières, robot, frontière choisie et victimes localisées" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="Vue RViz du même instant avec la carte Cartographer et la costmap Nav2" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>Le même instant d'un essai en deux vues. À gauche, la carte des frontières : les lignes rouges sont les frontières, le point bleu foncé est le robot, le point vert est la frontière choisie et les points orange sont les victimes localisées. À droite, RViz avec la carte de Cartographer et la costmap gonflée de Nav2.</figcaption>
</figure>

## 6. Expériences de terrain {#experiments}

Un vrai sauvetage se déroule dans un espace vaste et complexe, sous pression temporelle ; le test pose donc une question simple : **quelle surface le robot parcourt-il en cinq minutes ?** Il a été mené dans trois environnements intérieurs aux agencements différents, sous trois limites de vitesse, avec trois essais chacune — soit 27 essais au total.

{% include svg_figure.liquid name="vehicle_sites" caption="Les trois sites de test (en haut) et une carte construite en cinq minutes à chaque limite de vitesse. Les cartes ne montrent que la forme et ne sont pas à une échelle commune. Le blanc est l'espace libre exploré, le gris l'inconnu, le noir les obstacles et les lignes rouges les frontières ; les points orange sont les victimes localisées, le point bleu est le robot et le point vert la prochaine frontière." %}

{% include svg_figure.liquid name="vehicle_area" caption="Surface explorée en cinq minutes. Chaque environnement réagit différemment à une limite de vitesse plus élevée." %}

**Ce que disent les chiffres.** La meilleure limite de vitesse dépend de l'agencement. Dans le **long couloir dégagé de la zone d'enseignement**, un robot plus rapide couvre simplement plus de terrain. Dans le **couloir étroit du dortoir**, les virages et les passages serrés plafonnent le gain dès que la limite dépasse 0,6 m/s. Dans le **laboratoire encombré**, 0,9 m/s n'explore pas plus que 0,6 m/s. Une limite de vitesse unique, réglée à la main, est donc un compromis.

## 7. Enseignements

Simple selon les standards actuels, mais une boucle complète sur robot réel, assemblée à partir de pièces individuelles — capteurs, contrôle embarqué, SLAM, navigation, perception et prise de décision — et les compétences de déploiement utilisées dans chaque projet ultérieur ont commencé ici.

Les expériences ont aussi indiqué la suite. Le mémoire proposait deux pistes : régler en ligne des paramètres d'exploration comme la limite de vitesse par RL sans modèle plutôt qu'à la main, et remplacer la pile modulaire basée sur le LiDAR par du RL de bout en bout fondé sur un modèle, à partir de la seule vision. La navigation par apprentissage est la ligne que mes recherches ultérieures ont suivie.
