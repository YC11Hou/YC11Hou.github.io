---
lang: es
project: 0_honor_internship
title: "Honor Humanoid: RL en robot real para VLA"
source_hash: b1ae248d5011
---

Trabajo con el **robot humanoide** de desarrollo propio de Honor: recopilación de datos por teleoperación, reproducción, entrenamiento y despliegue en el robot, además de investigación en algoritmos de **RL en robot real** para modelos **Vision-Language-Action (VLA)** en tareas de manipulación personalizadas.

<nav class="contrib">
  <p>Lo que hice · haz clic en una tarjeta para saltar</p>
  <ol>
    <li><a href="#loop"><strong>Pipeline VLA de extremo a extremo</strong><span>Recopilar → entrenar → desplegar, laboratorio construido desde cero</span></a></li>
    <li><a href="#data-design"><strong>Diseño de datos offline</strong><span>4 categorías: seguir + recuperarse</span></a></li>
    <li><a href="#infra"><strong>Infraestructura de entrenamiento con toma de control humana</strong><span>Toma de control · bucle Actor–Learner–Robot · tarea nueva ≈ 0% → 50%+</span></a></li>
    <li><a href="#algorithms"><strong>Algoritmos de RL en robot real</strong><span>RECAP · RAPID · loco-manipulación</span></a></li>
    <li><a href="#rove"><strong>Reproducción de ROVE</strong><span>Éxito autónomo 40% → 52%</span></a></li>
    <li><a href="#debugging"><strong>Depuración en robot real</strong><span>6 errores, cada uno hallado con una sonda</span></a></li>
  </ol>
</nav>

## Demos

### Inferencia en el robot bajo perturbaciones

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/inference_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/inference_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Ejecuciones autónomas de pick-and-place en el robot real mientras el objeto (izquierda) y la cesta de destino (derecha) se perturban a mitad del episodio: la política vuelve a seguirlos y completa la tarea. La mano nunca deja de moverse y la política nunca espera a que el objeto se asiente: lo que aprendió es seguimiento visual y rechazo de perturbaciones, no una única trayectoria de pick-and-place.

### Diseño de datos para la robustez

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/data_design_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/data_design.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Cuatro categorías de demostraciones teleoperadas: demostraciones estándar, perturbaciones durante la fase de agarre, perturbaciones durante la fase de colocación y recuperación desde estados de agarre fallido, diseñadas para que la política aprenda a recuperarse y no solo a repetir.

### SFT en robot real: antes y después

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/online_sft_compare_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/online_sft_compare.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>

Una tarea que la política entrenada offline no podía realizar se aprende en el robot mediante el bucle de aprendizaje en robot real: los datos de toma de control humana vuelven al entrenamiento y la proporción de tomas de control disminuye a medida que se despliegan nuevos checkpoints.

## 1. Pipeline VLA de extremo a extremo {#loop}

El laboratorio de Shanghái se montó desde cero tras mi incorporación: configuración del robot, dos equipos de teleoperación (Pico VR y captura de movimiento), formación de los operadores de recopilación de datos y el pipeline de entrenamiento. La tarea es pick-and-place (botella → cesta) con una única instrucción fija.

{% include svg_figure.liquid name="honor_pipeline" caption="Pipeline de extremo a extremo en robot real. GR00T N1.7 (3B) se post-entrena con el backbone de visión-lenguaje congelado; la acción de 37-D se selecciona a partir de un estado del robot de 115-D. No hay conjunto de validación, así que los checkpoints se guardan cada 2K pasos y se eligen mediante ejecuciones en el robot; la pérdida se estabiliza tras unos 15K pasos." %}

{% include svg_figure.liquid name="honor_chunk" caption="Traspaso de action chunks en la inferencia. El siguiente chunk se solicita cuando quedan 15 pasos; las acciones que han quedado obsoletas durante la inferencia se descartan y el solapamiento se funde linealmente, de modo que el robot no se entrecorta entre chunks." %}

