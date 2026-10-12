---
lang: es
project: 1_vla_benchmark
title: "LangGap: un benchmark de comprensión del lenguaje para VLA"
source_hash: ceb66c896e84
---

<p class="project-links">
  <span class="venue-badge">IROS 2026</span>
  <a href="https://arxiv.org/abs/2603.00592" target="_blank" rel="noopener">
    <i class="ai ai-arxiv"></i> arXiv: 2603.00592
  </a>
  <a href="/assets/pdf/LangGap-IROS2026-poster.pdf" target="_blank" rel="noopener">
    <i class="fa-solid fa-image"></i> Póster (IROS 2026)
  </a>
</p>

<nav class="contrib">
  <p>Lo que hice (primer autor) · haz clic en una tarjeta para ir a la sección</p>
  <ol>
    <li><a href="#benchmark"><strong>Diseño del benchmark</strong><span>99 tareas · 4 dimensiones de perturbación</span></a></li>
    <li><a href="#data"><strong>Recopilación de datos</strong><span>16 tareas × 150 demostraciones programadas</span></a></li>
    <li><a href="#training"><strong>Entrenamiento del modelo</strong><span>π0.5 LoRA · una sola tarea 0% → 90%</span></a></li>
    <li><a href="#results"><strong>Análisis de resultados</strong><span>93.8% → 21.4% · 4 modelos VLA</span></a></li>
  </ol>
</nav>

## Demo

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

## Resumen

Los modelos Vision-Language-Action (VLA) superan el 95% de éxito en los benchmarks estándar. Sin embargo, mediante experimentos sistemáticos encontramos que los VLA más avanzados actualmente ignoran en gran medida las instrucciones de lenguaje. Los trabajos previos carecen de: (1) diagnósticos sistemáticos de perturbación semántica, (2) un benchmark que fuerce por diseño la comprensión del lenguaje y (3) datos de entrenamiento lingüísticamente diversos. Este artículo construye el benchmark LangGap, basado en un método de perturbación semántica de cuatro dimensiones -- que varía la semántica de la instrucción manteniendo fija la disposición de la mesa -- y que revela deficiencias de comprensión del lenguaje en π0.5. Benchmarks existentes como LIBERO asignan una sola tarea por disposición, desaprovechando los objetos y destinos disponibles; LangGap diversifica por completo las tareas de pick-and-place bajo disposiciones idénticas, obligando a los modelos a comprender realmente el lenguaje. Los experimentos muestran que el aumento de datos dirigido puede cerrar parcialmente la brecha del lenguaje: la tasa de éxito pasa de 0% a 90% con entrenamiento de una sola tarea, y de 0% a 28% con entrenamiento multitarea. Sin embargo, a medida que aumenta la diversidad semántica de las tareas ampliadas, la capacidad de aprendizaje del modelo resulta severamente insuficiente; incluso las tareas entrenadas obtienen un mal rendimiento. Esto revela un desafío fundamental para los modelos VLA al comprender instrucciones de lenguaje diversas, y es precisamente el valor a largo plazo de LangGap.

## Detalles

