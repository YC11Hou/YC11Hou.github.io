---
lang: fr
project: 0_honor_internship
title: "Honor Humanoid : RL sur robot réel pour les VLA"
source_hash: b1ae248d5011
---

Travail sur le **robot humanoïde** développé en interne par Honor : collecte de données par téléopération, relecture, entraînement et déploiement sur le robot, ainsi que recherche en algorithmes de **RL sur robot réel** pour les modèles **Vision-Language-Action (VLA)** sur des tâches de manipulation sur mesure.

<nav class="contrib">
  <p>Ce que j'ai fait · cliquez sur une carte pour y accéder</p>
  <ol>
    <li><a href="#loop"><strong>Pipeline VLA de bout en bout</strong><span>Collecter → entraîner → déployer, laboratoire monté de zéro</span></a></li>
    <li><a href="#data-design"><strong>Conception des données hors ligne</strong><span>4 catégories : suivre + récupérer</span></a></li>
    <li><a href="#infra"><strong>Infrastructure d'entraînement avec reprise humaine</strong><span>Reprise · boucle Actor–Learner–Robot · nouvelle tâche ≈ 0 % → 50 %+</span></a></li>
    <li><a href="#algorithms"><strong>Algorithmes de RL sur robot réel</strong><span>RECAP · RAPID · loco-manipulation</span></a></li>
    <li><a href="#rove"><strong>Reproduction de ROVE</strong><span>Succès autonome 40 % → 52 %</span></a></li>
    <li><a href="#debugging"><strong>Débogage sur robot réel</strong><span>6 bugs, chacun trouvé par une sonde</span></a></li>
  </ol>
</nav>

## Démonstrations

### Inférence embarquée sous perturbations

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Déroulés autonomes de prise et dépose sur le robot réel, pendant que l'objet (à gauche) et le panier cible (à droite) sont déplacés en cours d'épisode : la politique se recale et mène la tâche à bien. La main ne s'arrête jamais et la politique n'attend pas que l'objet se stabilise : ce qu'elle a appris, c'est le suivi visuel et le rejet de perturbations, et non une trajectoire unique de prise et dépose.

### Conception des données pour la robustesse

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Quatre catégories de démonstrations téléopérées : démonstrations standard, perturbations pendant la phase de prise, perturbations pendant la phase de dépose, et récupération à partir d'états de saisie manquée, conçues pour que la politique apprenne à se rattraper et pas seulement à répéter.

### SFT sur robot réel : avant et après

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Une tâche que la politique entraînée hors ligne ne savait pas réaliser est apprise sur le robot grâce à la boucle d'apprentissage sur robot réel : les données de reprise humaine reviennent dans l'entraînement, et la proportion de reprises diminue à mesure que de nouveaux checkpoints sont déployés.

## 1. Pipeline VLA de bout en bout {#loop}

Le laboratoire de Shanghai a été monté de zéro après mon arrivée : configuration du robot, deux dispositifs de téléopération (Pico VR et capture de mouvement), formation des opérateurs de collecte de données, et pipeline d'entraînement. La tâche est une prise et dépose (bouteille → panier) avec une instruction unique et fixe.

{% include svg_figure.liquid name="honor_pipeline" caption="Pipeline de bout en bout sur robot réel. GR00T N1.7 (3B) est post-entraîné avec le backbone vision-langage gelé ; l'action de dimension 37 est sélectionnée dans un état robot de dimension 115. Il n'y a pas d'ensemble de validation : les checkpoints sont sauvegardés tous les 2K pas et choisis par des déroulés sur le robot ; la perte atteint un plateau après environ 15K pas." %}

{% include svg_figure.liquid name="honor_chunk" caption="Passage de relais entre chunks d'actions à l'inférence. Le chunk suivant est demandé alors qu'il reste 15 pas ; les actions devenues obsolètes pendant l'inférence sont écartées et le recouvrement est fondu linéairement, de sorte que le robot ne saccade pas d'un chunk à l'autre." %}

**Sur le robot**, la phase de dépose n'échoue presque jamais : la politique suit même lorsque le panier est tiré rapidement. Les échecs de prise sont corrélés à la position de l'objet ; l'origine est dans les données (posture fixe, aucun mouvement local pendant la collecte, donc le modèle ne se forme jamais une notion de distance), et non dans la précision du bras. Résultat : le laboratoire dispose d'une boucle d'itération interne « collecter → affiner → valider sur le robot » au lieu de dépendre de modèles livrés de l'extérieur.

