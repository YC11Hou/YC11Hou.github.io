---
lang: es
project: 4_exploration_vehicle
title: "Vehículo de exploración autónoma basado en fronteras"
source_hash: 36c561ab6341
---

<nav class="contrib">
  <p>Lo que hice (tesis de grado, líder de equipo) · haz clic en una tarjeta para saltar</p>
  <ol>
    <li><a href="#architecture"><strong>Arquitectura del sistema</strong><span>3 capas · 2 modos de tarea</span></a></li>
    <li><a href="#hardware"><strong>Integración de hardware</strong><span>Jetson · LiDAR · RGB-D · STM32</span></a></li>
    <li><a href="#localization"><strong>Localización de víctimas</strong><span>Máscara YOLOv11 + profundidad → mapa</span></a></li>
    <li><a href="#odometry"><strong>Puente de odometría SLAM</strong><span>TF de Cartographer → /odometry</span></a></li>
    <li><a href="#frontier"><strong>Exploración por fronteras</strong><span>Ganancia de información frente a coste de desplazamiento</span></a></li>
    <li><a href="#experiments"><strong>Experimentos de campo</strong><span>3 sitios × 3 velocidades × 3 ejecuciones</span></a></li>
  </ol>
</nav>

## Demo

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

## Resumen

La búsqueda y el rescate tras un desastre es una carrera contra el tiempo, y los escombros, el calor o la radiación suelen hacer que el lugar sea demasiado peligroso para que las personas entren primero. Este proyecto construye un pequeño robot de orugas que entra antes que ellas: explora por sí solo un espacio interior desconocido, construye el mapa mientras avanza y marca en él a cada persona que encuentra, de modo que los rescatistas saben adónde ir antes de poner un pie en el interior.

Todo se ejecuta a bordo en ROS 2: **Cartographer** para SLAM, **Navigation2** para planificación y control, **YOLOv11** con una cámara de profundidad para encontrar víctimas, y mi nodo de **exploración por fronteras**, que decide adónde ir a continuación.

## 1. Arquitectura del sistema y modos de tarea {#architecture}

{% include svg_figure.liquid name="vehicle_arch" caption="Arquitectura del sistema. El Jetson (maestro) ejecuta toda la pila de ROS 2 y se comunica con los sensores por USB; el STM32 (esclavo) controla los motores y lee la IMU por IIC, y las dos placas se comunican por UART." %}

El robot funciona en dos modos. En el **modo de exploración** mapea un edificio desconocido y registra las víctimas a medida que avanza; en el **modo de rescate** vuelve a cargar ese mapa y se dirige a cada víctima registrada por turno.

{% include svg_figure.liquid name="vehicle_modes" caption="Flujo de tareas de los dos modos. La exploración repite mapa → frontera → navegación hasta que no queda ninguna frontera útil, mientras la detección de víctimas se ejecuta en paralelo; el rescate se localiza en el mapa guardado con AMCL y visita una a una las posiciones de víctimas almacenadas." %}

## 2. Integración de hardware {#hardware}

<figure class="fig">
  <img src="{{ '/assets/img/vehicle/robot.jpg' | relative_url }}" alt="La plataforma robótica de orugas con un LiDAR encima y una cámara de profundidad en la parte delantera" style="display: block; width: 100%; max-width: 520px; margin: 0 auto; border-radius: 6px;">
  <figcaption>La plataforma: un chasis de orugas que lleva el Jetson, un LiDAR 2D en la parte superior y una cámara RGB-D en la parte delantera.</figcaption>
</figure>