**1. Benchmark y conjunto de datos**
{: #benchmark}

Benchmark LangGap: **99 tareas** en total: 40 tareas originales de LIBERO + 59 tareas ampliadas de perturbación semántica. Proporcionamos un conjunto de entrenamiento de 56 tareas: 16 tareas ampliadas recopiladas por nosotros (150 demostraciones cada una) + 40 tareas originales (50 demostraciones cada una), con un total de ~4,100 trayectorias.

**2. Descubrimiento del problema**
{: #diagnosis}

Al cambiar la instrucción de "put bowl on plate" → "put bowl on stove" en la misma escena visual, el modelo sigue ejecutando la acción original (va hacia el plato) y logra un **0% de éxito**. Esto revela que los VLA realizan un emparejamiento de patrones de visión a acción en lugar de una verdadera comprensión del lenguaje.

Diseñamos un diagnóstico de perturbación semántica de cuatro dimensiones (Change Object, Change Target, Spatial Description y Drawer Action) que mantiene idéntica la escena visual y modifica únicamente la instrucción:

{% include svg_figure.liquid name="langgap_diagnosis" caption="Diagnóstico de π0.5 en 99 tareas y 1,980 episodios. Nuestra reejecución de las 40 tareas originales coincide con la puntuación oficial; las 59 tareas ampliadas caen 72.4 puntos. En Change Target, π0.5 falla los 260 episodios y ningún modelo evaluado supera el 2.3%, de modo que el fallo no es un artefacto de la redacción, y la puntuación agregada lo oculta." %}

<div class="media-row">
  <div>
    <img src="/assets/img/libero_suites_strip.png" alt="Suites de evaluación de LIBERO con anotaciones de perturbación">
  </div>
</div>

**3. Principios de diseño**
{: #design}

1. **Multitarea en la misma escena** — Varias tareas comparten estados visuales iniciales idénticos, lo que elimina los atajos visuales. Un modelo que ignora el lenguaje logra como máximo una tasa de éxito de 1/k (k = tareas por escena).
2. **División entrenamiento/evaluación a nivel de instrucción** — Las tareas de entrenamiento no incluyen todas las tareas de prueba; la evaluación reservada contiene instrucciones de lenguaje no vistas para probar la generalización composicional.
3. **Validación de factibilidad física** — Todas las tareas ampliadas se verificaron en el simulador LIBERO para garantizar que los objetos se pueden agarrar, alcanzar y detectar.

**4. Pipeline de recopilación de datos**
{: #data}

- **Generación escalable y diversa:** Empleamos un pipeline de recopilación programado, basado en waypoints, para reunir de forma eficiente y estable 150 episodios exitosos por tarea. Aunque los waypoints están codificados a mano para cada tarea concreta, el simulador introduce ligeras variaciones naturales en la disposición inicial de la mesa. Esto garantiza que las trayectorias recopiladas sean diversas visual y dinámicamente, e impide que los modelos se limiten a memorizar trayectorias rígidas e idénticas.
- **Arquitectura de control jerárquica:** Cada tarea utiliza un script personalizado que descompone el proceso de pick-and-place en varios waypoints secuenciales. En el nivel superior aplicamos control puramente proporcional (P) para calcular los errores de posición y producir comandos de acción continuos. Estos comandos los ejecuta después el controlador PD OSC (Operational Space Control) de bajo nivel del simulador, lo que logra un control continuo fluido y muy preciso.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_waypoints.jpg" alt="Secuencia de waypoints de una demostración programada: inicio, agarre, transporte, colocación" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Temporización de waypoints de una demostración programada (ilustrativa): inicio → sobre el objeto → agarre → elevación → sobre el destino → colocación. Controlador OSC_POSE con el error de pose por paso normalizado a [−1, 1]; un episodio solo se conserva si tiene éxito dentro del presupuesto de pasos.</p>

- **Por qué scripts en lugar de teleoperación:** los primeros intentos con teleoperación mediante ratón resultaron temblorosos, lentos e inconsistentes. Los scripts, escritos a partir de las coordenadas de los objetos en el archivo BDDL de cada tarea, se ajustaron a mano en simulación hasta que cada tarea fue agarrable, alcanzable y detectable; las acciones resultantes son limpias y la recopilación es totalmente automática: ~150 demostraciones por tarea (las tareas oficiales de LIBERO tienen 50), 16 tareas ≈ 2,400 demostraciones.

<div style="margin: 1.5em 0;">
  <img src="/assets/img/langgap_rollout_2x8.jpg" alt="Muestra de rollouts de demostraciones programadas" style="width: 100%; border-radius: 4px;">
</div>
<p class="caption">Una muestra de las 2,400 demostraciones programadas.</p>

**Fine-tuning: una sola tarea de 0% a 90%**
{: #training}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="/assets/img/langgap_before_after_poster.jpg">
    <source src="/assets/video/langgap_before_after.mp4" type="video/mp4">
  </video>
</div>
<p class="caption">Izquierda: antes del entrenamiento, la instrucción dice «stove», pero la política sigue colocando el bol en el plato. Derecha: tras el fine-tuning con los datos ampliados, el bol va a la estufa.</p>

- π0.5 con LoRA (r = 64) en una sola RTX 4090.
- Los checkpoints se seleccionan por rollouts, no por la pérdida: la pérdida sigue disminuyendo mientras que la tasa de éxito no es monótona.
- Las instrucciones de entrenamiento y de prueba son idénticas palabra por palabra, salvo en las 43 tareas reservadas, cuyas instrucciones son nuevas.

**5. Resultados**
{: #results}

{% include svg_figure.liquid name="langgap_benchmark" caption="Benchmark completo: modelos VLA recientes en las cuatro suites de LIBERO, tareas originales frente a ampliadas. Todos los modelos muestran una gran brecha del lenguaje; nuestro π0.5 con fine-tuning en 45 tareas mejora el total de las tareas ampliadas (22.8) y Change Target (0 → 6.2), y mantiene 89.5 en las tareas originales. Las 43 tareas reservadas nunca se usaron para entrenar." %}

{% include svg_figure.liquid name="langgap_progressive" caption="Validación progresiva con los mismos datos ampliados a medida que el número de tareas de entrenamiento crece de 1 a 56. La memorización de una sola tarea alcanza el 90%, pero las mejoras se desploman cuando se aprenden conjuntamente tareas semánticamente distintas; al incorporar las 40 tareas oficiales (56 tareas) se recupera un 27.5%, aunque la brecha del lenguaje persiste." %}

**6. Valor a largo plazo**

A medida que aumenta la diversidad semántica de las tareas, la capacidad de aprendizaje del modelo resulta severamente insuficiente: incluso las tareas entrenadas obtienen un mal rendimiento. Esto revela un desafío fundamental e independiente de la arquitectura: todos los modelos evaluados (π0.5, π0, π0-FAST, SmolVLA) presentan la misma brecha del lenguaje. LangGap ofrece una herramienta de diagnóstico sistemática que seguirá siendo valiosa a medida que surjan nuevas arquitecturas VLA, precisamente porque la brecha del lenguaje es un problema persistente que los paradigmas de entrenamiento actuales aún no han resuelto.
