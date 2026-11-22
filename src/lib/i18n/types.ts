/**
 * @file i18n/types.ts
 * @description Type definitions for the VayuPulse AI internationalization system.
 */

export type LanguageCode = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'ar' | 'ur' | 'es';

export interface LanguageConfig {
  code: LanguageCode;
  label: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export interface NavTranslations {
  tabs: {
    telemetry: string;
    routine: string;
    corridor: string;
    iaq: string;
    community: string;
  };
  modelCard: string;
  copilot: string;
}

export interface HeaderTranslations {
  title: string;
  subtitle: string;
  version: string;
}

export interface SimulatedBannerTranslations {
  simulatedData: string;
  live: string;
  liveStale: string;
  simulatedPhysics: string;
}

export interface MedicalNoticeTranslations {
  title: string;
  description: string;
}

export interface TelemetryTabTranslations {
  title: string;
  subtitle: string;
  sectorSummary: string;
  pm25: string;
  aqi: string;
  groundTemp: string;
  upperTemp: string;
  deltaT: string;
  windSpeed: string;
  inversionActive: string;
  inversionNone: string;
  forecastTitle: string;
  forecastSubtitle: string;
  leastPollutedWindow: string;
  counterfactualTitle: string;
  counterfactualSubtitle: string;
  windSlider: string;
  trafficSlider: string;
  resetSliders: string;
}

export interface RoutineTabTranslations {
  title: string;
  subtitle: string;
  selectPersona: string;
  selectSector: string;
  generatePlan: string;
  generating: string;
  timelineTitle: string;
  citationsTitle: string;
  safetyTitle: string;
  hourlyRoutine: string;
  actionsLabel: string;
  outdoorGuidance: string;
  purificationTarget: string;
}

export interface CorridorTabTranslations {
  title: string;
  subtitle: string;
  origin: string;
  destination: string;
  departureTime: string;
  optimizeRoute: string;
  routeResults: string;
  lowestDoseBadge: string;
  inhaledDose: string;
  travelTime: string;
  transitComparison: string;
  leaveNow: string;
  leaveAtBest: string;
}

export interface IaqTabTranslations {
  title: string;
  subtitle: string;
  roomDimensions: string;
  roomLength: string;
  roomWidth: string;
  ceilingHeight: string;
  roomVolume: string;
  targetReduction: string;
  achRequired: string;
  clearanceTime: string;
  presetsTitle: string;
  corsiBoxTitle: string;
  hepaTitle: string;
  guidelineRecommended: string;
  formulaNote: string;
}

export interface CommunityTabTranslations {
  title: string;
  subtitle: string;
  collectiveTitle: string;
  pledgesTitle: string;
  broadcastTitle: string;
  copyBroadcast: string;
  copied: string;
  demoDataBadge: string;
  reviewWarning: string;
}

export interface CopilotTranslations {
  drawerTitle: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  disclaimer: string;
  synthesizing: string;
  citationsLabel: string;
}

export interface FooterTranslations {
  mission: string;
  standards: string;
  attribution: string;
}

export interface Translations {
  nav: NavTranslations;
  header: HeaderTranslations;
  simulatedBanner: SimulatedBannerTranslations;
  medicalNotice: MedicalNoticeTranslations;
  telemetryTab: TelemetryTabTranslations;
  routineTab: RoutineTabTranslations;
  corridorTab: CorridorTabTranslations;
  iaqTab: IaqTabTranslations;
  communityTab: CommunityTabTranslations;
  copilot: CopilotTranslations;
  footer: FooterTranslations;
}