**En el robot**, la fase de colocación casi nunca falla: la política mantiene el ritmo incluso cuando la cesta se arrastra rápido. Los fallos de agarre se correlacionan con la posición del objeto; esto se remontó a los datos (postura fija, sin movimiento local durante la recopilación, por lo que el modelo nunca desarrolla una noción de distancia) y no a la precisión del brazo. Resultado: el laboratorio ganó un ciclo propio de iteración «recopilar → ajustar → validar en el robot» en lugar de depender de modelos entregados desde fuera.

## 2. Diseño de datos offline {#data-design}

**Por qué las cuatro categorías de datos.** Las categorías ①–③ (estándar, perturbación en la fase de agarre, perturbación en la fase de colocación) enseñan a la política a _seguir_ un objeto o contenedor en movimiento. La categoría ④ le enseña a _recuperarse_: partiendo de la pose de espera justo después de un agarre fallido, la demostración baja la mano, vuelve a agarrar y coloca. Sin ella, la política a menudo no se da cuenta de que el agarre falló: levanta la mano vacía, la lleva a la cesta y «coloca» nada. Las cuatro categorías están aproximadamente equilibradas; la robustez de la demo anterior proviene de este diseño de datos, no del ajuste de hiperparámetros.

## 3. Infraestructura de entrenamiento en robot real con toma de control humana {#infra}

### 3.1 Toma de control humana y pipeline de datos dirigido por intervenciones {#takeover}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/takeover_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/takeover_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">Un teleoperador toma el control a mitad del episodio y lo devuelve (velocidad 3×, sin audio).</p>

**Toma de control humana suave.** Aprender en el robot real exige que una persona pueda tomar el control en cualquier momento sin que el robot dé un salto. Al tomar el control, el tópico de comandos del VLA se redirige al tópico de teleoperación, y el controlador emite un _incremento_ sobre la última acción del VLA en lugar de los ángulos articulares absolutos del teleoperador.

{% include svg_figure.liquid name="honor_fsm" caption="Máquina de estados de conmutación y regla de salida durante la toma de control. Las tomas de control también se escriben en los datos, de modo que cada episodio sabe qué fotogramas provienen de la persona." %}

**Pipeline de datos dirigido por intervenciones.** Cada episodio se persiste y el operador solo puede vetar el clasificador de éxito hacia abajo, nunca promover un fallo a éxito; las decisiones del clasificador y las estadísticas de falsos positivos/negativos se registran junto a ellas. El buffer es un anillo numpy acotado con cubos de éxito/fallo, FIFO con borrado lógico y muestreo ponderado (corrección de importancia PER), y un endpoint HTTP de revisión permite inspeccionar cada episodio antes de que llegue al entrenamiento. En otra ronda, 127 de 138 episodios recopilados entraron en el buffer como éxitos (11 totalmente autónomos, 116 con demostraciones de toma de control).

{% include svg_figure.liquid name="honor_datapipe" caption="Del robot al learner: cada episodio, incluidos los fallos, se registra, se juzga y se sube; el learner clasifica los episodios por resultado. Abajo: composición de una ronda de datos en robot real (142–416 fotogramas por episodio)." %}

### 3.2 Bucle distribuido de aprendizaje en robot real {#online-loop}

**Reproduje el bucle de rejection sampling de Hi-ORS y lo porté de π0 + un brazo Dobot a GR00T N1.7 + un humanoide.** Tres máquinas funcionan simultáneamente.

{% include svg_figure.liquid name="honor_arch" caption="Arquitectura Actor–Learner–Robot. El Actor ejecuta la política sobre el robot, solo los episodios exitosos llegan al Learner y este devuelve al Actor los pesos entrenables cada 1,000 pasos." %}

