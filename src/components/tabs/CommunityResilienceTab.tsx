import React, { useState, useMemo } from 'react';
import { MedicalNotice } from '../common/MedicalNotice';
import { URBAN_SECTORS, SectorId } from '../../lib/routing';
import { calculatePM25SubIndex, evaluateInversionRisk } from '../../lib/aqiCompute';
import { useI18n } from '../../lib/i18n/I18nContext';
import {
  Users,
  HeartHandshake,
  Radio,
  Copy,
  Check,
  AlertTriangle,
  Globe,
  Leaf,
} from 'lucide-react';

interface PledgeItem {
  id: string;
  title: string;
  description: string;
  pm25SavedG: number;
  co2SavedKg: number;
  activeCount: number;
  isPledged: boolean;
}

const INITIAL_PLEDGES: PledgeItem[] = [
  {
    id: 'TRANSIT_SHIFT',
    title: 'Switch Commute to Metro / Electric Bus',
    description: 'Bypass single-occupancy vehicle idling and tailpipe emissions during morning rush.',
    pm25SavedG: 14.5,
    co2SavedKg: 4.8,
    activeCount: 142,
    isPledged: false,
  },
  {
    id: 'NO_WOOD_BURNING',
    title: 'Eliminate Residential Wood & Fireplace Burning',
    description: 'Prevent acute localized woodsmoke particulate spikes trapped beneath cold thermal inversion caps.',
    pm25SavedG: 48.0,
    co2SavedKg: 12.5,
    activeCount: 88,
    isPledged: true,
  },
  {
    id: 'NO_IDLING',
    title: 'School Zone & Curbside Zero-Idling Zone',
    description: 'Turn off vehicle engines while waiting outside schools and logistics loading bays.',
    pm25SavedG: 8.2,
    co2SavedKg: 3.1,
    activeCount: 215,
    isPledged: false,
  },
  {
    id: 'CR_BOX_BUILD',
    title: 'Deploy DIY Corsi-Rosenthal Box in Community Space',
    description: 'Donate and operate a 4x MERV-13 air cleaner in local daycare, school classroom, or elder center.',
    pm25SavedG: 22.0,
    co2SavedKg: 1.2,
    activeCount: 64,
    isPledged: true,
  },
];

type BroadcastLanguage = 'en' | 'hi' | 'ar' | 'ur';

interface BroadcastTemplate {
  lang: BroadcastLanguage;
  name: string;
  isRtl: boolean;
  headline: string;
  body: string;
  actionCall: string;
}