## 2. Conception des données hors ligne {#data-design}

**Pourquoi quatre catégories de données.** Les catégories ①–③ (standard, perturbation en phase de prise, perturbation en phase de dépose) apprennent à la politique à _suivre_ un objet ou un conteneur en mouvement. La catégorie ④ lui apprend à _récupérer_ : à partir de la pose de survol juste après une saisie manquée, la démonstration abaisse la main, ressaisit et dépose. Sans elle, la politique ne s'aperçoit souvent pas que la saisie a échoué : elle soulève une main vide, se rend au panier et « dépose » le vide. Les quatre catégories sont à peu près équilibrées ; la robustesse visible dans la démonstration ci-dessus vient de cette conception des données, et non d'un réglage d'hyperparamètres.

## 3. Infrastructure d'entraînement sur robot réel avec reprise humaine {#infra}

### 3.1 Reprise humaine et pipeline de données piloté par les interventions {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Un téléopérateur reprend la main en cours d'épisode puis la rend (vitesse ×3, sans son).</p>

**Reprise humaine fluide.** Apprendre sur le robot réel exige qu'un humain puisse reprendre la main à tout instant sans que le robot ne sursaute. À la reprise, le topic de commande du VLA est redirigé vers le topic de téléopération, et le contrôleur sort un _incrément_ par rapport à la dernière action du VLA plutôt que les angles articulaires absolus du téléopérateur.

{% include svg_figure.liquid name="honor_fsm" caption="Machine à états de commutation et règle de sortie lors de la reprise. Les reprises sont aussi écrites dans les données, si bien que chaque épisode sait quelles images proviennent de l'humain." %}

**Pipeline de données piloté par les interventions.** Chaque épisode est persisté, et l'opérateur ne peut que corriger à la baisse le classifieur de succès, jamais promouvoir un échec en succès ; les décisions du classifieur et les statistiques de faux positifs/négatifs sont journalisées en parallèle. Le buffer est un anneau numpy borné avec des compartiments succès/échec, une suppression logique en FIFO et un échantillonnage pondéré (correction d'importance PER), et un point d'accès HTTP de relecture permet d'inspecter chaque épisode avant qu'il n'atteigne l'entraînement. Lors d'une autre campagne, 127 des 138 épisodes collectés sont entrés dans le buffer comme succès (11 entièrement autonomes, 116 avec démonstrations de reprise).

{% include svg_figure.liquid name="honor_datapipe" caption="Du robot au learner : chaque épisode, échecs compris, est enregistré, jugé et envoyé ; le learner classe les épisodes par résultat. En bas : composition d'une campagne de données sur robot réel (142–416 images par épisode)." %}

### 3.2 Boucle d'apprentissage distribuée sur robot réel {#online-loop}

**Reproduction de la boucle d'échantillonnage par rejet Hi-ORS, portée de π0 + bras Dobot vers GR00T N1.7 + humanoïde.** Trois machines fonctionnent simultanément.

{% include svg_figure.liquid name="honor_arch" caption="Architecture Actor–Learner–Robot. L'Actor exécute la politique sur le robot, seuls les épisodes réussis parviennent au Learner, et le Learner renvoie à l'Actor les poids entraînables tous les 1 000 pas." %}

{% include svg_figure.liquid name="honor_gates" caption="Verrous avant qu'un épisode n'entre dans l'entraînement. Le classifieur de succès est un ResNet18 sur une seule image de la caméra gauche avec une tête à un logit, entraîné avec BCE + pos_weight sur 572 épisodes (séparation au niveau de l'épisode, augmentation en ligne, étiquettes dérivées automatiquement des signaux de la pince ; F1 au niveau de l'image 0,976). Il ne se verrouille qu'après 20 images consécutives au-dessus de 0,8 ; cette hystérésis a été ajoutée après la première session sur robot réel, où le classifieur déclarait le succès en 1–2 s et où les faux positifs remplissaient le buffer. Des ancres de démonstrations de base dans chaque batch protègent contre l'oubli." %}

### 3.3 Résultats du SFT sur robot réel : une nouvelle tâche de ≈ 0 % à 50 %+ en ~140 épisodes {#results}

Lorsque la politique cale, l'opérateur reprend la main via Pico ; les données de reprise alimentent directement le Learner, et la proportion de reprises sert de métrique en direct. La **scène 1** déplace la bouteille vers la droite, là où les données hors ligne sont rares. La **scène 2** inverse toute la disposition gauche–droite (panier à gauche, bouteille à droite), exactement l'opposé de toutes les données hors ligne ; la référence SFT hors ligne y vaut donc ≈ 0 %.