{% include svg_figure.liquid name="honor_gates" caption="Compuertas antes de que un episodio entre en el entrenamiento. El clasificador de éxito es una ResNet18 sobre un único fotograma de la cámara izquierda con una cabeza de un logit, entrenada con BCE + pos_weight sobre 572 episodios (división a nivel de episodio, aumento de datos online, etiquetas derivadas automáticamente de las señales de la pinza; F1 a nivel de fotograma 0.976). Solo se activa tras 20 fotogramas consecutivos por encima de 0.8; esta histéresis se añadió tras la primera sesión en el robot real, en la que el clasificador declaraba éxito en 1–2 s y los falsos positivos llenaban el buffer. Los anclajes de demostraciones base en cada batch protegen contra el olvido." %}

### 3.3 Resultados del SFT en robot real: una tarea nueva de ≈ 0% a 50%+ en ~140 episodios {#results}

Cuando la política se atasca, el operador toma el control mediante Pico; los datos de la toma de control fluyen directamente al Learner y la proporción de tomas de control sirve como métrica en vivo. La **escena 1** mueve la botella a la derecha, donde los datos offline son escasos. La **escena 2** intercambia toda la disposición de izquierda a derecha (cesta a la izquierda, botella a la derecha), exactamente lo opuesto a todos los datos offline, por lo que la línea base de SFT offline es ≈ 0%.

{% include svg_figure.liquid name="honor_curve" caption="Proporción de pasos teleoperados por episodio durante el SFT en robot real, con los checkpoints enviados al Actor. Cada actualización de checkpoint va seguida de una caída de las tomas de control; el aumento hacia el episodio 86 corresponde al cambio a la escena 2. Durante la fase de prueba (checkpoints 5000–7000) la proporción de tomas de control baja al 18.8%." %}

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Escena</th><th>Cambio respecto a los datos offline</th><th>Episodios</th><th>SFT offline</th><th>Tras SFT en robot real</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Botella a la derecha (escasa en los datos offline)</td><td>20</td><td>no medido</td><td><strong>55.0%</strong></td></tr>
    <tr><td>2</td><td>Cesta a la izquierda, botella a la derecha (disposición invertida)</td><td>12</td><td>≈ 0%</td><td><strong>50.0%</strong></td></tr>
  </tbody>
</table>
</div>

Tasa de éxito totalmente autónomo. Por qué un backbone congelado aún puede aprender la disposición invertida: el modo de fallo era _no moverse en absoluto_ y no moverse en la dirección equivocada; la comprensión visual estaba intacta, solo faltaba el mapeo de acciones.

## 4. Algoritmos de RL en robot real {#algorithms}

### 4.1 Entrenamiento condicionado por la ventaja al estilo RECAP {#recap}

El rejection sampling es un caso degenerado binario de la ventaja: conservar todos los éxitos, descartar todos los fallos. **Porté el etiquetado de ventaja de π0.6 RECAP (como en RLinf) a GR00T N1.7** para que se usen _todos_ los datos, con «bueno frente a malo» como condición de entrada y no como filtro: los episodios fallidos se convierten en muestras negativas en lugar de desperdicio.

{% include svg_figure.liquid name="honor_recap" caption="Pipeline al estilo RECAP. La penalización por fallo c_fail = 1000 supera la diferencia entre el éxito más largo (1,000 fotogramas) y el fallo más corto (57 fotogramas), de modo que todo fallo queda por debajo de todo éxito. n = 20 pasos corresponde al horizonte de 1 s del artículo a 20 Hz. Los negativos solo moldean la rama CFG incondicional." %}

{% include svg_figure.liquid name="honor_value_net" caption="Red de valor. El backbone de GR00T permanece congelado y no recibe gradiente; los tokens de imagen y de texto se promedian por separado porque los tokens de imagen superan con creces a los de texto y una única media diluiría el condicionamiento por lenguaje. RLinf añade un token CLS aprendible y usa una única cabeza lineal; el backbone de GR00T no admite embeddings de entrada adicionales, así que aplicamos pooling y añadimos una capa oculta. El esquema de la distribución de átomos es ilustrativo." %}

