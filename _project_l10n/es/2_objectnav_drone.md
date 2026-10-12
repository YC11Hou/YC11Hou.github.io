---
lang: es
project: 2_objectnav_drone
title: "AION: navegación aérea en interiores hacia objetos objetivo"
source_hash: 2dc0fa747eda
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2601.15614" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2601.15614
  </a>
</p>

<nav class="contrib">
  <p>Lo que hice (segundo autor) · haz clic en una tarjeta para saltar</p>
  <ol>
    <li><a href="#framework"><strong>Marco de doble política</strong><span>Explorar cuando el objetivo no está a la vista</span></a></li>
    <li><a href="#exploration"><strong>Política de exploración</strong><span>Indicio de región abierta en profundidad + recompensas</span></a></li>
    <li><a href="#evaluation"><strong>Evaluación</strong><span>AI2-THOR + IsaacSim con varias habitaciones</span></a></li>
  </ol>
</nav>

## Demo

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/img/aion_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/aion_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

## Resumen

La navegación hacia objetos objetivo (ObjectNav) exige que un agente explore de forma autónoma un entorno desconocido y se dirija hacia objetos indicados mediante una etiqueta semántica. Aunque los trabajos previos han estudiado sobre todo ObjectNav zero-shot con locomoción 2D, extenderlo a plataformas aéreas con locomoción 3D sigue estando poco explorado. Los robots aéreos ofrecen mayor maniobrabilidad y eficiencia de búsqueda, pero también plantean nuevos retos de percepción espacial, control dinámico y garantía de seguridad. En este artículo proponemos AION, un método de ObjectNav aéreo basado en visión que no depende de localización externa ni de mapas globales. AION es un marco de aprendizaje por refuerzo (RL) de doble política, de extremo a extremo, que separa los comportamientos de exploración y de llegada al objetivo en dos políticas especializadas. Evaluamos AION en el benchmark AI2-THOR y, además, analizamos su rendimiento en tiempo real en IsaacSim con modelos de dron de alta fidelidad. Los resultados experimentales muestran que AION logra un rendimiento superior en métricas integrales de exploración, eficiencia de navegación y seguridad.

## Detalles

**1. Tarea**

Navegación en interiores hacia objetos objetivo para UAV con **locomoción 3D**: el dron debe explorar de forma autónoma un entorno desconocido y dirigirse hacia un objeto indicado mediante una etiqueta semántica (p. ej., "laptop", "microwave"), sin mapa previo ni localización externa.

**Mi papel:** diseñé, entrené y validé la política de exploración.

**Por qué dos políticas:** los trabajos previos usan una única política de llegada al objetivo (LSTM + alineación texto–visión con CLIP). Es suficiente en AI2-THOR, donde las habitaciones son pequeñas y el objetivo suele verse tras un solo giro; pero cuando el objetivo está en otra habitación, CLIP no tiene nada con lo que alinear y el agente gira sobre sí mismo. Por ello separamos el comportamiento según si el objetivo está a la vista, lo extendemos al movimiento 3D para drones y pasamos de habitaciones individuales a entornos con varias habitaciones.

**2. Marco**
{: #framework}

Un marco de RL de doble política que alterna entre dos modos según la visibilidad del objetivo:

- **Modo de exploración** — maximizar la cobertura espacial en espacio desconocido
- **Modo de llegada al objetivo** — control visual (visual servoing) hacia el objeto objetivo detectado

<div class="media-row">
  <div>
    <img src="/assets/img/p2_model_arch.jpg" alt="Arquitectura de doble política de AION">
  </div>
  <div>
    <img src="/assets/img/p2_visual_input.jpg" alt="Extracción de ROI basada en profundidad">
  </div>
</div>

**3. Modo de exploración**
{: #exploration}

**Entrada:**
Mapa de profundidad + ROI (región de interés). La ROI identifica las zonas abiertas y transitables de la imagen de profundidad, imitando cómo los humanos miran instintivamente hacia los espacios abiertos al desplazarse. La ROI se extrae con métodos basados en OpenCV y aporta un indicio direccional (posición del centroide $$(d_x, d_y)$$ y profundidad media $$\bar{z}$$), en lugar de información absoluta sobre el espacio desconocido.

**Recompensas:**

$$r_t^E = R_{forward} + R_{center} + R_{safe}$$

- $$R_{forward}$$: recompensa por avanzar hacia el espacio abierto
- $$R_{center}$$: penalización por la desviación de guiñada respecto al centroide de la ROI
- $$R_{safe}$$: penalización por colisión / proximidad a obstáculos
- más una bonificación por área cubierta

Alimentar directamente RGB-D en bruto a un LSTM no produce comportamiento de exploración; el indicio de la ROI es lo que da a la política recurrente un fuerte sentido de la dirección, sin odometría ni mapa. Hasta donde sabemos, esta es la primera política de exploración puramente visual y sin mapa para robots aéreos.

**4. Modo de llegada al objetivo**

**Entrada:**
Imagen RGB + embedding de texto de CLIP congelado (alinea las características de texto y visión para el reconocimiento zero-shot de objetos) + caja delimitadora del objeto/clase.

**Recompensas:**

$$r_t^G = R_{dist} + R_{bbox} + R_{parent} + R_{suc} - R_{collision}$$

- $$R_{dist}$$: recompensa por reducir la distancia euclídea al objetivo
- $$R_{bbox}$$: recompensa por centrar y agrandar la caja delimitadora del objetivo en el campo de visión (indica que se acerca al objeto)
- $$R_{parent}$$: recompensa por clase padre — p. ej., llegar a un escritorio otorga una recompensa parcial si el objetivo es un portátil sobre ese escritorio
- $$R_{suc}$$: recompensa por éxito en la tarea
- $$R_{collision}$$: penalización por colisión

**5. Espacio de acciones**

Acciones discretas en **3D** — avanzar, girar a izquierda/derecha, ascender, descender, etc.

**6. Evaluación**
{: #evaluation}

Evaluado en dos simuladores: AI2-THOR (benchmark estándar con particiones de objetos vistos/no vistos) e IsaacSim (entornos más grandes con varias habitaciones donde el objetivo puede estar en una habitación distinta).

Las habitaciones individuales de AI2-THOR no permiten probar la exploración, pues el objetivo suele verse desde el inicio; por eso construimos en IsaacSim una evaluación con varias habitaciones (Chemistry Lab, Beechwood, Ihlen) con objetivos colocados en habitaciones no visibles desde el inicio. Los métodos que solo tienen una política de llegada al objetivo giran sobre sí mismos; con la política de exploración, el dron se dirige hacia el espacio abierto y encuentra el objetivo a través de las habitaciones.

{% include svg_figure.liquid name="aion_thor" caption="Benchmark AI2-THOR en dos particiones de objetos. AION lidera todas las métricas en ambas particiones; en la partición no vista 18/4 mejora a MJO en 4,3 puntos en SR y 3,5 en SPL." %}

{% include svg_figure.liquid name="aion_isaac" caption="Evaluación entre escenas en IsaacSim, en tres escenas con varias habitaciones y modelos de dron de alta fidelidad. Cada punto es un ensayo (cinco por objeto y escena); AION tiene éxito en 52 de 60 ensayos, frente a 40 y 35 de la exploración combinada con MJO y SSNet." %}

<div class="media-row">
  <div>
    <img src="/assets/img/p2_isaac.jpg" alt="Escenas de IsaacSim y objetos objetivo">
  </div>
  <div>
    <img src="/assets/img/p2_exploration_beechwood.png" alt="Trayectorias de exploración en Beechwood">
  </div>
</div>