{% include svg_figure.liquid name="honor_curve" caption="Part des pas téléopérés par épisode pendant le SFT sur robot réel, avec les checkpoints envoyés à l'Actor. Chaque mise à jour de checkpoint est suivie d'une baisse des reprises ; la hausse autour de l'épisode 86 correspond au passage à la scène 2. Sur la phase de test (checkpoints 5000–7000), la proportion de reprises tombe à 18,8 %." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Scène</th><th>Changement par rapport aux données hors ligne</th><th>Épisodes</th><th>SFT hors ligne</th><th>Après SFT sur robot réel</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Bouteille à droite (rare dans les données hors ligne)</td><td>20</td><td>non mesuré</td><td><strong>55,0 %</strong></td></tr>
    <tr><td>2</td><td>Panier à gauche, bouteille à droite (disposition en miroir)</td><td>12</td><td>≈ 0 %</td><td><strong>50,0 %</strong></td></tr>
  </tbody>
</table>
</div>

Taux de succès entièrement autonome. Pourquoi un backbone gelé peut tout de même apprendre la disposition en miroir : le mode d'échec était de _ne pas bouger du tout_ plutôt que de bouger dans le mauvais sens ; la compréhension visuelle était intacte, seule la correspondance vers les actions manquait.

## 4. Algorithmes de RL sur robot réel {#algorithms}

### 4.1 Entraînement conditionné par l'avantage, de type RECAP {#recap}

L'échantillonnage par rejet est un cas dégénéré binaire de l'avantage : garder tous les succès, écarter tous les échecs. **J'ai porté sur GR00T N1.7 l'étiquetage d'avantage de π0.6 RECAP (tel qu'implémenté dans RLinf)** afin d'utiliser _toutes_ les données, « bon vs. mauvais » devenant une condition d'entrée plutôt qu'un filtre : les épisodes d'échec deviennent des échantillons négatifs au lieu d'être gaspillés.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline de type RECAP. La pénalité d'échec c_fail = 1000 dépasse l'écart entre le plus long succès (1 000 images) et le plus court échec (57 images), de sorte que tout échec se classe sous tout succès. n = 20 pas correspond à l'horizon de 1 s de l'article à 20 Hz. Les négatifs ne façonnent que la branche CFG inconditionnelle." %}

{% include svg_figure.liquid name="honor_value_net" caption="Réseau de valeur. Le backbone GR00T reste gelé et ne reçoit aucun gradient ; les tokens d'image et de texte sont moyennés séparément car les premiers sont bien plus nombreux que les seconds, et une moyenne unique diluerait le conditionnement par le langage. RLinf ajoute un token CLS apprenable et une seule tête linéaire ; le backbone GR00T n'accepte aucun embedding d'entrée supplémentaire, nous moyennons donc et ajoutons une couche cachée. L'esquisse de la distribution d'atomes est indicative." %}

Tant que V n'est pas prêt, des étiquettes à base de règles servent de solution de repli : toutes les images de succès positives, les images autonomes des échecs négatives, et les 20 images précédant chaque reprise réécrites en négatif. Le réseau de valeur est entraîné séparément et n'est accepté que si le ρ de Spearman sur des épisodes mis de côté (un épisode sur dix) dépasse 0,55 : l'essai à blanc a atteint ρ = 0,647 (plateau 0,59) avec une perte de 4,52 → 0,76, tandis qu'un témoin à étiquettes permutées restait à un ρ absolu ≤ 0,26 et échouait au critère, ce qui prouve que le critère est pertinent. L'accord entre les étiquettes issues de V et celles à base de règles n'était que de 0,31 ; le réseau de valeur reste donc le goulot d'étranglement, et la comparaison A/B sur robot réel n'a pas été menée à terme.

