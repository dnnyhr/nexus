import '@fontsource/barlow-semi-condensed/400.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '../../style.css';
import { newGame } from '../../game/state';
import { tick } from '../../game/sim';
import { getLang, setLang, t } from '../i18n';
import {
  mountCommanderRadio,
  mountControlCenter,
  mountControlsGuide,
  mountLanguageSwitch,
  mountScienceCapsules,
  mountSystemsHud,
  mountTelemetryRibbon,
  systemsFromGame,
  telemetryFromGame,
} from './index';

const params = new URLSearchParams(location.search);
if (params.get('lang') === 'en') setLang('en');
if (params.get('lang') === 'es') setLang('es');

mountLanguageSwitch(document.body, { floating: true });

const state = newGame(0);
state.mission = 6;
state.time = 1000;
state.res.materials = 84;
state.res.o2 = 64;
state.res.water = 41;
state.res.food = 28;
state.res.energy = 46;
state.crewHealth = 78;
state.levels.greenhouse = 1;
state.power.growLights = 60;
let power = tick(state, 0);

const ribbon = mountTelemetryRibbon(document.body, {
  getSnapshot: () => telemetryFromGame(state, power, Date.now(), {
    exposure: 18,
    exposureLimit: 40,
  }),
  onOpenPower: () => systems.setCollapsed(false),
  onOpenCommander: () => radio.pushKey('m_battery_text', {}, {
    priority: 'warning',
    hintKey: 'dirEnergyLow',
    whyKey: 'sciPolarWhy',
    at: 144,
  }),
});

const systems = mountSystemsHud(document.body, {
  getSnapshot: () => systemsFromGame(state, power),
  onBreaker: (system, on) => {
    state.power[system] = on;
    power = tick(state, 0);
    systems.update(true);
  },
  onLights: (value) => {
    state.power.growLights = value;
    power = tick(state, 0);
    systems.update(true);
  },
  canCommand: () => true,
});

const radio = mountCommanderRadio(document.body, {
  onAck: () => {},
});
radio.pushKey('m_battery_text', {}, {
  priority: 'warning',
  hintKey: 'dirDarkLowEnergy',
  whyKey: 'sciPolarWhy',
  at: 144,
});

const guide = mountControlsGuide(document.body, {
  showPause: true,
  initialMode: params.get('touch') === '1' ? 'touch' : 'auto',
});
if (params.get('guide') === '1') guide.show(true);

const scienceHost = document.createElement('div');
scienceHost.style.cssText = 'position:fixed;right:16px;bottom:190px;width:320px;max-width:calc(100vw - 32px);z-index:41;';
document.body.append(scienceHost);
mountScienceCapsules(scienceHost, { initialIndex: 1 });

if (params.get('view') === 'cc') {
  mountControlCenter(document.body, {
    getGame: () => state,
    hasFreeSave: () => true,
    missionReady: false,
    labReady: true,
    onCadet: () => {},
    onSimulator: () => {},
    onLab: (id) => console.log('lab', id),
    onOpenControls: () => guide.show(true),
    initialOpen: true,
    closable: true,
  });
}

setInterval(() => {
  ribbon.update();
  systems.update();
}, 250);

document.documentElement.lang = getLang();
document.title = `${t('ccTitle')} · ${getLang()}`;
