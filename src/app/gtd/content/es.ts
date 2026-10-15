import type { GtdContent } from "./types";

export const es: GtdContent = {
  page: {
    backHome: "Volver a la página principal",
    title: "Getting Things Done",
    subtitle: "Guía completa del método GTD de David Allen",
    introTitle: "¿Qué es GTD?",
    intro: `Getting Things Done (GTD) es un método de productividad personal desarrollado por David Allen y descrito en su libro «Getting Things Done: The Art of Stress-Free Productivity» (2001). La idea fundamental es sencilla: tu mente está para tener ideas, no para guardarlas. Cuando trasladas todos tus compromisos, tareas e ideas de la cabeza a un sistema externo de confianza, liberas capacidad mental para pensar de forma creativa y concentrarte en lo que tienes entre manos.

GTD no es simplemente otra lista de tareas. Es un sistema completo para procesar todo lo que te llega – correos, ideas, encargos de compañeros, compromisos personales – y convertirlo en próximas acciones concretas.`,

    principlesTitle: "Los 5 pasos fundamentales de GTD",

    captureTitle: "1. Capturar (Capture)",
    captureContent: `El primer paso y el más importante: captura absolutamente todo lo que requiere tu atención. Cada pensamiento, tarea, idea, compromiso o dato que te ronda por la cabeza va a un único lugar – tu «bandeja de entrada» (inbox).

La bandeja de entrada puede ser física (una bandeja para papeles) o digital (una app como SweptMind). Lo fundamental:
- Captura en cuanto surja algo
- No evalúes ni clasifiques mientras capturas
- Ten la bandeja de entrada siempre a mano (lo ideal es una app en el teléfono)
- Regla: si llevas más de 2 minutos pensando en algo, anótalo

Entradas típicas que capturar:
- «Tengo que llamar al dentista»
- «Idea para un proyecto nuevo»
- «Comprar un regalo de cumpleaños»
- «Responder al correo del jefe»
- «Arreglar el grifo que gotea»`,

    clarifyTitle: "2. Aclarar (Clarify)",
    clarifyContent: `Revisa cada entrada capturada y hazte la pregunta clave: «¿Requiere acción? ¿Puedo hacer algo al respecto?»

Si la respuesta es NO:
- Elimínala (no la necesitas)
- Archívala como material de referencia (puede servirte más adelante)
- Muévela a la lista «Algún día/Quizás» (no es para ahora, pero no quieres perderla)

Si la respuesta es SÍ, la siguiente pregunta es: «¿Cuál es la próxima acción física concreta?»
- Si lleva menos de 2 minutos → hazla de inmediato (la regla de los 2 minutos)
- Si requiere varios pasos → crea un proyecto
- Si tiene que hacerla otra persona → delégala y haz el seguimiento en la lista «A la espera»
- Si tiene una fecha concreta → prográmala en tu calendario

Importante: cada tarea debe formularse como un paso físico concreto. No «Cumpleaños de mamá», sino «Comprar la tarta en Madame Gâteaux» o «Reservar restaurante para el sábado».`,

    organizeTitle: "3. Organizar (Organize)",
    organizeContent: `Coloca las tareas ya clasificadas en las listas y categorías adecuadas. GTD recomienda la siguiente estructura:

Próximas acciones (Next Actions):
Tareas físicas concretas que puedes hacer ahora mismo. Es tu lista de trabajo principal. Cada tarea debería empezar con un verbo: «Llamar...», «Escribir...», «Comprar...», «Arreglar...».

Proyectos:
Todo lo que requiere más de un paso para completarse. «Organizar una fiesta de cumpleaños» es un proyecto con pasos como encargar la tarta, invitar a la gente o decorar. Cada proyecto debe tener definida al menos una próxima acción.

A la espera (Waiting For):
Tareas que has delegado o en las que esperas una respuesta. Anota la fecha en que delegaste y de quién esperas respuesta.

Algún día/Quizás (Someday/Maybe):
Ideas y proyectos que no quieres hacer ahora, pero que tampoco quieres perder. «Aprender japonés», «Escribir un blog», «Visitar Islandia». Revísalos con regularidad.

Calendario:
Solo lo que tiene fecha y hora fijas. GTD distingue estrictamente entre «tengo que hacerlo el 15 de marzo» y «me gustaría hacerlo pronto». En el calendario solo va lo primero.

Material de referencia:
Información que no requiere acción, pero que puede ser útil – números, notas de reuniones, manuales.

Listas de contexto:
Los contextos son el corazón de GTD. En lugar de pensar «¿qué debería hacer?», miras el contexto en el que estás y este te dice qué puedes hacer. Agrupa las tareas por contexto:
- Ordenador – «Enviar las facturas», «Reservar los vuelos», «Escribir una entrada para el blog»
- Teléfono – «Llamar al dentista», «Pedir cita con el médico», «Concertar una reunión con Pedro»
- Casa – «Pasar la aspiradora por el salón», «Arreglar el grifo que gotea», «Ordenar el garaje»
- Recados – «Comprar leche y pan», «Recoger un paquete en la oficina de correos», «Comprar un regalo para mamá»
- Oficina – «Imprimir el contrato», «Hablar con el jefe sobre el proyecto», «Reponer papel en la impresora»
- Fuera – «Llevar la ropa a la tintorería», «Recoger las llaves del casero», «Salir a correr al parque»

Cómo hacerlo en SweptMind:
SweptMind te ofrece dos formas de configurar los contextos. La primera es el contexto de dispositivo – asignas cada lista o etiqueta al ordenador o al teléfono. La app detecta automáticamente en qué dispositivo la estás usando y resalta en amarillo las listas relevantes. La segunda es la ubicación – asignas un lugar concreto a una lista o etiqueta (por ejemplo, «Casa», «Oficina» o «Supermercado de la esquina»). SweptMind sigue tu ubicación y resalta en verde las listas cercanas.

Consejo: También puedes asignar contextos a las etiquetas, no solo a las listas. Una etiqueta «Compras» con la ubicación «Supermercado» resaltará todas las tareas con esa etiqueta cuando estés cerca de la tienda.`,

    engageTitle: "4. Hacer (Engage)",
    engageContent: `Ahora que todo está organizado, puedes concentrarte en hacer. GTD propone 4 criterios para elegir la siguiente tarea:

1. Contexto: ¿Dónde estás? ¿Qué tienes a mano? Si estás frente al ordenador, mira la lista Ordenador. Si estás fuera, revisa Recados. SweptMind lo automatiza con la función «Aquí y ahora».

2. Tiempo disponible: ¿Tienes 5 minutos o una hora? Elige tareas que encajen en el tiempo del que dispones.

3. Energía disponible: ¿Tienes la cabeza despejada o te pesa el cansancio? Deja las tareas exigentes para cuando tengas más energía.

4. Prioridad: De las tareas que quedan (filtradas por contexto, tiempo y energía), elige la más importante.

Principio clave: no decidas QUÉ hacer en el momento de ponerte a ello. Esa decisión ya la tomaste en los pasos 2 y 3. Ahora solo eliges y trabajas.

SweptMind va aún más lejos – las tareas que no puedes hacer ahora mismo ni siquiera las ves. Las tareas futuras (con fecha de vencimiento en el futuro) se ocultan automáticamente y solo aparecen cuando llega su momento. Tu mente no carga con cosas sobre las que de todos modos no puedes actuar. Solo ves lo que toca ahora – tal y como propone GTD.`,

    reviewTitle: "5. Revisar (Review)",
    reviewContent: `La revisión periódica es el motor de GTD. Sin ella, el sistema se desmorona. David Allen recomienda:

Revisión diaria:
- Por la mañana: consulta tu calendario y tu lista de próximas acciones
- Por la noche: captura todo lo que haya surgido durante el día

Revisión semanal (el ritual más importante de GTD):
Cada semana (idealmente el viernes por la tarde o el fin de semana) repasa TODO tu sistema:
1. Vacía todas las bandejas de entrada (correo, notas, bandeja física)
2. Revisa tu lista de próximas acciones – ¿está al día?
3. Revisa todos los proyectos – ¿tiene cada uno una próxima acción definida?
4. Revisa «A la espera» – ¿tienes que hacer seguimiento de algo?
5. Revisa «Algún día/Quizás» – ¿algo se ha vuelto actual?
6. Revisa tu calendario (la semana pasada y la siguiente)
7. Añade las tareas que falten

Una revisión semanal suele llevar entre 30 y 60 minutos. Es una inversión que se recupera con creces en tranquilidad y claridad.`,

    horizonsTitle: "Los 6 horizontes de enfoque",
    horizonsContent: `GTD define 6 niveles de perspectiva, desde las tareas concretas hasta el propósito vital:

Nivel del suelo: Próximas acciones
Tareas concretas que puedes hacer físicamente. «Llamar al cliente», «Escribir el correo».

10 000 pies: Proyectos
Resultados que requieren varios pasos. «Lanzar la nueva web», «Mudarse de casa».

20 000 pies: Áreas de responsabilidad
Áreas de tu vida que gestionas: salud, finanzas, familia, carrera profesional, hogar. Cada área genera proyectos.

30 000 pies: Objetivos a 1–2 años
¿Qué quieres lograr en un futuro cercano? «Conseguir un ascenso», «Aprender a programar», «Perder 10 kg».

40 000 pies: Visión a 3–5 años
¿Dónde quieres estar dentro de 3–5 años? Rumbo profesional, estilo de vida, formación.

50 000 pies: Propósito y principios
¿Por qué estás aquí? ¿Por qué haces lo que haces? Tus valores y tu misión en la vida.

La revisión semanal cubre sobre todo el nivel del suelo y los 10 000 pies. Revisa los horizontes superiores cada mes o cada trimestre.`,

    tipsTitle: "Consejos prácticos para empezar",
    tipsContent: `Cómo empezar con GTD:

1. El gran «vaciado mental» (Mind Sweep): Reserva 1–2 horas. Anota absolutamente todo lo que tienes en la cabeza. David Allen recomienda capturar al menos 100 elementos. Te sorprenderá cuántas cosas llevas en la cabeza.

2. Procesa tu bandeja de entrada: Revisa cada elemento con la pregunta «¿Cuál es la próxima acción?». Aplica la regla de los 2 minutos – lo que lleve menos, hazlo ya.

3. Configura tus listas: Crea las listas básicas en SweptMind – Próximas acciones, A la espera, Algún día/Quizás y las listas de contexto que necesites.

4. Establece la revisión semanal: Reserva un momento fijo en tu calendario. Es el hábito más importante de todo el método.

5. Ten paciencia: Adoptar GTD por completo lleva 2–3 meses. Empieza por lo sencillo y añade complejidad poco a poco.

Errores comunes:
- Tareas demasiado vagas (escribir «Lo de los dientes» en lugar de «Llamar al dentista») – concreta
- Olvidarse de la revisión semanal – sin ella, el sistema se viene abajo
- Tener demasiadas listas – empieza por lo sencillo
- Buscar la perfección – GTD es una herramienta, no un fin en sí mismo`,

    bookTitle: "Sobre el libro",
    bookContent: `«Getting Things Done: The Art of Stress-Free Productivity» (en español, «Organízate con eficacia») lo escribió David Allen y se publicó por primera vez en 2001. La edición actualizada de 2015 refleja la era digital. El libro ha vendido millones de ejemplares en todo el mundo y GTD se ha convertido en uno de los sistemas de productividad personal más extendidos.

David Allen trabajó como consultor de productividad para empresas y particulares. Su enfoque es único porque no se centra en fijar prioridades (como muchos otros sistemas), sino en capturar y organizar por completo todo lo que te llega – lo que lleva a una «mente como el agua» (mind like water), un estado de calma y disposición.

SweptMind está diseñado para apoyar de forma natural el flujo de trabajo GTD – desde la captura rápida de tareas y su organización en listas de contexto hasta la función «Aquí y ahora», que te ayuda a concentrarte en lo que puedes hacer ahora mismo.`,

    ctaTitle: "Empieza con GTD en SweptMind",
  },
  hiddenTasks: {
    title: "Ejemplo: tareas futuras ocultas",
    desc: "Solo ves lo que es actual. Las tareas futuras están ocultas y aparecen automáticamente.",
    visibleTasks: [
      { title: "Llamar al dentista" },
      { title: "Comprar leche" },
      { title: "Enviar las facturas" },
    ],
    futureLabel: "Futuras",
    futureTasks: [
      { title: "Preparar la presentación", date: "15 mar" },
      { title: "Renovar el pasaporte", date: "22 mar" },
      { title: "Cumpleaños de mamá – comprar un regalo", date: "5 abr" },
    ],
    listName: "Tareas",
  },
  contextExample: {
    title: "Ejemplo: cómo funcionan los contextos en SweptMind",
    step1Title: "Crea una lista con ubicación",
    step1Desc: "Crea una lista llamada «En casa» y asígnale la dirección de tu casa.",
    step2Title: "Crea una lista con contexto de dispositivo",
    step2Desc:
      "Crea una lista llamada «En el ordenador» con el contexto de dispositivo «ordenador».",
    step3Title: "«Aquí y ahora» combina ambos contextos",
    step3Desc:
      "Cuando llegas a casa y abres SweptMind en el ordenador, ves a la vez las tareas de ambas listas. No hace falta ir lista por lista – la app lo hace por ti.",
    homeTasks: ["Pasar la aspiradora por el salón", "Regar las plantas", "Arreglar el grifo"],
    computerTasks: ["Enviar las facturas", "Reservar los vuelos"],
    nearby: "Cerca",
    deviceMatch: "Tu ordenador",
    homeList: "En casa",
    computerList: "En el ordenador",
    hereAndNow: "Aquí y ahora",
  },
};