<div style="overflow-x: auto; margin: 1em 0;">
<table>
  <thead><tr><th>Componente</th><th>Función</th><th>Especificación clave</th></tr></thead>
  <tbody>
    <tr><td><strong>Jetson Orin NX 16GB</strong></td><td>Computadora de a bordo, ejecuta todo ROS 2</td><td>Ubuntu 22.04 · ROS 2 Humble</td></tr>
    <tr><td><strong>RPLIDAR C1</strong></td><td>LiDAR 2D para SLAM y mapas de costes</td><td>ToF · alcance 0.05–12 m · escaneo de 8–12 Hz</td></tr>
    <tr><td><strong>Orbbec Astra Pro Plus</strong></td><td>Cámara RGB-D para la detección de víctimas</td><td>Profundidad 0.6–8 m · hasta 640×480 @ 30 fps · FOV RGB 66.01° × 40.2°</td></tr>
    <tr><td><strong>STM32F407VET6 + MPU6050</strong></td><td>Control de motores e IMU</td><td>Cortex-M4 · 168 MHz</td></tr>
    <tr><td><strong>Motores DC MG513</strong></td><td>Tracción por orugas</td><td>Hasta 1.1 m/s · 3 kg de carga útil</td></tr>
  </tbody>
</table>
</div>

## 3. Detección de víctimas y localización 3D {#localization}

Un cuadro delimitador no basta para ubicar a una persona en un mapa: sus esquinas caen sobre el suelo y la pared del fondo, por lo que la profundidad en su interior es en su mayoría fondo. Por ello el detector usa **segmentación con YOLOv11** y solo se emplean los píxeles de profundidad dentro de la máscara de la persona.

{% include svg_figure.liquid name="vehicle_localize" caption="Localización de víctimas. La máscara de segmentación selecciona los píxeles de la persona en la imagen de profundidad alineada; un filtro de mediana elimina el ruido y los valores atípicos, y la media de lo que queda es la distancia d_tar. La posición horizontal del centro de la máscara da el rumbo θ_off, y la pose del robot obtenida de la odometría lleva el punto del marco de la cámara al mapa." %}

Con $$x_{cen}$$ el centro horizontal de la máscara, $$W_{img}$$ el ancho de la imagen y $$\theta_{FOV}$$ el campo de visión horizontal de la cámara:

$$\theta_{off} = \frac{2x_{cen} - W_{img}}{2W_{img}} \cdot \theta_{FOV}$$

$$x_c = d_{tar}\sin\theta_{off}, \qquad y_c = d_{tar}\cos\theta_{off}$$

Cada posición se guarda junto con el mapa, y esos son los objetivos a los que el modo de rescate se dirige después.

## 4. Puente de odometría SLAM {#odometry}

Cartographer proporciona la pose del robot como transformaciones TF, mientras que los nodos de navegación y localización esperan un flujo `nav_msgs/Odometry` con velocidades. Un pequeño nodo puente convierte uno en otro:

1. Consultar `map → odom` y `odom → base_link` y componer la pose del robot, $$T_{mb} = T_{mo} \cdot T_{ob}$$, obteniendo la posición $$p = [x, y, z]^T$$ y el cuaternión de orientación $$q$$.
2. Convertir $$q$$ a alabeo, cabeceo y guiñada.
3. Derivar en el tiempo: $$v(t) \approx \dfrac{p_{mb}(t) - p_{mb}(t_{prev})}{\Delta t}$$, y la velocidad de guiñada a partir de la diferencia de guiñada normalizada.
4. Publicar `/odometry/filtered` con pose, twist y covarianza.

## 5. Exploración por fronteras optimizada {#frontier}

La exploración clásica por fronteras se dirige a la frontera más cercana, lo que desperdicia tiempo en bolsillos diminutos y obliga a retroceder por el mapa. Mi nodo puntúa cada frontera según **cuánto espacio desconocido revelaría** frente a **cuánto debe recorrer el robot** para llegar a ella:

1. **Preprocesar** — suscribirse a la cuadrícula de ocupación de Cartographer y reorganizarla como un arreglo 2D.
2. **Detectar fronteras** — aplicar detección de bordes Canny sobre el límite entre el espacio libre conocido y el espacio desconocido.
3. **Decidir** — elegir la frontera con el mejor equilibrio entre ganancia y coste y enviarla a Nav2 como siguiente objetivo.

$$I_f = \sum_{c \,\in\, N(f,r),\ c\ \text{unknown}} w_c, \qquad D_f = d_{path}(p, f)$$