### 4.2 RAPID : adaptation rapide dans l'espace du bruit {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), dans l'esprit de DSRL : l'entraînement d'un nouveau checkpoint prend du temps, et tant qu'il n'est pas livré le robot ne sait toujours pas faire la tâche. RAPID laisse les poids du VLA gelés et ne remplace que le bruit initial du flow matching, de sorte qu'une correction que l'humain vient d'effectuer puisse être réutilisée la prochaine fois qu'un état similaire se présente. Il a été branché sur l'inférence embarquée fin août.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Hors ligne, les corrections humaines sont inversées à travers la politique gelée jusqu'au bruit initial qui les reproduit (64 pas fins ; un Euler à 4 pas est trop grossier) et stockées dans une mémoire indexée par l'observation. Au déploiement, le bruit récupéré est interpolé sphériquement avec du bruit gaussien avant l'échantillonnage flow matching habituel." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="Réseau de bruit DSBC. Un petit MLP associe directement la clé de récupération au bruit initial, remplaçant la recherche du plus proche voisin ; le VLA lui-même reste gelé. H est l'horizon d'action de 40 pas de la tête d'action de GR00T (30 pas sont exécutés par inférence) ; D est la dimension de son action." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Validation hors ligne sur 24 épisodes de reprise d'une tâche de comptage. DSBC mène pour tout K (54,9–57,0) ; la récupération en mémoire n'atteint que 20 pour K = 1–2 et 45–49 pour K ≥ 4 ; le bruitage partiel reste plat à 37 ; memory_delta est inférieur à 8. La métrique est le gain DTW, et non le taux de succès sur robot réel." %}

L'audit a été **préenregistré** : audit PASS ; inversion CONDITIONAL (erreur de reconstruction 0,232, dans 0,10–0,30) ; dispersion rétrogradée à fragile après une nouvelle exécution ; transfert PASS (p ≈ 1e-21). Selon ces critères, l'affirmation « la récupération gagne pour K < 10 » a été **abandonnée** : le protocole expérimental a rejeté ma propre hypothèse. Le système a convergé vers DSBC comme voie principale, avec la récupération en mémoire comme étage amont optionnel. Les étapes suivantes étaient de distiller DSBC dans la politique, de retirer progressivement les entrées de la mémoire et de le relier au RL sur robot réel.

### 4.3 Extension à la loco-manipulation {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">L'humanoïde marche de façon autonome jusqu'à un comptoir et saisit une bouteille : 7 séquences sur robot réel, vitesse ×5, sans son ; les marques jaunes au sol sont des repères de trajet de marche.</p>

Toute la pile (reprise humaine, boucle d'apprentissage sur robot réel, RECAP et RAPID) est passée de la prise et dépose sur table à une tâche avec marche sans avoir à être réécrite.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Données de loco-manipulation</th><th>Valeur</th></tr></thead>
  <tbody>
    <tr><td>Épisodes de marche collectés</td><td>507 épisodes · 181K images</td></tr>
    <tr><td>Conservés après 6 critères de tri</td><td>326 épisodes</td></tr>
    <tr><td>Jeu d'entraînement fusionné</td><td><strong>848 épisodes · 306K images (+71 %)</strong></td></tr>
    <tr><td>Longueur médiane du trajet par épisode</td><td>0,32 m → <strong>3,2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Sur les métriques, en toute honnêteté :** l'étape de SFT sur robot réel dispose de chiffres complets (55 % / 50 %). Après le passage à la tâche de loco-manipulation, tous les composants ont été implémentés et branchés, mais aucune amélioration mesurable n'a été obtenue : la maturité du matériel corps entier et de la pile de locomotion à l'époque ne permettait pas une évaluation systématique sur robot réel.

## 5. Reproduction de ROVE {#rove}

**Tâche.** L'humanoïde se tient sur place (pieds fixes, sans marche) et saisit un téléphone avec la main : une manipulation fine où un léger désalignement conduit vite à une reprise humaine.

ROVE (XPENG, arXiv:2606.17011) conserve le squelette de conditionnement par l'avantage de RECAP (§4.1) et change la manière de noter les reprises humaines. Je l'ai reproduit au-dessus du pipeline RECAP derrière un unique commutateur d'algorithme (le chemin RECAP par défaut reste identique au bit près, vérifié par des auto-tests), et j'ai exécuté l'Algorithme 1 de l'article comme une boucle hors ligne : déployer et collecter → retours sensibles aux étapes → rafraîchissement de la valeur → avantages et étiquettes → SFT conditionnel. Seule la première étape nécessite le robot ; les quatre autres s'exécutent en une seule commande.

### 5.1 Retour sensible aux étapes {#rove-return}

Avec RECAP, un épisode sauvé par un humain compte toujours comme un succès : son retour augmente de un à chaque pas jusqu'à 0, si bien que les actions autonomes qui ont _provoqué_ la reprise ressemblent à une progression régulière. Le seul remède est une règle fixe qui étiquette négatives les 20 images précédant une reprise. ROVE découpe un tel épisode en trois segments (exécution autonome, adaptation, où l'humain ramène encore le robot sur la bonne voie, et récupération) et comptabilise une pénalité d'échec C_fail en t_r, la fin de l'adaptation. Le segment autonome qui a mené à la reprise est désormais noté au niveau de l'échec, tandis que la récupération conserve son retour habituel de temps restant.

