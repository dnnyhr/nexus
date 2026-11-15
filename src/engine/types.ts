// src/engine/types.ts — CONTRATO COMPARTIDO de la Misión 1.
// Contrato preparado antes del arranque. Cambios coordinados por integrador.
// Todo es JSON serializable: sin clases, funciones ni Date dentro del estado.

import type { GameState } from '../game/state';
import type { PowerReport } from '../game/sim';

/** Paso fijo de simulación en segundos de juego. Igual al SIM_STEP actual de main.ts. */
export const STEP = 0.25;

// ---------------------------------------------------------------------------------------------
// Preparación (Arquitectos del espacio)

/** Lo que el jugador compra antes de empezar. Todo empieza en 0 = solo la base incluida. */
export interface Design {
  /** Mástiles solares extra (0-3). La base incluye 1. */
  solarMasts: number;
  /** Baterías (0-3). La base incluye solo la batería pequeña de la estación. */
  batteries: number;
  /** Niveles extra de invernadero (0-2). La base incluye nivel 1. */
  greenhouse: number;
  /** Procesador de regolito para O2 (0 o 1). */
  processor: number;
  /** Niveles de berma de regolito = blindaje pasivo (0-3). */
  shield: number;
  /** Paquetes de reserva inicial (cada uno +10 % de capacidad, 0-5 por recurso). */
  reserves: { o2: number; water: number; food: number };
}

export type DesignItem = 'solarMasts' | 'batteries' | 'greenhouse' | 'processor' | 'shield' | 'reserveO2' | 'reserveWater' | 'reserveFood';

export interface DesignCheck {
  ok: boolean;
  spent: number;
  budget: number;
  /** Motivos legibles en español si no es válido (por ejemplo, presupuesto superado). */
  reasons: string[];
}

// ---------------------------------------------------------------------------------------------
// Comandos: TODA acción del jugador en modo misión pasa por aquí.

export type Command =
  | { type: 'setGrowLights'; value: number } // 0-100
  | { type: 'setPower'; system: 'heating' | 'processor' | 'robots'; on: boolean }
  | { type: 'irrigate' }
  | { type: 'adjustClimate'; dir: 1 | -1 }
  | { type: 'harvest' }
  | { type: 'replant' }
  | { type: 'enterShelter' }
  | { type: 'leaveShelter' }
  | { type: 'collectRegolith' }
  | { type: 'deliverRegolith' };

export interface CommandResult {
  ok: boolean;
  /** Motivo legible en español cuando ok = false. */
  reason?: string;
}

export interface LoggedCommand {
  /** Tiempo de misión (s) en que se aplicó. */
  t: number;
  cmd: Command;
  ok: boolean;
}

// ---------------------------------------------------------------------------------------------
// Escenario congelado: nada de Math.random, Date.now ni red dentro del motor.

export interface ScenarioEvent {
  kind: 'darkness' | 'storm';
  /** Segundo de misión en que se anuncia por radio. */
  warnAt: number;
  /** Segundo en que empieza. */
  startAt: number;
  /** Segundo en que termina. */
  endAt: number;
  /** Solo tormentas: intensidad 0-1 (didáctica). */
  strength?: number;
  /** Solo tormentas: fulguración real que la inspiró, como contexto fechado (del snapshot). */
  inspiredBy?: { id: string; class: string; peak: string; link: string };
}

export interface Scenario {
  id: 'mision-1';
  seed: number;
  /** Duración total de la misión en segundos de juego. */
  duration: number;
  budget: number;
  events: ScenarioEvent[];
  /** Exposición máxima en unidades didácticas (u). */
  exposureLimit: number;
  /** Segundos que un recurso vital puede estar en 0 antes del fallo. */
  depletionGrace: number;
}

// ---------------------------------------------------------------------------------------------
// Estado de misión

export type MissionPhase = 'running' | 'victory' | 'failed';

export type FailureCode = 'o2_depleted' | 'water_depleted' | 'food_depleted' | 'crew_lost' | 'exposure_exceeded';

export interface Failure {
  code: FailureCode;
  /** Segundo de misión. */
  t: number;
  title: string;
  /** Explicación legible: qué pasó y por qué. Cifras sacadas del estado, no escritas a mano. */
  explanation: string;
}

export type EventKind =
  | 'darkness_warning' | 'darkness_start' | 'darkness_end'
  | 'storm_warning' | 'storm_start' | 'storm_end'
  | 'harvest' | 'plant_dead'
  | 'power_shortage' | 'power_restored' | 'life_support_unpowered'
  | 'shelter_enter' | 'shelter_leave'
  | 'victory' | 'failure';

