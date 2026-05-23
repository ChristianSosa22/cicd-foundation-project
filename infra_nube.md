
Descripción del problema
Descripción del problema
Actualmente, muchas empresas cuentan con una cantidad limitada de espacios de parqueo en comparación con el número total de colaboradores. Con la implementación de modelos de trabajo híbrido (presencial y teletrabajo), la asistencia de empleados varía diariamente, lo que dificulta administrar de manera eficiente la disponibilidad de parqueos corporativos.
La falta de un sistema centralizado provoca conflictos de asignación, espacios desaprovechados y procesos manuales poco eficientes para gestionar reservas y disponibilidad.
Por ello, se propone desarrollar un Sistema de Reserva y Gestión de Parqueos Empresariales que permita a las empresas administrar de forma automatizada la disponibilidad de espacios para sus colaboradores. El sistema permitirá realizar reservas, visualizar disponibilidad en tiempo real, evitar conflictos de asignación y optimizar el uso de los parqueos disponibles, mejorando así la gestión interna y la experiencia de los colaboradores.

Actores 
Actores Primarios
Usuario/Conductor: Es la persona registrada en el sistema, la cual consulta disponibilidad, solicita y confirma reservas de espacios de parqueo.
Administrador: Gestiona el inventario de espacios y consulta reportes de ocupación y asistencia, crea y edita características del parqueo.

Actores de Soporte
Servicio de autenticación: Gestiona el registro e inicio de sesión de usuarios, controlando roles (Usuario o Administrador).
Servicio de almacenamiento en nube: Persisten los comprobantes digitales generados tras cada reserva confirmada.
Servicio de mensajería asíncrona: Ejecuta la liberación automática de espacios no confirmados tras 20 minutos y dispara las alertas de confirmación al usuario.
Servicio de notificaciones: Envía alertas y confirmaciones de reserva al conductor (correo electrónico).
Casos de uso priorizados 
1. Inicio de sesión
Como empleado, debo de acceder con un usuario previamente creado por el administrador e iniciar sesión para poder acceder al sistema de reservas.
Prioridad: P0
Criterio de éxito: El empleado inicia sesión con las credenciales asignadas por el administrador. El sistema emite un token de sesión válido con el rol correspondiente. Credenciales incorrectas retornan HTTP 401.

2. Consulta de disponibilidad en tiempo real
Como conductor, quiero consultar la disponibilidad de espacios filtrada por tipo de vehículo para saber si hay lugar antes de reservar.
Prioridad: P0
Criterio de éxito: El endpoint GET /availability retorna el estado de cada espacio (Disponible/Reservado/Ocupado) en tiempo real, respetando restricciones de rol del conductor.
3. Reserva de espacio
Como conductor, quiero reservar un espacio y recibir un comprobante digital para garantizar mi lugar.
Prioridad: P0
Criterio de éxito: El endpoint POST /reservar asigna el espacio atómicamente previniendo double-booking. El conductor recibe un comprobante QR en PDF por correo en menos de 30 segundos.
4. Gestor de usuarios para administrador
Como administrador, quiero gestionar los colaboradores registrados en el sistema, incluyendo crear, editar y desactivar cuentas y asignar roles. Controlar qué usuarios pueden reservar y qué tipo de espacios tienen permitido ocupar. 
Prioridad: P0
Criterio de éxito: El administrador crea, edita y desactiva cuentas asignando roles (operativo, ejecutivo, visitante frecuente). Un usuario desactivado pierde acceso inmediatamente pero conserva su historial. Ningún colaborador puede modificar su propio rol ni el de terceros.

