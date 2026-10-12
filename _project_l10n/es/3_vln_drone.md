---
lang: es
project: 3_vln_drone
title: "Navegación visión-lenguaje en un dron autónomo"
source_hash: a77378003039
---

<p class="project-links">
  <a href="https://github.com/YC11Hou/habitat-aerial-nav" target="_blank" rel="noopener">
    <i class="fab fa-github"></i> Código: github.com/YC11Hou/habitat-aerial-nav
  </a>
</p>

<nav class="contrib">
  <p>Lo que hice · haz clic en una tarjeta para ir a la sección</p>
  <ol>
    <li><a href="#pipeline"><strong>Pipeline de trayectorias</strong><span>Lattice A* · despegue → crucero → aterrizaje</span></a></li>
    <li><a href="#overview"><strong>Conjunto de datos</strong><span>90 escenas · más de 10 000 trayectorias, de código abierto</span></a></li>
  </ol>
</nav>

## Demostración

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
    <img src="/assets/img/p3_3dvln.jpg" alt="Vista egocéntrica durante la generación de trayectorias">
  </div>
  <div>
    <img src="/assets/img/p3_3stage_traj.jpg" alt="Trayectoria en 3 etapas: despegue, crucero y aterrizaje">
  </div>
</div>

## Resumen {#overview}

Construí un pipeline robusto para generar trayectorias de navegación 3D diversas en el simulador Habitat, con el fin de entrenar políticas de navegación visión-lenguaje (VLN) en robots aéreos.

**Motivación:** los conjuntos de datos de VLN existentes están pensados para robots terrestres sobre grafos de navegación discretos; los drones necesitan trayectorias 3D continuas de despegue → crucero → aterrizaje, y no existía ningún conjunto de datos así, por lo que lo construimos desde cero.

**Simulador:** Habitat con 90 escenas de interior.

**Escala:** 90 escenas × 200–300 pares inicio-destino cada una → **más de 10 000** trayectorias 3D de tres etapas con instrucciones en lenguaje natural, de código abierto en GitHub.

## Pipeline {#pipeline}

{% include svg_figure.liquid name="vln_pipeline" caption="Pipeline de generación en cuatro pasos. Lattice A* planifica sobre primitivas de movimiento en (x, y, θ), de modo que el dron gira mientras avanza en lugar de hacer los giros en ángulo recto de Grid A* (esquema inferior, ilustrativo)." %}

1. **Generación de pares inicio-destino** — Para cada una de las 90 escenas, se generan entre 200 y 300 pares aleatorios de inicio y destino en 2D como puntos extremos de navegación.

2. **Planificación de la ruta de crucero en 2D** — Se determina una altitud de crucero constante adecuada para cada escena y, a esa altitud, se planifica una ruta 2D natural con **Lattice A\***. A diferencia del Grid A\* estándar, que produce giros rígidos en ángulo recto, Lattice A\* planifica sobre primitivas de movimiento en un espacio de estados continuo $$(x, y, \theta)$$ y genera rutas suaves en las que el agente gira mientras avanza. Heurística:

   $$H(s) = \frac{\|p - p_{goal}\|}{L} + \lambda \cdot |\Delta\theta|$$

   Esto penaliza los giros bruscos para obtener trayectorias de vuelo suaves y realistas.

3. **Ensamblaje de la trayectoria 3D** — Se antepone un segmento de **despegue** y se añade un segmento de **aterrizaje** a cada ruta de crucero, formando una trayectoria 3D completa. Se recogen observaciones RGB-D a lo largo de todo el recorrido en forma de vídeo.

4. **Generación de instrucciones** — Se utiliza un modelo de vídeo a texto para generar instrucciones de navegación en lenguaje natural a partir de los vídeos de observación recopilados, lo que da lugar a un conjunto de datos de VLN completo.

El diseño es deliberadamente simple (el dron no cambia de altitud con frecuencia durante el vuelo), y aun así el despegue y el aterrizaje combinados con instrucciones ya resultan difíciles para los modelos actuales. El entrenamiento de políticas sobre el conjunto de datos lo llevan a cabo compañeros del laboratorio.