Hasta que V esté listo, se usan etiquetas basadas en reglas como alternativa: todos los fotogramas de éxito son positivos, los fotogramas autónomos de los fallos son negativos y los 20 fotogramas previos a cada toma de control se sobrescriben como negativos. La red de valor se entrena por separado y solo se acepta si el ρ de Spearman en episodios reservados (uno de cada diez) supera 0.55: la ejecución de prueba alcanzó ρ = 0.647 (meseta 0.59) con pérdida 4.52 → 0.76, mientras que un control con etiquetas barajadas se mantuvo en un ρ absoluto ≤ 0.26 y no cumplió el criterio, por lo que el criterio es significativo. La coincidencia entre las etiquetas basadas en V y las basadas en reglas fue de solo 0.31, de modo que la red de valor sigue siendo el cuello de botella, y la comparación A/B en robot real no se completó.

### 4.2 RAPID: adaptación rápida en el espacio de ruido {#rapid}

**RAPID** (_Rapid Adaptation from Physical Interventions via Diffusion-noise_), en el espíritu de DSRL: entrenar un nuevo checkpoint lleva tiempo y, hasta que llega, el robot sigue sin poder hacer la tarea. RAPID deja congelados los pesos del VLA y solo sustituye el ruido inicial del flow matching, de modo que una corrección que la persona acaba de hacer puede reutilizarse la próxima vez que aparezca un estado similar. Se integró en la inferencia en el robot a finales de agosto.

{% include svg_figure.liquid name="honor_rapid" caption="RAPID. Offline, las correcciones humanas se invierten a través de la política congelada hasta el ruido inicial que las reproduce (64 pasos finos; Euler de 4 pasos es demasiado grueso) y se almacenan en una memoria indexada por observación. En el despliegue, el ruido recuperado se interpola esféricamente con ruido gaussiano antes del muestreo normal de flow matching." %}

{% include svg_figure.liquid name="honor_dsbc_net" caption="Red de ruido DSBC. Un pequeño MLP mapea la clave de recuperación directamente al ruido inicial, sustituyendo la búsqueda del vecino más cercano; el propio VLA permanece congelado. H es el horizonte de acción de 40 pasos de la cabeza de acción de GR00T (30 pasos se ejecutan por inferencia); D es su dimensión de acción." %}

{% include svg_figure.liquid name="honor_rapid_chart" caption="Validación offline sobre 24 episodios de toma de control de una tarea de mostrador. DSBC lidera en todo K (54.9–57.0); la recuperación de memoria solo llega a 20 con K = 1–2 y a 45–49 con K ≥ 4; el partial noising se mantiene plano en 37; memory_delta queda por debajo de 8. La métrica es la ganancia DTW, no la tasa de éxito en robot real." %}

La auditoría fue **preregistrada**: auditoría PASS; reversión CONDITIONAL (error de reconstrucción 0.232, dentro de 0.10–0.30); dispersión degradada a frágil tras una nueva ejecución; transferencia PASS (p ≈ 1e-21). Bajo estos criterios, la afirmación «la recuperación gana con K < 10» fue **descartada**: el diseño experimental rechazó mi propia hipótesis, y el sistema convergió en DSBC como vía principal, con la recuperación de memoria como front end opcional. Los siguientes pasos eran destilar DSBC en la política, retirar gradualmente las entradas de memoria y conectarlo con el RL en robot real.

### 4.3 Extensión a la loco-manipulación {#loco}

<div class="ratio-16x9" style="margin-bottom: 1rem;">
  <video controls preload="metadata" poster="{{ '/assets/video/honor/locomanip_demo_poster.jpg' | relative_url }}">
    <source src="{{ '/assets/video/honor/locomanip_demo.mp4' | relative_url }}" type="video/mp4">
  </video>