5. Gestor de parqueos para administrador
Como administrador, quiero configurar los espacios de parqueo disponibles, definiendo qué tipo de vehículo es permitido y qué roles de colaborador pueden ocuparlos, para que el sistema asigne reservas respetando las restricciones operativas de la empresa.
Prioridad: P0
Criterio de éxito: El administrador crea y edita espacios asignando identificador, tipo de vehículo y roles autorizados. Puede marcar espacios como inactivos por rango de fechas, quedando invisibles para reserva. Un colaborador con rol no autorizado no puede reservar un espacio restringido aunque esté disponible. 
6. Liberación automática por no confirmación
Como sistema, quiero liberar automáticamente espacios no confirmados para optimizar la disponibilidad.
Prioridad: P1
Criterio de éxito: Si el conductor no confirma en 20 minutos, el espacio vuelve a Disponible de forma asíncrona y se notifica al conductor antes de la liberación.
7. Dashboard de ocupación para administrador  
Como administrador, quiero visualizar un dashboard de ocupación para monitorear el estado del parqueo en tiempo real.
Prioridad: P2
Criterio de éxito: El dashboard presenta de forma gráfica el conteo de espacios en cada estado (Disponible, Reservado, Ocupado) actualizado en intervalos no mayores a 30 segundos. El administrador puede distinguir la ocupación por tipo de vehículo (moto/carro) sin necesidad de consultas adicionales.
8. Gestión de tarifas
Como administrador, quiero establecer precios diferenciados por tipo de vehículo.
Prioridad: P2
Criterio de éxito: El administrador define y actualiza tarifas para moto y carro. El cambio es inmediato y queda registrado con marca de tiempo para auditoría.

Funcionalidades específicas del proyecto:
1. Reserva con validación de placa registrada
El sistema solo permite reservar si la placa del vehículo está previamente registrada en el perfil del colaborador. No cualquier persona con cuenta puede reservar — tiene que haber un vehículo vinculado y aprobado. Un colaborador puede tener más de una placa (ej. carro y moto), pero solo puede tener una reserva activa por día.
2. Asignación de tipo de espacio por perfil de colaborador
El Admin puede categorizar colaboradores: ejecutivo, operativo, visitante frecuente. Cada categoría tiene acceso a un pool de espacios distinto. Un colaborador operativo no puede reservar un espacio marcado como ejecutivo aunque esté disponible. Esto refleja jerarquías reales que las empresas ya manejan manualmente hoy.
3. Historial de asistencia vehicular por colaborador
Dado que cada reserva está vinculada a un colaborador identificado, el sistema genera automáticamente un registro de qué días llegó en vehículo, a qué hora confirmó su llegada y cuánto tiempo ocupó el espacio. El admin puede exportar esto. Es un diferenciador fuerte porque las empresas hoy no tienen visibilidad de esto.
4. Liberación anticipada voluntaria
El colaborador puede liberar su espacio antes de la hora de salida desde la app (ej. salió temprano). Esto actualiza disponibilidad en tiempo real y permite que otro colaborador tome ese espacio el mismo día. Es distinto al timeout automático de 20 minutos — esta es una acción explícita del usuario que beneficia al resto.
5. Política de cancelación con penalización configurable
Si un colaborador cancela una reserva menos de N horas antes (configurable por el admin), el sistema lo registra como "cancelación tardía". Acumular X cancelaciones tardías en un mes puede bloquear temporalmente la capacidad de reservar. Esto desincentiva el comportamiento de reservar por precaución sin intención real de usar el espacio.
Mockups del FE
Se diseñaron 7 pantallas low-fi que cubren los casos de uso priorizados (P0, P1 y P2). Los wireframes completos se encuentran en el Anexo A.
Mapeo a conceptos del curso
Esta sección vincula las necesidades operativas de nuestro sistema de parqueos con el stack tecnológico del curso, vincula los componentes con las funcionalidades específicas que nuestro Sistema de Reservas y Disponibilidad de Parqueos va a hacer.

Componente del curso 
Cómo lo ejercita su proyecto 
Cómputo (API)
Endpoint GET/availability consulta disponibilidad de parqueo filtrando por tipo de vehículo (moto, carro) del lado del cliente.