export const CommunityResilienceTab: React.FC = () => {
  const { t } = useI18n();
  const [pledges, setPledges] = useState<PledgeItem[]>(INITIAL_PLEDGES);
  const [selectedLang, setSelectedLang] = useState<BroadcastLanguage>('en');
  const [selectedSector, setSelectedSector] = useState<SectorId>('CBD');
  const [copied, setCopied] = useState<boolean>(false);

  const togglePledge = (id: string) => {
    setPledges((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextState = !p.isPledged;
          return {
            ...p,
            isPledged: nextState,
            activeCount: nextState ? p.activeCount + 1 : p.activeCount - 1,
          };
        }
        return p;
      })
    );
  };

  const totals = pledges.reduce(
    (acc, p) => {
      acc.pm25Grams += p.activeCount * p.pm25SavedG;
      acc.co2Kg += p.activeCount * p.co2SavedKg;
      acc.participants += p.activeCount;
      return acc;
    },
    { pm25Grams: 0, co2Kg: 0, participants: 0 }
  );

  // Dynamically derive current conditions and inversion outputs
  const sector = URBAN_SECTORS[selectedSector];
  const aqiRes = calculatePM25SubIndex(sector.defaultPM25);
  const inversion = evaluateInversionRisk(8.0, 11.5, 3.5); // Delta T = +3.5°C, SEVERE

  const broadcastTemplates: Record<BroadcastLanguage, BroadcastTemplate> = useMemo(() => {
    const pm = sector.defaultPM25;
    const aqi = aqiRes.aqi;
    const cat = aqiRes.category;
    const invSev = inversion.severity;
    const deltaT = inversion.deltaT;
    const win = inversion.expectedBreakupWindow;

    return {
      en: {
        lang: 'en',
        name: 'English',
        isRtl: false,
        headline: `AIR QUALITY EMERGENCY ALERT: ${invSev} Inversion Active over ${sector.name}`,
        body: `Atmospheric boundary layer is trapping PM2.5 particulates at ${pm} µg/m³ (${cat}, AQI ${aqi}). High thermal inversion cap (ΔT = +${deltaT}°C, ${invSev}) with stagnant surface winds. Vulnerable residents (asthmatic children, elderly cardiac patients, newborn infants) must remain indoors with active HEPA/Corsi-Rosenthal air filtration.`,
        actionCall: `Cancel outdoor school recess and sports. Windows must remain sealed until the convective solar breakup window (${win}).`,
      },
      hi: {
        lang: 'hi',
        name: 'Hindi (हिंदी)',
        isRtl: false,
        headline: `वायु गुणवत्ता आपातकालीन चेतावनी: ${sector.name} पर गंभीर तापमान प्रतिलोमन सक्रिय`,
        body: `वायुमंडलीय सीमा परत हानिकारक स्तरों (${pm} µg/m³, AQI ${aqi}) पर PM2.5 कणों को रोक रही है। तापमान प्रतिलोमन (ΔT = +${deltaT}°C) सक्रिय है। कमजोर नागरिक (अस्थमा पीड़ित बच्चे, हृदय रोगी और नवजात शिशु) अनिवार्य रूप से घर के अंदर रहें और सक्रिय HEPA या कोर्सी-रोसेन्थल फिल्टर का उपयोग करें।`,
        actionCall: `बाहरी खेल और गतिविधियों को तुरंत रद्द करें। सौर संवहन खिड़की (${win}) तक खिड़कियां पूरी तरह बंद रखें।`,
      },
      ar: {
        lang: 'ar',
        name: 'Arabic (العربية)',
        isRtl: true,
        headline: `تنبيه طوارئ لجودة الهواء: انقلاب حراري شتوي في ${sector.name}`,
        body: `تحبس الطبقة الجوية الجليدية جزيئات PM2.5 بمستويات خطيرة (${pm} ميكروغرام/م³، مؤشر جودة الهواء ${aqi}). الانعكاس الحراري مرتفع (ΔT = +${deltaT}°C). يجب على الفئات المعرضة للخطر (الأطفال المصابون بالربو، مرضى القلب، والرضع) البقاء في منازلهم مع تشغيل أجهزة تنقية الهواء HEPA باستمرار.`,
        actionCall: `إلغاء جميع الأنشطة الرياضية الخارجية. يجب إبقاء النوافذ مغلقة بإحكام حتى نافذة التفكك الحراري (${win}).`,
      },
      ur: {
        lang: 'ur',
        name: 'Urdu (اردو)',
        isRtl: true,
        headline: `ایئر کوالٹی ایمرجنسی الرٹ: ${sector.name} پر شدید تھرمل انورژن فعال`,
        body: `ماحول کی نچلی سرد تہہ خطرناک سطح (${pm} µg/m³، AQI ${aqi}) پر PM2.5 ذرات को زمین کے قریب قید کر रही ہے۔ تھرمل کیپ (ΔT = +${deltaT}°C) فعال ہے۔ حساس افراد لازمی طور پر اندر رہیں اور ایئر پیوریفائر کا استعمال کریں۔`,
        actionCall: `باہر کی تمام سرگرمیاں اور اسکول کے کھیل منسوخ کریں۔ شمسی حرارتی وقت (${win}) تک تمام کھڑکیاں بند رکھیں۔`,
      },
    };
  }, [sector, aqiRes, inversion]);

  const broadcast = broadcastTemplates[selectedLang];

  const handleCopy = () => {
    const textToCopy = `${broadcast.headline}\n\n${broadcast.body}\n\nAction Directives:\n${broadcast.actionCall}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <MedicalNotice />

      {/* Community Resilience Header & Metrics Counter */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            {t.communityTab.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.communityTab.subtitle}
          </p>
        </div>

        {/* Transparency Notice: Demo Data */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-800/50 text-xs font-mono text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Demo Data Notice: Collective abatement numbers and participant counts below are simulated demo data.</span>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 block font-mono">Collective PM2.5 Prevented</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60">Demo Data</span>
              </div>
              <span className="text-2xl font-bold font-mono text-cyan-300">
                {(totals.pm25Grams / 1000).toFixed(2)} <span className="text-sm font-normal text-slate-400">kg</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 block font-mono">Collective CO2 Avoided</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60">Demo Data</span>
              </div>
              <span className="text-2xl font-bold font-mono text-emerald-300">
                {totals.co2Kg.toFixed(1)} <span className="text-sm font-normal text-slate-400">kg</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/60">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 block font-mono">Active Neighborhood Pledges</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60">Demo Data</span>
              </div>
              <span className="text-2xl font-bold font-mono text-purple-300">
                {totals.participants} <span className="text-sm font-normal text-slate-400">citizens</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Neighborhood Pledges List */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-cyan-400" />
          Neighborhood Particulate Reduction Pledges
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pledges.map((p) => (
            <div
              key={p.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                p.isPledged
                  ? 'bg-slate-800/90 border-emerald-500/80'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm text-slate-100">{p.title}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                    {p.activeCount} joined
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.description}</p>
                <div className="flex items-center gap-3 mt-3 text-xs font-mono text-cyan-400">
                  <span>+{p.pm25SavedG}g PM2.5/day saved</span>
                  <span>+{p.co2SavedKg}kg CO2/day</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => togglePledge(p.id)}
                className={`mt-4 w-full py-2 rounded-lg text-xs font-bold transition-all ${
                  p.isPledged
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {p.isPledged ? 'Pledged Active ✓' : 'Join This Neighborhood Pledge'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Multilingual Emergency Broadcast Generator */}
      <div className="p-6 rounded-2xl atmospheric-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" aria-hidden="true" />
              Multilingual Emergency Community Broadcast Generator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Rapid dissemination alerts with automatic Right-to-Left (RTL) switching for Arabic and Urdu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="broadcast-sector" className="text-xs font-mono text-slate-400">
                Sector:
              </label>
              <select
                id="broadcast-sector"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value as SectorId)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="CBD">Downtown (CBD)</option>
                <option value="RES">Greenwood (RES)</option>
                <option value="IND">Industrial (IND)</option>
                <option value="PRK">Riverside (PRK)</option>
                <option value="TRN">Transit Hub (TRN)</option>
              </select>
            </div>

            {/* Language Selector */}
            <div className="flex flex-wrap gap-2">
              {(['en', 'hi', 'ar', 'ur'] as BroadcastLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLang(lang)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    selectedLang === lang
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 inline mr-1" />
                  {broadcastTemplates[lang].name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Translation Review Notice */}
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200/90 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Requirement:</strong> Mark generated translations as <em>"Review before broadcasting"</em> by a human native speaker before official public transmission.
          </span>
        </div>

        {/* Generated Broadcast Box with automatic dir="rtl" */}
        <div
          dir={broadcast.isRtl ? 'rtl' : 'ltr'}
          className={`p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-sans transition-all ${
            broadcast.isRtl ? 'text-right' : 'text-left'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">
                [Emergency Atmospheric Dispatch]
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
                Review before broadcasting
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Text
                </>
              )}
            </button>
          </div>

          <h4 className="text-base font-bold text-slate-100 leading-snug">
            {broadcast.headline}
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            {broadcast.body}
          </p>
          <div className="pt-2 text-xs text-cyan-300 font-medium">
            <strong>Action Directives:</strong> {broadcast.actionCall}
          </div>
        </div>
      </div>
    </div>
  );
};