</div>
<p class="caption">El humanoide camina de forma autónoma hasta un mostrador y agarra una botella: 7 clips en robot real, velocidad 5×, sin audio; las marcas amarillas del suelo son referencias de la ruta de marcha.</p>

Toda la pila (toma de control, bucle de aprendizaje en robot real, RECAP y RAPID) pasó del pick-and-place sobre mesa a una tarea con marcha sin tener que reescribirse.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Datos de loco-manipulación</th><th>Valor</th></tr></thead>
  <tbody>
    <tr><td>Episodios de marcha recopilados</td><td>507 episodios · 181K fotogramas</td></tr>
    <tr><td>Conservados tras 6 criterios de filtrado</td><td>326 episodios</td></tr>
    <tr><td>Conjunto de entrenamiento combinado</td><td><strong>848 episodios · 306K fotogramas (+71%)</strong></td></tr>
    <tr><td>Longitud mediana de trayectoria por episodio</td><td>0.32 m → <strong>3.2 m</strong></td></tr>
  </tbody>
</table>
</div>

**Sobre las métricas, con honestidad:** la etapa de SFT en robot real tiene cifras completas (55% / 50%). Tras pasar a la tarea de loco-manipulación, todos los componentes se implementaron e integraron, pero no se logró ninguna mejora a nivel de métricas: la madurez del hardware de cuerpo completo y de la pila de locomoción en ese momento no permitió una evaluación sistemática en robot real.

## 5. Reproducción de ROVE {#rove}

**Tarea.** El humanoide se mantiene en el sitio (pies fijos, sin caminar) y recoge un teléfono con la mano: manipulación fina en la que un pequeño desajuste termina rápidamente en una toma de control humana.

ROVE (XPENG, arXiv:2606.17011) conserva el esqueleto de condicionamiento por ventaja de RECAP (§4.1) y cambia la forma de puntuar las tomas de control humanas. Lo reproduje sobre el pipeline de RECAP tras un único interruptor de algoritmo (la ruta RECAP por defecto permanece idéntica bit a bit, garantizado por autotests) y ejecuté el Algoritmo 1 del artículo como un bucle offline: desplegar y recopilar → retornos con conciencia de etapa → actualización del valor → ventajas y etiquetas → SFT condicional. Solo el primer paso necesita el robot; los otros cuatro se ejecutan con un solo comando.

### 5.1 Retorno con conciencia de etapa {#rove-return}

Con RECAP, un episodio que una persona rescató sigue contando como éxito: su retorno sube una unidad por paso hasta 0, de modo que las acciones autónomas que _provocaron_ la toma de control parecen un progreso constante. El único remedio es una regla fija que etiqueta como negativos los 20 fotogramas previos a una toma de control. ROVE divide tal episodio en tres segmentos (ejecución autónoma, adaptación, en la que la persona aún reconduce al robot, y recuperación) y contabiliza una penalización por fallo C_fail en t_r, el final de la adaptación. El segmento autónomo que condujo a la toma de control puntúa ahora a nivel de fallo, mientras que la recuperación conserva su retorno normal de tiempo restante.

{% include svg_figure.liquid name="honor_rove_return" caption="Retorno con conciencia de etapa (Ec. 2 del artículo): −1 por paso, C_fail en t_r, fotogramas inactivos (el operador cambia de modo) eliminados. t_r recurre a toma de control + 40 fotogramas (2 s) cuando no está anotado; la ablación del artículo pierde 30 pp cuando t_r se sitúa al inicio de la toma de control, así que el valor por defecto peca de tardío. C_fail debe superar el tramo más largo del conjunto positivo, o un episodio fallido superaría en puntuación a una recuperación: la cota inferior medida en estos datos es 919, por lo que C_fail = 1000 (el 500 del artículo es demasiado pequeño aquí). Los retornos coincidieron bit a bit con el cálculo manual en 38 episodios archivados." %}