{% include svg_figure.liquid name="honor_rove_return" caption="Retour sensible aux étapes (Éq. 2 de l'article) : −1 par pas, C_fail en t_r, images d'inactivité (l'opérateur change de mode) supprimées. t_r retombe à reprise + 40 images (2 s) lorsqu'il n'est pas annoté ; l'ablation de l'article perd 30 pp lorsque t_r est placé au début de la reprise, donc la valeur par défaut penche vers le tard. C_fail doit dépasser le plus long intervalle du pool positif, sinon un épisode échoué obtiendrait un meilleur score qu'une récupération : la borne inférieure mesurée sur ces données est 919, d'où C_fail = 1000 (le 500 de l'article est trop petit ici). Les retours coïncident au bit près avec le calcul manuel sur 38 épisodes archivés." %}

### 5.2 Estimation optimiste de la valeur (OVE) {#rove-ove}

La régression Monte-Carlo simple apprend le retour _moyen_. Dans les états qui finissent souvent par une reprise, la moyenne est déjà basse, de sorte que l'action ayant provoqué la reprise obtient un avantage proche de zéro et n'est jamais étiquetée négative. L'OVE affine la même tête de valeur scalaire, après un pré-entraînement MC, avec une cible TD à 16 pas (issue d'une copie EMA du réseau) et une perte par expectile avec τ = 0,7, qui pénalise davantage les sous-estimations que les surestimations. V estime alors ce que vaut un état _quand tout se passe bien_ : les états précédant une reprise sont valorisés haut, leur retour réel est bas, et l'avantage négatif retombe sur les actions qui ont provoqué la reprise. L'horizon d'avantage est lui aussi de 16 pas (un chunk d'actions, l'unité à laquelle l'étiquette est rattachée), et les 40 % d'images les mieux classées sont étiquetées positives.

Chaque checkpoint de valeur est validé par le ρ de Spearman sur des épisodes mis de côté : l'accord de rang entre V prédit et le retour réel (1 = même ordre). L'étape MC doit atteindre ρ ≥ 0,55 sur le pool complet ; l'étape OVE est jugée sur les seuls épisodes réussis (ρ ≥ 0,70), car l'OVE s'écarte par construction du retour moyen sur les états voués à l'échec, si bien qu'un ρ plus bas sur le pool complet est attendu et ne constitue pas une régression.

{% include svg_figure.liquid name="honor_rove_rho" caption="ρ de Spearman sur épisodes mis de côté dans trois entraînements de la valeur (zone grisée : phase OVE). Déroulés propres : le ρ sur l'ensemble des succès reste à 0,744–0,806 après le passage à l'OVE, tandis que le ρ sur le pool complet passe de 0,735 à 0,69 comme prévu ; le seuil de 0,70 a été fixé à partir de cet essai. Démos + déroulés : le ρ sur l'ensemble des succès glisse de 0,731 à 0,628 ; 85 % de l'ensemble mis de côté sont des démonstrations propres, et l'amorçage optimiste les pousse toutes vers le haut, ce qui comprime le classement. Pool iter0, démarré à chaud directement en OVE : ρ sur le pool complet 0,68–0,71, ρ sur l'ensemble des succès 0,63–0,67, sous le seuil. Les trois pools ont des ensembles mis de côté différents, donc les ρ ne sont pas comparables d'un panneau à l'autre." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Courbes de valeur sur un épisode de reprise mis de côté : retour réel, valeur MC et valeur OVE, avec les images à avantage négatif marquées" loading="lazy" width="1400" height="653">
  <figcaption>Reproduction de la Fig. 6 de l'article sur un épisode mis de côté comportant une reprise (x : image, images d'inactivité supprimées ; y : valeur normalisée). Avant t_r, la valeur OVE (bleu) se situe au-dessus de la valeur MC (orange), optimiste dans la distribution, puis bondit en t_r et suit le retour réel pendant la récupération. Les points rouges marquent les images à avantage OVE négatif : elles se concentrent avant la reprise et dans le segment d'adaptation.</figcaption>
</figure>

### 5.3 Résultats {#rove-results}

