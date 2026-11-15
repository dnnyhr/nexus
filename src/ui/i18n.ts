// All visible text in one place, in Spanish and English. Plain language first: the game is
// for ages 7-12, and any technical term gets a short explanation where it appears.

export type Lang = 'es' | 'en';

const STRINGS = {
  lifeSupport: { es: 'Soporte vital', en: 'Life support' },
  o2: { es: 'Oxígeno', en: 'Oxygen' },
  water: { es: 'Agua', en: 'Water' },
  food: { es: 'Comida', en: 'Food' },
  energy: { es: 'Energía', en: 'Power' },
  shield: { es: 'Blindaje', en: 'Shielding' },
  materials: { es: 'Materiales', en: 'Materials' },
  regolith: { es: 'Regolito', en: 'Regolith' },
  crewHealth: { es: 'Salud', en: 'Health' },
  dayLeft: { es: 'Día · quedan {m} min', en: 'Day · {m} min left' },
  nightLeft: { es: 'Noche · quedan {m} min', en: 'Night · {m} min left' },

  station: { es: 'Estación', en: 'Station' },
  greenhouse: { es: 'Invernadero', en: 'Greenhouse' },
  processor: { es: 'Procesador', en: 'Processor' },
  solarMast: { es: 'Panel solar', en: 'Solar mast' },
  battery: { es: 'Batería', en: 'Battery' },
  collectorRobot: { es: 'Robot recolector', en: 'Collector robot' },
  harvesterRobot: { es: 'Robot cosechador', en: 'Harvester robot' },
  shieldBerm: { es: 'Berma de blindaje', en: 'Shielding berm' },
  rover: { es: 'Rover de expedición', en: 'Expedition rover' },
  antenna: { es: 'Antena de comunicaciones', en: 'Comms antenna' },
  lander: { es: 'Módulo de aterrizaje', en: 'Lander' },

  level: { es: 'Nivel {n}', en: 'Level {n}' },
  count: { es: '{n} construidos', en: '{n} built' },
  build: { es: 'Construir', en: 'Build' },
  upgrade: { es: 'Mejorar', en: 'Upgrade' },
  maxed: { es: 'Nivel máximo', en: 'Max level' },
  needMaterials: { es: 'Te faltan {n} materiales', en: 'You need {n} more materials' },
  needStation: { es: 'Primero mejora la estación', en: 'Upgrade the station first' },
  needGreenhouse: { es: 'Primero construye el invernadero', en: 'Build the greenhouse first' },
  close: { es: 'Cerrar', en: 'Close' },

  goShelter: { es: 'Ir al refugio', en: 'Go to shelter' },
  leaveShelter: { es: 'Salir del refugio', en: 'Leave shelter' },
  sheltered: { es: 'Tripulación en el refugio: robots y procesador detenidos', en: 'Crew in the shelter: robots and processor stopped' },

  plantWater: { es: 'Agua', en: 'Water' },
  plantLight: { es: 'Luz', en: 'Light' },
  plantTemp: { es: 'Temperatura', en: 'Temperature' },
  growth: { es: 'Crecimiento', en: 'Growth' },
  stress: { es: 'Estrés', en: 'Stress' },
  optimal: { es: 'Mantén cada valor entre 40 y 60', en: 'Keep every value between 40 and 60' },
  irrigate: { es: 'Regar', en: 'Water' },
  heat: { es: 'Calentar', en: 'Heat' },
  cool: { es: 'Enfriar', en: 'Cool' },
  harvest: { es: 'Cosechar', en: 'Harvest' },
  replant: { es: 'Replantar', en: 'Replant' },
  plantDead: { es: 'La planta murió. Replanta para seguir.', en: 'The plant died. Replant to continue.' },
  plantReady: { es: '¡Lista para cosechar!', en: 'Ready to harvest!' },

  powerTitle: { es: 'Reparto de energía', en: 'Power use' },
  powerHint: {
    es: 'En la oscuridad los paneles no producen. Apaga lo que no necesites para que la batería dure hasta que vuelva el Sol.',
    en: 'In the dark the solar masts make no power. Turn off what you don’t need so the battery lasts until the Sun is back.',
  },
  heating: { es: 'Calefacción', en: 'Heating' },
  robots: { es: 'Robots', en: 'Robots' },
  growLights: { es: 'Luces de cultivo', en: 'Grow lights' },
  on: { es: 'Encendido', en: 'On' },
  off: { es: 'Apagado', en: 'Off' },
  shortage: { es: 'Falta energía: se apagaron sistemas', en: 'Not enough power: systems shut down' },

  tapGround: { es: 'WASD para moverte · Espacio para saltar · Clic derecho para excavar · F para usar', en: 'WASD to move · Space to hop · Right click to dig · F to use' },
  tapGroundTouch: { es: 'Joystick para moverte · Saltar · Excavar · toca el aviso blanco para usar', en: 'Joystick to move · Hop · Dig · tap the white prompt to use' },
  jump: { es: 'Saltar', en: 'Hop' },
  bag: { es: 'Bolsa', en: 'Bag' },
  upgradeBag: { es: 'Mejorar bolsa', en: 'Upgrade bag' },
  bagInfo: { es: 'Bolsa nivel {n}: guarda {cap} de regolito y junta {dig} por excavación.', en: 'Bag level {n}: holds {cap} regolith and digs {dig} at a time.' },
  bagFull: { es: 'Bolsa llena · llévala al procesador', en: 'Bag full · take it to the processor' },
  deliverX: { es: 'Depositar regolito', en: 'Deliver regolith' },
  robotDelivered: { es: 'Robot: +{n} regolito al procesador', en: 'Robot: +{n} regolith to the processor' },
  delivered: { es: '+{n} regolito al procesador', en: '+{n} regolith to the processor' },
  hopperFull: { es: 'El procesador está lleno', en: 'The processor is full' },
  dig: { es: 'Excavar', en: 'Dig' },
  use: { es: 'Usar: {x}', en: 'Use: {x}' },
  getCloser: { es: 'Acércate para usarlo', en: 'Walk closer to use it' },
  busy: { es: 'Trabajando…', en: 'Working…' },
  sender: { es: 'Radio · Comandante Rivera, Control Tierra', en: 'Radio · Commander Rivera, Mission Control' },
  menuBuild: { es: 'Construir', en: 'Build' },
  menuPower: { es: 'Energía', en: 'Power' },
  procRunning: { es: 'Procesando: convierte regolito en oxígeno y materiales.', en: 'Running: turns regolith into oxygen and materials.' },
  procNoRegolith: { es: 'Detenido: no hay regolito. Toca el suelo o usa un robot.', en: 'Stopped: no regolith. Tap the ground or use a robot.' },
  procNoPower: { es: 'Detenido: no hay energía suficiente.', en: 'Stopped: not enough power.' },
  procOff: { es: 'Apagado.', en: 'Switched off.' },
  procSheltered: { es: 'Detenido: la tripulación está en el refugio.', en: 'Stopped: the crew is in the shelter.' },
  factRegolith: { es: 'Dato real: más del 40 % del peso del regolito lunar es oxígeno atrapado en minerales.', en: 'Real fact: over 40% of lunar regolith by mass is oxygen locked in minerals.' },
  factNight: { es: 'Dato real: en las crestas del polo sur lunar, donde aterrizará Artemis, el Sol ilumina más del 80 % del año. La oscuridad es corta y poco frecuente, pero llega: guarda batería. Cerca del ecuador, en cambio, la noche dura unos 14 días terrestres.', en: 'Real fact: on the ridges near the lunar south pole, where Artemis will land, the Sun shines more than 80% of the year. Darkness is short and rare, but it comes: keep battery. Near the equator, a lunar night lasts about 14 Earth days.' },
  factPolarSun: { es: 'Dato real: en el polo sur lunar el Sol da vueltas cerca del horizonte. Por eso los paneles son verticales y lo siguen.', en: 'Real fact: at the lunar south pole the Sun circles near the horizon. That is why the panels stand upright and follow it.' },
  factGreenhouse: { es: 'Dato real: en la Estación Espacial la NASA cultiva plantas con luces LED y riego controlado.', en: 'Real fact: on the Space Station, NASA grows plants under LED lights with controlled watering.' },
  factShield: { es: 'Dato real: la Luna no tiene atmósfera ni campo magnético que frene la radiación del Sol. Una capa de regolito sirve de escudo.', en: 'Real fact: the Moon has no atmosphere or magnetic field to stop the Sun’s radiation. A layer of regolith works as a shield.' },
  solarNow: { es: 'Produce {n} de energía por segundo.', en: 'Making {n} power per second.' },
  solarNight: { es: 'De noche no produce energía.', en: 'Makes no power at night.' },
  batteryCharge: { es: 'Carga: {p} %', en: 'Charge: {p}%' },
  capacity: { es: 'Capacidad: {n}', en: 'Capacity: {n}' },
  stationInfo: { es: 'Aquí vive la tripulación. Mejorarla agrega módulos y más almacenamiento.', en: 'The crew lives here. Upgrading adds modules and more storage.' },
  shieldLevel: { es: 'Berma de regolito: {n} de 3', en: 'Regolith berm: {n} of 3' },
  upgradeShield: { es: 'Reforzar berma', en: 'Reinforce berm' },
  robotsInfo: { es: 'Los robots trabajan solos, pero gastan energía.', en: 'Robots work on their own, but they use power.' },
  buildAnother: { es: 'Construir otro', en: 'Build another' },
  roverInfo: { es: 'Súbete con F y manéjalo con WASD o el joystick. En el cráter oscuro hay hielo de agua.', en: 'Get in with F and drive with WASD or the joystick. The dark crater holds water ice.' },
  board: { es: 'Subir al rover', en: 'Get in the rover' },
  unboard: { es: 'Bajar del rover', en: 'Get out of the rover' },
  scoopIce: { es: 'Recoger hielo', en: 'Scoop ice' },
  unloadIce: { es: 'Descargar hielo', en: 'Unload ice' },
  iceGain: { es: '+{n} hielo en el rover', en: '+{n} ice in the rover' },
  iceFull: { es: 'Rover lleno de hielo · vuelve a la base', en: 'Rover full of ice · head back to base' },
  waterGain: { es: '+{n} agua para la base', en: '+{n} water for the base' },
  m_ice_title: { es: 'Hielo', en: 'Ice' },
  m_ice_goal: { es: 'Trae hielo del cráter oscuro {have}/{need}', en: 'Bring ice from the dark crater {have}/{need}' },
  m_ice_text: { es: 'Dato real: en los cráteres del polo sur que nunca reciben sol hay hielo de agua. Súbete al rover, maneja hasta el cráter oscuro, recoge hielo y tráelo a la base: lo convertiremos en agua.', en: 'Real fact: craters at the south pole that never see sunlight hold water ice. Get in the rover, drive to the dark crater, scoop ice and bring it back: we will turn it into water.' },
  antennaInfo: { es: 'Recibe los mensajes de Control Tierra. La señal tarda 1,3 segundos en llegar desde la Tierra.', en: 'Receives Mission Control messages. The signal takes 1.3 seconds to arrive from Earth.' },
  landerInfo: { es: 'La nave en la que llegaste a la Luna.', en: 'The ship that brought you to the Moon.' },
  noWater: { es: 'No hay agua suficiente', en: 'Not enough water' },
  noEnergy: { es: 'No hay energía suficiente', en: 'Not enough power' },
  notReady: { es: 'Todavía no está lista', en: 'Not ready yet' },
  regolithGain: { es: '+{n} regolito', en: '+{n} regolith' },
  storageFull: { es: 'Depósito lleno', en: 'Storage full' },
  generation: { es: 'Producción', en: 'Making' },
  demand: { es: 'Consumo', en: 'Using' },
  perSecond: { es: '{n}/s', en: '{n}/s' },
  built: { es: '¡Construido!', en: 'Built!' },
  upgraded: { es: '¡Mejorado a nivel {n}!', en: 'Upgraded to level {n}!' },
  harvested: { es: '+{n} comida', en: '+{n} food' },
  notBuilt: { es: 'Sin construir', en: 'Not built' },

  // ---- Missions: radio text, short title (timeline) and objective (with progress) ----
  m_antenna_title: { es: 'Antena', en: 'Antenna' },
  m_antenna_goal: { es: 'Construye la antena', en: 'Build the antenna' },
  m_antenna_text: { es: 'Te damos la bienvenida a la Luna, {player}. Sin antena no podemos hablar con la Tierra. Camina hasta el anillo naranja y constrúyela.', en: 'Welcome to the Moon, {player}. Without an antenna we can’t talk to Earth. Walk to the orange ring and build it.' },
  m_dig_title: { es: 'Regolito', en: 'Regolith' },
  m_dig_goal: { es: 'Excava regolito {have}/{need}', en: 'Dig regolith {have}/{need}' },
  m_dig_text: { es: 'Aquí el comandante Rivera, desde la Tierra. ¡Te escuchamos, {player}! Para construir necesitas regolito: el polvo y las rocas de la Luna. Excava con clic derecho (o el botón Excavar) hasta llenar tu bolsa.', en: 'Commander Rivera here, from Earth. We hear you, {player}! To build you need regolith: the Moon’s dust and rocks. Dig with right click (or the Dig button) until your bag is full.' },
  m_processor_title: { es: 'Procesador', en: 'Processor' },
  m_processor_goal: { es: 'Construye el procesador', en: 'Build the processor' },
  m_processor_text: { es: 'Muy bien. Ahora construye el procesador: saca oxígeno y materiales del regolito. Más del 40 % de su peso es oxígeno.', en: 'Well done. Now build the processor: it gets oxygen and materials out of regolith. Over 40% of its weight is oxygen.' },
  m_materials_title: { es: 'Materiales', en: 'Materials' },
  m_materials_goal: { es: 'Lleva regolito al procesador · {have}/{need} materiales', en: 'Bring regolith to the processor · {have}/{need} materials' },
  m_materials_text: { es: 'El procesador solo trabaja con el regolito que le lleves. Deposita tu bolsa y vuelve por más hasta fabricar 15 materiales.', en: 'The processor only works with the regolith you bring it. Empty your bag into it and fetch more until it makes 15 materials.' },
  m_solar_title: { es: 'Energía', en: 'Power' },
  m_solar_goal: { es: 'Instala un panel solar', en: 'Put up a solar mast' },
  m_solar_text: { es: 'Necesitamos más energía. Instala un panel solar. Aquí el Sol da vueltas cerca del horizonte: por eso los paneles son altos y lo siguen.', en: 'We need more power. Put up a solar mast. Here the Sun circles near the horizon, so the panels are tall and follow it.' },
  m_habitat_title: { es: 'Hábitat', en: 'Habitat' },
  m_habitat_goal: { es: 'Levanta el hábitat', en: 'Build the habitat' },
  m_habitat_text: { es: 'Hora de tener casa: levanta el hábitat. Te protegerá y guardará más recursos.', en: 'Time for a home: build the habitat. It protects you and stores more supplies.' },
  m_robot_title: { es: 'Robot', en: 'Robot' },
  m_robot_goal: { es: 'Construye un robot recolector', en: 'Build a collector robot' },
  m_robot_text: { es: 'Excavar a mano cansa. Construye un robot recolector: trabajará solo, pero gasta energía.', en: 'Digging by hand is tiring. Build a collector robot: it works on its own, but it uses power.' },
  m_greenhouse_title: { es: 'Invernadero', en: 'Greenhouse' },
  m_greenhouse_goal: { es: 'Construye el invernadero', en: 'Build the greenhouse' },
  m_greenhouse_text: { es: 'Vas a necesitar comida. Construye el invernadero.', en: 'You’ll need food. Build the greenhouse.' },
  m_harvest_title: { es: 'Cosecha', en: 'Harvest' },
  m_harvest_goal: { es: 'Cosecha tu primera planta', en: 'Harvest your first plant' },
  m_harvest_text: { es: 'Las plantas necesitan agua, luz y temperatura entre 40 y 60. Entra al invernadero y cuida tu primera planta hasta cosecharla.', en: 'Plants need water, light and temperature between 40 and 60. Use the greenhouse and look after your first plant until you can harvest it.' },
  m_battery_title: { es: 'Batería', en: 'Battery' },
  m_battery_goal: { es: 'Construye una batería', en: 'Build a battery' },
  m_battery_text: { es: 'Aquí en el polo sur el Sol casi nunca se oculta, pero a veces las montañas lo tapan y llega la oscuridad: los paneles no producen. Construye una batería para esos periodos.', en: 'Here at the south pole the Sun almost never sets, but sometimes the mountains block it and darkness comes: the panels make no power. Build a battery for those periods.' },
  m_shield_title: { es: 'Blindaje', en: 'Shielding' },
  m_shield_goal: { es: 'Refuerza la berma del hábitat', en: 'Reinforce the habitat’s berm' },
  m_shield_text: { es: 'La Luna no tiene atmósfera que frene la radiación del Sol. Usa el hábitat y refuerza su berma de regolito.', en: 'The Moon has no atmosphere to stop the Sun’s radiation. Use the habitat and reinforce its regolith berm.' },
  m_grow_title: { es: 'Crecer', en: 'Grow' },
  m_grow_goal: { es: 'Mejora el hábitat a nivel 2', en: 'Upgrade the habitat to level 2' },
  m_grow_text: { es: '¡Gran trabajo! Mejora el hábitat al nivel 2 para que la base crezca.', en: 'Great work! Upgrade the habitat to level 2 so the base can grow.' },
  m_colony_title: { es: 'Colonia', en: 'Colony' },
  m_colony_goal: { es: 'Haz crecer la base · nivel {have}', en: 'Grow the base · level {have}' },
  m_colony_text: { es: 'Sigue mejorando la base hasta convertirla en una colonia estable. Después: Marte.', en: 'Keep upgrading the base until it is a stable colony. Then: Mars.' },
  missionN: { es: 'Misión {n}', en: 'Mission {n}' },
  missionDone: { es: 'Misión cumplida · la Tierra envía {n} materiales', en: 'Mission complete · Earth sends {n} materials' },
  receiving: { es: 'Recibiendo transmisión…', en: 'Receiving transmission…' },
  landerComputer: { es: 'Computadora del módulo', en: 'Lander computer' },
  radioFrom: { es: 'Radio · Comandante Rivera · Tierra', en: 'Radio · Commander Rivera · Earth' },
  buildX: { es: 'Construir {x}', en: 'Build {x}' },
  useX: { es: 'Usar {x}', en: 'Use {x}' },
  keySpace: { es: 'Espacio', en: 'Space' },
  keyUse: { es: 'F', en: 'F' },
  lunarDay: { es: 'Luz solar', en: 'Sunlight' },
  lunarNight: { es: 'Oscuridad', en: 'Darkness' },
  ok: { es: 'Entendido', en: 'Got it' },
  gameTitle: { es: 'NEXUS: Último Horizonte', en: 'NEXUS: Last Horizon' },
  rotatePhone: { es: 'Gira el teléfono para jugar en horizontal', en: 'Turn your phone sideways to play' },
  profile: { es: 'Perfil', en: 'Profile' },
  fullscreen: { es: 'Pantalla completa', en: 'Full screen' },
  exitFullscreen: { es: 'Salir de pantalla completa', en: 'Exit full screen' },
  fullscreenIos: {
    es: 'En iPhone, Safari no deja poner una página en pantalla completa. Toca Compartir y luego "Agregar a inicio", y abre NEXUS desde ese ícono: se verá en pantalla completa.',
    en: 'On iPhone, Safari cannot put a page in full screen. Tap Share, then "Add to Home Screen", and open NEXUS from that icon: it will fill the screen.',
  },
  profileName: { es: 'Tu nombre de astronauta', en: 'Your astronaut name' },
  profileHint: { es: 'Así te llamarán por radio desde la Tierra.', en: 'This is what Earth will call you on the radio.' },
  defaultName: { es: 'Astronauta', en: 'Astronaut' },
  saveName: { es: 'Guardar', en: 'Save' },
  nameAckRadio: { es: 'Recibido, {player}. Así te llamaremos desde la Tierra.', en: 'Copy that, {player}. That is what we will call you from Earth.' },
  nameAckLander: { es: 'Nombre registrado: {player}.', en: 'Name logged: {player}.' },
  rescueNews: {
    es: 'Aquí Rivera. La base está en emergencia y la tripulación corre peligro: te enviamos una cápsula de carga con oxígeno, agua, comida, energía y {mat} materiales. Consejo: repara primero lo que da energía, guarda batería para la noche y entra al refugio en las tormentas.',
    en: 'Rivera here. The base is in an emergency and the crew is in danger: we are sending a cargo pod with oxygen, water, food, power and {mat} materials. Tip: repair what makes power first, keep battery for the night and get in the shelter during storms.',
  },
  rescueLanded: { es: 'Cápsula de emergencia · +{mat} materiales', en: 'Emergency pod · +{mat} materials' },
  welcomeBack: {
    es: 'Hola de nuevo, {player}. Estuviste fuera {time}. Mientras tanto la base produjo {mat} materiales y {o2} de oxígeno{harvest}.{plant}',
    en: 'Welcome back, {player}. You were away {time}. Meanwhile the base made {mat} materials and {o2} oxygen{harvest}.{plant}',
  },
  welcomePlant: { es: ' Tu planta tiene {stress} % de estrés: revísala.', en: ' Your plant is at {stress}% stress: check on it.' },
  welcomeHarvest: { es: ', y se cosecharon {n} plantas', en: ', and {n} plants were harvested' },
  newGame: { es: 'Nueva partida', en: 'New game' },
  newGameConfirm: { es: '¿Empezar una partida nueva? Se borrará la actual.', en: 'Start a new game? The current one will be erased.' },
  saved: { es: 'Partida guardada', en: 'Game saved' },
  impact: { es: '¡Impacto de micrometeorito!', en: 'Micrometeoroid impact!' },
  stormTitle: { es: 'Tormenta solar', en: 'Solar storm' },
  stormArrives: { es: 'Llega en {t}', en: 'Arrives in {t}' },
  stormActive: { es: 'Activa · {t}', en: 'Active · {t}' },
  stormDose: { es: 'Dosis {d} mSv', en: 'Dose {d} mSv' },
  enterShelter: { es: 'Entrar al refugio', en: 'Enter the shelter' },
  runToShelter: { es: 'Corre al refugio', en: 'Run to the shelter' },
  inShelter: { es: 'En el refugio · protegido {p} %', en: 'In the shelter · {p}% protected' },
  stormWarnFlare: {
    es: '¡Alerta! El {date} el Sol lanzó una fulguración clase {cls}, registrada por NASA DONKI. Recreamos sus partículas: llegan en {s} segundos. Corre al {shelter} y entra al refugio.',
    en: 'Alert! On {date} the Sun released a class {cls} flare, recorded by NASA DONKI. We are recreating its particles: they arrive in {s} seconds. Run to the {shelter} and get in the shelter.',
  },
  stormWarnLive: {
    es: '¡Alerta real! Los satélites GOES miden ahora {flux} pfu de protones: nivel de tormenta S{n}. Corre al {shelter} y entra al refugio.',
    en: 'Real alert! The GOES satellites are measuring {flux} pfu of protons right now: storm level S{n}. Run to the {shelter} and get in the shelter.',
  },
  stormEnd: {
    es: 'La tormenta pasó. Dosis recibida en esta misión: {d} mSv. Dato real: en la Estación Espacial un astronauta recibe cerca de 0,5 mSv al día.',
    en: 'The storm is over. Dose received this mission: {d} mSv. Real fact: on the Space Station an astronaut gets about 0.5 mSv a day.',
  },
  habitatWord: { es: 'hábitat', en: 'habitat' },
  landerWord: { es: 'módulo de aterrizaje', en: 'lander' },
  nasaData: { es: 'Datos NASA', en: 'NASA data' },
  dataTitle: { es: 'Datos reales que usa el juego', en: 'Real data used by the game' },
  dataLive: { es: 'En vivo · consultado {t}', en: 'Live · fetched {t}' },
  dataSnapshot: { es: 'Sin conexión · copia guardada del {t} (no es en vivo)', en: 'Offline · saved copy from {t} (not live)' },
  dataProtons: { es: 'Protones ≥10 MeV (GOES): {f} pfu · nivel S{n}', en: 'Protons ≥10 MeV (GOES): {f} pfu · level S{n}' },
  dataFlares: { es: 'Fulguraciones recientes (NASA DONKI)', en: 'Recent solar flares (NASA DONKI)' },
  dataShower: { es: 'Lluvia de meteoros hoy: {x}', en: 'Meteor shower today: {x}' },
  none: { es: 'ninguna', en: 'none' },
  dataHow: {
    es: 'Las tormentas del juego recrean estas fulguraciones reales: su clase decide la fuerza y el tiempo de aviso. Si GOES mide nivel S1 o más, la tormenta es real y en vivo.',
    en: 'In-game storms recreate these real flares: their class sets the strength and warning time. If GOES measures level S1 or higher, the storm is real and live.',
  },
  repairX: { es: 'Reparar {x}', en: 'Repair {x}' },
  repaired: { es: '¡Reparado!', en: 'Repaired!' },
  shower: { es: 'Lluvia de meteoros', en: 'Meteor shower' },
  impactNews: {
    es: 'Detectamos impactos de micrometeoritos. En la Luna no hay atmósfera que los frene: viajan a decenas de km por segundo y perforan el equipo. Acércate a lo dañado y repáralo con materiales.',
    en: 'We detected micrometeoroid impacts. The Moon has no atmosphere to stop them: they travel at tens of km per second and puncture equipment. Walk up to what is damaged and repair it with materials.',
  },
  showerNews: {
    es: 'Hoy la Luna cruza la lluvia de meteoros {name}: habrá más impactos. Dato real: la NASA ha filmado destellos de impactos en la Luna durante lluvias de meteoros.',
    en: 'Today the Moon is crossing the {name} meteor shower: expect more impacts. Real fact: NASA has filmed impact flashes on the Moon during meteor showers.',
  },
} as const;

export type StringKey = keyof typeof STRINGS;

const listeners = new Set<() => void>();
let lang: Lang = load();

function load(): Lang {
  try {
    const saved = localStorage.getItem('nexus.lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Storage can be blocked (private mode); fall back to the browser language.
  }
  return navigator.language?.startsWith('en') ? 'en' : 'es';
}

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem('nexus.lang', next);
  } catch {
    // Not saved, but the switch still works for this session.
  }
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void): void {
  listeners.add(fn);
}

let playerName = '';

/** The astronaut's name from the profile ('' uses the default "Astronaut"). */
export function setPlayerName(name: string): void {
  playerName = name;
  listeners.forEach((fn) => fn());
}

export function getPlayerName(): string {
  return playerName;
}

/** Translate a key, filling {placeholders} from `vars`; {player} is the astronaut's name. */
export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  const all: Record<string, string | number> = { player: playerName || STRINGS.defaultName[lang], ...vars };
  return STRINGS[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(all[k] ?? ''));
}