### 5.2 Estimación optimista del valor (OVE) {#rove-ove}

La regresión Monte-Carlo simple aprende el retorno _medio_. En estados que a menudo terminan en una toma de control, la media ya es baja, de modo que la acción que provocó la toma de control obtiene una ventaja cercana a cero y nunca se etiqueta como negativa. OVE ajusta la misma cabeza de valor escalar, tras el preentrenamiento MC, con un objetivo TD de 16 pasos (a partir de una copia EMA de la red) y una pérdida de expectil con τ = 0.7, que penaliza más las subestimaciones que las sobreestimaciones. Así, V estima lo que vale un estado _cuando las cosas van bien_: los estados previos a la toma de control se valoran alto, su retorno real es bajo, y la ventaja negativa recae sobre las acciones que provocaron la toma de control. El horizonte de la ventaja también es de 16 pasos (un action chunk, la unidad a la que se asocia la etiqueta) y el 40% superior de los fotogramas se etiqueta como positivo.

Cada checkpoint de valor se filtra mediante el ρ de Spearman en episodios reservados: la concordancia de rangos entre V predicho y el retorno real (1 = mismo orden). La etapa MC debe alcanzar ρ ≥ 0.55 sobre el conjunto completo; la etapa OVE se juzga solo sobre episodios exitosos (ρ ≥ 0.70), porque OVE se aparta del retorno medio en estados abocados al fallo por diseño, así que un ρ menor sobre el conjunto completo es esperable y no una regresión.

{% include svg_figure.liquid name="honor_rove_rho" caption="ρ de Spearman en datos reservados en tres ejecuciones de entrenamiento del valor (sombreado: fase OVE). Rollouts limpios: el ρ del conjunto de éxitos se mantiene en 0.744–0.806 tras el cambio a OVE, mientras que el ρ del conjunto completo baja de 0.735 a 0.69 como se pretendía; el umbral de 0.70 se fijó a partir de esta ejecución. Demos + rollouts: el ρ del conjunto de éxitos cae de 0.731 a 0.628: el 85% del conjunto reservado son demostraciones limpias, y el bootstrapping optimista las empuja todas hacia arriba, comprimiendo el ranking. Conjunto iter0, con arranque en caliente directamente en OVE: ρ del conjunto completo 0.68–0.71, ρ del conjunto de éxitos 0.63–0.67, por debajo del umbral. Los tres conjuntos tienen datos reservados distintos, por lo que el ρ no es comparable entre paneles." %}

<figure class="fig">
  <img src="{{ '/assets/img/honor_rove_value_curve.jpg' | relative_url }}" alt="Curvas de valor en un episodio reservado con toma de control: retorno real, valor MC y valor OVE, con los fotogramas de ventaja negativa marcados" loading="lazy" width="1400" height="653">
  <figcaption>Reproducción de la Fig. 6 del artículo en un episodio reservado con una toma de control (x: fotograma, sin fotogramas inactivos; y: valor normalizado). Antes de t_r el valor OVE (azul) queda por encima del valor MC (naranja), optimista dentro de la distribución, luego salta en t_r y sigue el retorno real durante la recuperación. Los puntos rojos marcan fotogramas con ventaja OVE negativa: se concentran antes de la toma de control y en el segmento de adaptación.</figcaption>
</figure>

### 5.3 Resultados {#rove-results}

El éxito autónomo en el robot subió del 40% (checkpoint base, n = 77) al **52%** (ROVE iter0, n = 192); los éxitos asistidos por humanos bajaron del 45% al 20% de los episodios, mientras que los fallos subieron del 14% al 28%.

{% include svg_figure.liquid name="honor_rove_robot" caption="Resultado de cada episodio en robot real registrado, por checkpoint, según el juicio del operador. Base 64000: finales de ago – principios de sep; base 80000: principios – mediados de sep; ROVE iter0: 17–23 de sep." %}