Le succès autonome sur le robot est passé de 40 % (checkpoint de base, n = 77) à **52 %** (ROVE iter0, n = 192) ; les succès assistés par l'humain sont passés de 45 % à 20 % des épisodes, tandis que les échecs sont passés de 14 % à 28 %.

{% include svg_figure.liquid name="honor_rove_robot" caption="Issue de chaque épisode enregistré sur robot réel, par checkpoint, telle que jugée par l'opérateur. Base 64000 : fin août – début septembre ; base 80000 : début – mi-septembre ; ROVE iter0 : 17–23 septembre." %}

L'iter0 a été entraîné avec un passage de la boucle hors ligne : un pool de valeur de 2 068 épisodes (534K images de démonstrations et de déroulés sur robot réel, 207 épisodes mis de côté), des étiquettes à exactement 40,0 % de positifs, et un SFT conditionnel depuis le checkpoint de base à 80K pas pendant 8 000 pas (lr 1e-4) sur un GPU H20 en 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Perte du SFT conditionnel iter0. La moyenne sur 200 pas passe de 0,54 à 0,047 au pas 1 000 puis à 0,025 au pas 8 000." %}

**Sur les métriques, en toute honnêteté :** les trois groupes proviennent de jours, d'opérateurs et de jeux de prompts différents ; il s'agit donc d'une observation et non d'un test A/B : l'évaluation entrelacée face au checkpoint de base et à un bras RECAP reste à faire. La collecte iter0 n'a en outre enregistré aucun segment de reprise, de sorte que la campagne suivante n'aura pas le signal central de ROVE tant que cette journalisation ne sera pas corrigée.

## 6. Débogage sur robot réel {#debugging}

Aucun de ces problèmes n'aurait pu être trouvé en relisant le code hors ligne : ils ne sont apparus que lors de longues exécutions sur robot réel, et chacun a été localisé grâce à une sonde ou à une métrique quantitative.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Symptôme</th><th>Sonde / preuve</th><th>Cause racine → correctif</th></tr></thead>
  <tbody>
    <tr><td>Généralisation qui se dégrade après l'affinage</td><td>Perte sur ensemble mis de côté 0,0048 → 0,0222 au pas 2000 (×4,6) ; cosinus de direction d'action 0,995 → 0,979 → 0,961</td><td>Le mélangeur de données de base lisait les mp4 en BGR alors que le tour de vision gelé attend du RGB : la moitié du budget de gradient apprenait du bruit ; corrigé en changeant une valeur par défaut. Les ancres ne couvraient que 29 épisodes (5,6 %) → agrandir le buffer de base</td></tr>
    <tr><td>Buffer rempli de faux succès</td><td>Des épisodes ont verrouillé « succès » après 24 et 29 pas ; le learner s'est entraîné dessus pendant plus de 1 000 pas</td><td>Le verrouillage et la réinitialisation partageaient un même seuil de 0,5, sans hystérésis → verrouillage à p &gt; 0,8 × 20 images, réinitialisation à p ≤ 0,3 × 3 images. Plus tard, un objet non réinitialisé a produit 2 536 pas inutiles sur 11 épisodes, juste au-delà du seuil d'entraînement de 2 500 pas : auditer image par image dès la première session</td></tr>
    <tr><td>Comportement différent entre entraînement, déploiement et RL</td><td>Comparaison champ par champ des observations entre les trois pipelines</td><td>Type DDS de la pince, caméra à l'envers, initialisation de la position de la main, indexation de la position de la tête → liste de 9 correctifs</td></tr>
    <tr><td>Le robot tourne au début de l'épisode</td><td>Dérive médiane de lacet de 31°</td><td>Ancre de lacet périmée + réancrage complet à chaque chunk → limitation de débit à 3°/chunk avec un plafond de 20° ; 6 exécutions de validation : erreur d'ancrage 0,0°, rotation durant la première seconde ≤ 1,6°</td></tr>
    <tr><td>Images de caméra périmées</td><td>47 % d'images consécutives dupliquées dans 77 épisodes sur 83 ; source 61 Hz, décodage 54,9 Hz, effectif ≈ 10,6 Hz sous charge</td><td>Ajout d'une observabilité de la fraîcheur des images</td></tr>
    <tr><td>« Le modèle ne bouge pas »</td><td>Client d'entraînement bloqué dans des tentatives répétées</td><td>Ports actor / learner non concordants. Leçon : chaque « le modèle ne bouge pas » est d'abord une vérification de communication ou d'observation, puis une vérification des poids</td></tr>
  </tbody>
</table>
</div>