Endpoint POST/reservar ejecuta la lógica de validación de disponibilidad y asigna espacios en ese mismo instante.
Base de datos
Inventario de espacios con estados Libre/Ocupado y almacenamiento de datos de usuario registrados(perfil de datos) + sus placas vehiculares. 
Almacenamiento de archivos
Comprobantes digitales(en PDF/PNG) de finalización de reserva del parqueo.
Hosting de archivos estáticos; como imágenes de referencia de las entradas de los parqueos. Ayuda visual para el conductor.
Procesamiento asíncrono
Si el usuario no confirma digitalmente su ingreso tras 15 minutos de la hora pactada, un Worker asíncrono procesa la cancelación, libera el cupo en la base de datos y lo marca el espacio de “Reservado” a “Disponible”.
Red
El sistema expone únicamente el API Gateway a internet público vía HTTPS. Los servicios internos (base de datos, worker de liberación asíncrona) residen en subredes privadas sin acceso directo desde el exterior. 
Seguridad
Roles de IAM ; El "Admin" solo puede ver reportes y gestionar; el "User" solo genera reservas.
Cifrado de datos sensibles (ej. license_plate_number_user y user_phone_number ). 
Observabilidad
Alarma de saturación: notificación automática si la disponibilidad de espacios llega a cero 



Scope (in/out)
Declaración explícita de qué hará el sistema y qué queda fuera del diseño.
In: 
Gestión de identidad(Auth); Para el registro de usuarios al sistema. Mejora el control de usuarios que ingresan al sistema y los permisos que tiene(User/Admin)
Búsqueda de espacios disponibles; Muestra los espacios disponibles de parqueo de la empresa. 
Gestión automática de reservas; Mediante una reserva de espacio en tiempo real que asegure atomicidad de espacio(ej. para que 2 o más personas no reserven el mismo espacio al mismo tiempo). El sistema rechaza a uno y rechaza al otro por orden de reserva. 
Liberación asíncrona; Cancelación automática por no confirmación el dia programado (asíncrono), con una espera máxima de 20 minutos y alertas de confirmación, entonces, liberar espacio antes ocupado.
Generación de comprobantes de confirmación de reservas; Generación de comprobante único digital e inalterable para el acceso. El sistema genera un QR en PDF que se guarda en el almacenamiento de la nube. 
Dashboard interactivos de Disponibilidad/Ocupación; 
Un cliente podrá 
Consultar disponibles(tendrá mensajes en la UI de “Ocupado”/”Disponible”), 
Solicitar reserva, confirmar reserva.
Marcar en la app un botón de “Ocupar Parqueo”, y el estado en la BD cambia a "Ocupado" 
Para el Admin, podrá ver
En su inventario(mediante algún tipo de gráfico) los espacios disponibles, espacios reservados y actualmente ocupados.
Establecer el precio del parqueo por moto y carro. 
Que usuarios han reservado y que días (brinda control de asistencia)
Respecto a la disponibilidad del parqueo, se usarán cantidad de parqueos disponibles(por motivos prácticos y sencillez) para ubicar qué número de parqueo es el que se encuentra como “Ocupado”/”Disponible”.
Out: 
Integración física con hardware.
Procesamiento de pagos reales; Por tema de complejidad, y costos.
App Móvil Nativa
Preguntas abiertas
¿Qué mecanismo concreto garantiza la atomicidad en la asignación de espacios? Se menciona que "el sistema rechaza a uno por orden de reserva", pero no se especifica si se usará locking optimista, pesimista, transacciones ACID, o algún mecanismo de cola (queue). 

¿Cómo se maneja el race condition a nivel de base de datos cuando dos requests llegan en el mismo milisegundo?

¿Qué tecnología ejecuta la liberación automática a los 20 minutos? No se define si es un cron job, un mensaje en una cola (SQS, RabbitMQ), un scheduled function (Cloud Scheduler, Lambda EventBridge), o un timer en base de datos. Cada opción tiene implicaciones de confiabilidad distintas. 

¿Cómo integraremos una función más eficaz cuando el cliente llegue “verdaderamente” al parqueo más que solo un clic de “Ocupar parqueo”? ¿Un IoT como sensor de parqueo sería suficiente?