$$f^* = \arg\max_{f \in F} \left( w_1 I_f - w_2 D_f \right)$$

$$I_f$$ cuenta las celdas desconocidas ponderadas dentro del radio $$r$$ de la frontera $$f$$; $$D_f$$ es la longitud de la trayectoria desde la posición del robot $$p$$; $$w_1, w_2$$ fijan el equilibrio.

{% include svg_figure.liquid name="vehicle_loop" caption="Bucle de exploración. Cada 2 s se reconstruye el mapa y se extraen las fronteras a lo largo del límite del espacio libre conocido; la frontera con la mejor puntuación de ganancia de información frente a coste de desplazamiento se convierte en el siguiente objetivo de Nav2, y las puntuaciones se actualizan a medida que el mapa crece: una exploración constante sin trayectorias redundantes." %}

<figure class="fig">
  <div style="display: flex; gap: 12px; align-items: flex-start;">
    <img src="{{ '/assets/img/vehicle/frontier_map.jpg' | relative_url }}" alt="Mapa de visualización de fronteras: fronteras, robot, frontera elegida y víctimas localizadas" style="flex: 557; min-width: 0; border-radius: 4px;">
    <img src="{{ '/assets/img/vehicle/frontier_rviz.jpg' | relative_url }}" alt="Vista de RViz del mismo instante con el mapa de Cartographer y el mapa de costes de Nav2" style="flex: 557; min-width: 0; border-radius: 4px;">
  </div>
  <figcaption>El mismo instante de una ejecución en dos vistas. A la izquierda, el mapa de fronteras: las líneas rojas son fronteras, el punto azul oscuro es el robot, el punto verde es la frontera elegida y los puntos naranjas son víctimas localizadas. A la derecha, RViz con el mapa de Cartographer y el mapa de costes inflado de Nav2.</figcaption>
</figure>

## 6. Experimentos de campo {#experiments}

Un rescate real ocurre en un espacio grande y complejo bajo presión de tiempo, así que la prueba plantea una pregunta sencilla: **¿qué área busca el robot en cinco minutos?** Se realizó en tres entornos interiores con distintas distribuciones, con tres límites de velocidad y tres ejecuciones cada uno, para un total de 27 ejecuciones.

{% include svg_figure.liquid name="vehicle_sites" caption="Los tres sitios de prueba (arriba) y un mapa construido en cinco minutos con cada límite de velocidad. Los mapas muestran solo la forma y no están dibujados a una escala común. El blanco es espacio libre explorado, el gris es desconocido, el negro marca obstáculos y las líneas rojas son fronteras; los puntos naranjas son víctimas localizadas, el punto azul es el robot y el punto verde es la siguiente frontera." %}

{% include svg_figure.liquid name="vehicle_area" caption="Área buscada en cinco minutos. Cada entorno responde de forma distinta a un límite de velocidad mayor." %}

**Lo que dicen los números.** El mejor límite de velocidad depende de la distribución. En el **pasillo largo y abierto del área de docencia**, un robot más rápido simplemente cubre más terreno. En el **pasillo estrecho de la residencia**, los giros y los pasos angostos limitan la ganancia una vez que el límite supera 0.6 m/s. En el **laboratorio abarrotado**, 0.9 m/s no explora más que 0.6 m/s. Por tanto, un único límite de velocidad ajustado a mano es un compromiso.

## 7. Conclusiones

Sencillo para los estándares actuales, pero un bucle completo con un robot real construido a partir de piezas individuales —sensores, control embebido, SLAM, navegación, percepción y toma de decisiones—, y las habilidades de despliegue que usé en todos los proyectos posteriores comenzaron aquí.

Los experimentos también apuntaron a lo que vendría después. La tesis propuso dos direcciones: ajustar en línea parámetros de exploración como el límite de velocidad mediante RL libre de modelo en lugar de hacerlo a mano, y reemplazar la pila modular basada en LiDAR por RL de extremo a extremo basado en modelo, usando solo visión. La navegación basada en aprendizaje es la línea que siguió mi investigación posterior.