export interface MissionEvent {
  t: number;
  kind: EventKind;
  /** Texto corto en español para radio, línea de tiempo e informe. */
  text: string;
}

/** Muestra para gráficos e informe, cada SAMPLE_EVERY segundos. Valores en % de capacidad salvo exposure (u). */
export interface Sample {
  t: number;
  o2: number;
  water: number;
  food: number;
  energy: number;
  exposure: number;
  crewHealth: number;
  /** Brillo real de luces de cultivo 0-100 (lo que la energía permitió). */
  lights: number;
  plantGrowth: number;
  sheltered: boolean;
  isDark: boolean;
}

export const SAMPLE_EVERY = 5;

export interface MissionMetrics {
  minLifeSupport: number;
  secondsLightsReduced: number;
  secondsSheltered: number;
  secondsShortage: number;
}

export type MissionResource = 'o2' | 'water' | 'food' | 'energy';
export type MissionCause = 'crew' | 'processor' | 'lights' | 'heating' | 'shelter' | 'harvest' | 'solar' | 'irrigation' | 'climate' | 'storage';
export type MissionLedger = Record<MissionResource, Record<MissionCause, number>>;

export interface MissionState {
  version: 2;
  scenario: Scenario;
  design: Design;
  /** Tiempo de misión en segundos (0 al confirmar el diseño). */
  t: number;
  /** Estado interno del PRNG (mulberry32). Avanza solo dentro del motor. */
  rng: number;
  /** El estado del juego existente, que la escena 3D y el HUD ya saben dibujar. */
  game: GameState;
  lastPower: PowerReport;
  metrics: MissionMetrics;
  ledger: MissionLedger;
  /** Exposición acumulada en unidades didácticas (u). No son mSv ni dosis real. */
  exposure: number;
  /** Segundos seguidos con cada recurso vital en 0. */
  depleted: { o2: number; water: number; food: number };
  phase: MissionPhase;
  failure: Failure | null;
  log: LoggedCommand[];
  events: MissionEvent[];
  samples: Sample[];
}

// ---------------------------------------------------------------------------------------------
// Proyección (Comandante lunar)

export type Horizon = { kind: 'seconds'; value: number } | { kind: 'endOfDarkness' } | { kind: 'endOfMission' };

export interface Projection {
  /** Hasta qué segundo de misión se proyectó. */
  until: number;
  samples: Sample[];
  events: MissionEvent[];
  phase: MissionPhase;
  failure: Failure | null;
  /** Comandos del plan que el motor rechazó, con su motivo. */
  rejected: { cmd: Command; reason: string }[];
}

// ---------------------------------------------------------------------------------------------
// Informe

export interface Summary {
  phase: MissionPhase;
  failure: Failure | null;
  /** Segundos de misión jugados. */
  duration: number;
  design: Design;
  harvests: number;
  exposure: number;
  /** % mínimo alcanzado por el peor de O2, agua y alimento. */
  minLifeSupport: number;
  secondsLightsReduced: number;
  secondsSheltered: number;
  secondsShortage: number;
  /** 2-4 frases «sacrificaste X para sostener Y», generadas desde samples y events, nunca escritas a mano. */
  tradeoffs: string[];
}

// ---------------------------------------------------------------------------------------------
// Firmas que exporta src/engine/index.ts (Agente A). Los demás solo importan desde '../engine'.
//
// export const SCENARIO_1: Scenario;
// export const PRICES: Record<DesignItem, number>;
// export const LIMITS: Record<DesignItem, number>;
// export function emptyDesign(): Design;
// export function checkDesign(d: Design, scenario?: Scenario): DesignCheck;
// export function startMission(d: Design, scenario?: Scenario): MissionState;      // lanza Error si checkDesign falla
// export function applyCommand(ms: MissionState, cmd: Command): CommandResult;       // muta ms y registra en ms.log
// export function applyToGame(s: GameState, cmd: Command): CommandResult;            // sin log, para Modo libre
// export function worldStep(ms: MissionState): void;                                 // avanza exactamente STEP; no hace nada si phase !== 'running'
// export function project(ms: MissionState, plan: Command[], horizon: Horizon): Projection; // NO muta ms
// export function replay(design: Design, log: LoggedCommand[], until: number, scenario?: Scenario): MissionState;
// export function darknessAt(ms: MissionState): { isDark: boolean; secondsLeft: number };
// export function nextEvent(ms: MissionState): ScenarioEvent | null;
// export function summarize(ms: MissionState): Summary;                              // para el informe