Anexos 
Anexo A: Mockups
Pantalla 1 - Registro e inicio de sesión: Esta pantalla cubre el acceso al sistema. Se presentan dos vistas: el formulario de inicio de sesión para usuarios existentes y el formulario de registro para nuevos usuarios.

Pantalla 2 - Consulta de disponibilidad en tiempo real: Esta pantalla permite al conductor visualizar el estado actual de los espacios de parqueo. Se presenta una cuadrícula con cada espacio identificado por número, mostrando su estado mediante código de color: verde (Disponible), rojo (Ocupado) y amarillo (Reservado). El conductor puede filtrar por tipo de vehículo (moto/carro) antes de proceder a reservar.

Pantalla 3 - Flujo de reserva: Guía al conductor a través del proceso de reserva de un espacio seleccionado. Se muestran los detalles del espacio elegido, los datos del vehículo registrado y la hora estimada de llegada. El sistema valida la disponibilidad de forma atómica al momento de confirmar, previniendo el double-booking. Al completarse, se genera el comprobante QR.

Pantalla 4 - Comprobante de reserva con código QR: Una vez confirmada la reserva, el sistema genera y presenta al conductor un comprobante digital único con código QR. Este comprobante queda disponible para descarga inmediata en formato PDF y es enviado al correo registrado del conductor. El código QR es inalterable y sirve como credencial de acceso al parqueo.


Pantalla 5 - Dashboard del administrador: Esta pantalla provee al administrador una visión general en tiempo real del estado del parqueo. Se presentan métricas de ocupación mediante gráficos y contadores por estado, diferenciados por tipo de vehículo. 

Pantalla 6 - Gestión de precios por tipo de vehículo: Esta pantalla permite al administrador configurar y actualizar las tarifas diferenciadas por tipo de vehículo. Cada cambio queda registrado en el historial, para fines de auditoría.



Pantalla 7- Historial de reservas por usuario y fecha: Esta pantalla permite al administrador consultar y auditar el registro completo de reservas del sistema. La tabla es filtrable por usuario y rango de fechas, mostrando para cada entrada el espacio asignado, tipo de vehículo, estado final y marca de tiempo. Los registros son inmutables; ningún rol puede eliminarlos.


Anexo B — Uso de IA
Lo que le pedimos a la IA:
"Actúa como un Arquitecto de Soluciones Cloud. Tengo un sistema de reserva de parqueos en Guatemala para un proyecto. Ayúdame a:
Redactar el cierre del Resumen Ejecutivo enfocándose en qué procesos se van a automatizar (evitar double-booking, liberación de espacios).
Generar ejemplos específicos para una tabla que mapee las funcionalidades del sistema con los 7 componentes obligatorios del curso (Cómputo, DB, Almacenamiento, Red, Asíncrono, Seguridad, Observabilidad).
Asegúrate de que los ejemplos no sean genéricos (no digas solo 'hacer login') sino que mencionen procesos reales de un parqueo inteligente."
Nuestra reflexión:
Qué aceptamos: La estructura de la tabla y los ejemplos de procesos asíncronos, ya que es un "trade-off" interesante para el negocio.
Qué editamos: Editamos ejemplos de procesos asíncronos, seguridad, red, observabilidad, Almacenamiento de archivos.
Qué descartamos: Sugerencias de la IA sobre algunas funciones de red, como aislamiento de la base de datos y la lógica de negocio.
Prompts utilizados:
"Actúa como Product Owner y genera una lista de Scope In/Out para un sistema de parqueos inteligente enfocado en un curso de Infraestructura Cloud, priorizando funcionalidades que usen bases de datos y colas de mensajes."
Reflexión del equipo:
Qué aceptamos: La estructura de "In/Out" sugerida por la IA, especialmente la idea de dejar fuera la integración física (sensores) y el desarrollo para una app móvil para no complicar el alcance técnico del curso.
Qué editamos: Todas las sugerencias, ajustándose a un desarrollo más práctico y sencillo.
Qué descartamos: La IA sugirió incluir "Machine Learning para predicción de demanda"; lo movimos a Out-of-Scope inmediatamente para mantener el proyecto ejecutable en 3 meses.