iter0 se entrenó con una pasada del bucle offline: un conjunto de valor de 2,068 episodios (534K fotogramas de demostraciones y rollouts en robot real, 207 episodios reservados), etiquetas con exactamente un 40.0% de positivos y SFT condicional desde el checkpoint base de 80K pasos durante 8,000 pasos (lr 1e-4) en una GPU H20 en 18 h 17 min.

{% include svg_figure.liquid name="honor_rove_sft" caption="Pérdida del SFT condicional de iter0. La media de 200 pasos baja de 0.54 a 0.047 en el paso 1,000 y a 0.025 en el paso 8,000." %}

**Sobre las métricas, con honestidad:** los tres grupos provienen de días, operadores y conjuntos de prompts distintos, por lo que esto es una observación y no un test A/B; la evaluación intercalada frente al checkpoint base y a un brazo RECAP sigue pendiente. La recopilación de iter0 tampoco registró segmentos de toma de control, de modo que la siguiente ronda carece de la señal central de ROVE hasta que se corrija ese registro.

## 6. Depuración en robot real {#debugging}

Ninguno de estos errores pudo hallarse revisando el código offline: solo afloraron durante largas ejecuciones en el robot real, y cada uno se localizó con una sonda o una métrica cuantitativa.

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Síntoma</th><th>Sonda / evidencia</th><th>Causa raíz → corrección</th></tr></thead>
  <tbody>
    <tr><td>La generalización se degrada tras el ajuste fino</td><td>Pérdida reservada 0.0048 → 0.0222 en el paso 2000 (×4.6); coseno de la dirección de acción 0.995 → 0.979 → 0.961</td><td>El mezclador de datos base leía mp4 como BGR mientras que la torre de visión congelada espera RGB: la mitad del presupuesto de gradiente aprendía ruido; se corrigió con un solo valor por defecto. Los anclajes cubrían solo 29 episodios (5.6%) → ampliar el buffer base</td></tr>
    <tr><td>El buffer se llenó de falsos éxitos</td><td>Episodios activaron «éxito» tras 24 y 29 pasos; el learner entrenó con ellos durante más de 1,000 pasos</td><td>La activación y el reinicio compartían un umbral de 0.5, sin histéresis → activar con p &gt; 0.8 × 20 fotogramas, reiniciar con p ≤ 0.3 × 3 fotogramas. Un objeto posterior sin reiniciar produjo 2,536 pasos basura en 11 episodios, justo por encima del umbral de entrenamiento de 2,500 pasos: auditar fotograma a fotograma desde la primera sesión</td></tr>
    <tr><td>El comportamiento difiere entre entrenamiento, despliegue y RL</td><td>Comparación campo a campo de las observaciones en los tres pipelines</td><td>Tipo DDS de la pinza, una cámara boca abajo, inicialización de la posición de la mano, indexación de la posición de la cabeza → lista de 9 correcciones</td></tr>
    <tr><td>El robot gira al inicio del episodio</td><td>Deriva mediana de yaw de 31°</td><td>Ancla de yaw obsoleta + reanclaje completo en cada chunk → límite de tasa de 3°/chunk con tope de 20°; 6 ejecuciones de validación: error de anclaje 0.0°, giro en el primer segundo ≤ 1.6°</td></tr>
    <tr><td>Fotogramas de cámara obsoletos</td><td>47% de fotogramas consecutivos duplicados en 77 de 83 episodios; fuente 61 Hz, decodificación 54.9 Hz, efectivo ≈ 10.6 Hz bajo carga</td><td>Se añadió observabilidad de la frescura de los fotogramas</td></tr>
    <tr><td>«El modelo no se mueve»</td><td>Cliente del trainer bloqueado en reintentos</td><td>Puertos de actor / learner discordantes. Lección: todo «el modelo no se mueve» es primero una comprobación de comunicación u observación, y solo después de pesos</td></tr>
  </tbody>
</table>
</div>
