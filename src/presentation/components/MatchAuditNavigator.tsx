import React from 'react';
import { useGameStore, MatchAuditStep } from '../../state/game-store';
import { 
  History, 
  ChevronLeft, 
  ChevronRight, 
  Radio, 
  Play, 
  Sparkles, 
  CheckCircle2
} from 'lucide-react';

export const MatchAuditNavigator: React.FC = () => {
  const { 
    currentMatch, 
    goToAuditStep, 
    returnToLive, 
    resumeFromAuditStep 
  } = useGameStore();

  if (!currentMatch) return null;

  const { auditTrail, inspectingStepIndex, state } = currentMatch;
  const isInspecting = inspectingStepIndex !== null;
  const currentStepIdx = isInspecting ? inspectingStepIndex : auditTrail.length - 1;
  const currentStep: MatchAuditStep | undefined = auditTrail[currentStepIdx];
  const liveMinute = state.currentMinute;
  const liveSecond = state.currentSecond;

  const formatMatchTime = (min: number, sec?: number) => {
    if (sec !== undefined && sec > 0) {
      return `${min}' ${sec}"`;
    }
    return `${min}' 00"`;
  };

  // Filtrar momentos clave para el carrusel de accesos rápidos
  const keyMoments = auditTrail.filter((s) => s.isKeyMoment);

  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl p-4 my-4 text-white">
      {/* 1. Cabecera de Estado y Acciones de Bifurcación */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isInspecting ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-400'}`}>
            {isInspecting ? <History className="w-5 h-5 animate-pulse" /> : <Radio className="w-5 h-5 animate-ping" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider">
                {isInspecting ? 'Auditoría & Time-Travel' : 'Transmisión en Directo'}
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${
                  isInspecting
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    : 'bg-rose-600 text-white animate-pulse'
                }`}
              >
                {isInspecting ? `Minuto ${formatMatchTime(currentStep?.minute ?? 0, currentStep?.second)} (Paso ${currentStepIdx + 1}/${auditTrail.length})` : `🔴 DIRECTO • ${formatMatchTime(liveMinute, liveSecond)}`}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {isInspecting ? (
                <span>
                  Revisando fotograma exacto: <strong className="text-slate-200">{currentStep?.event.type}</strong> ({currentStep?.score.home} - {currentStep?.score.away})
                </span>
              ) : (
                <span>Historial completo auditado ({auditTrail.length} micro-ticks registrados). Navega libremente a cualquier jugada.</span>
              )}
            </div>
          </div>
        </div>

        {/* Botones de bifurcación y vuelta al directo */}
        <div className="flex items-center gap-2">
          {isInspecting && (
            <>
              <button
                onClick={() => resumeFromAuditStep(currentStepIdx)}
                className="bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-600 hover:to-emerald-600 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg transition-all transform active:scale-95"
                title="Borra los minutos posteriores y continúa simulando el partido desde este instante"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                Reanudar Partido desde aquí (Min {formatMatchTime(currentStep?.minute ?? 0, currentStep?.second)})
              </button>

              <button
                onClick={returnToLive}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-600 font-semibold flex items-center gap-1"
              >
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                Volver al Directo
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Barra de Navegación Temporal (Scrubber Slider) */}
      <div className="py-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1.5">
          <span>0' 00" Saque</span>
          <span className="font-bold text-slate-200">
            Paso inspeccionado: Minuto {formatMatchTime(currentStep?.minute ?? 0, currentStep?.second)}
          </span>
          <span>{formatMatchTime(liveMinute, liveSecond)} Último instante</span>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, auditTrail.length - 1)}
          value={currentStepIdx}
          onChange={(e) => goToAuditStep(Number(e.target.value))}
          className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-valle-yellow border border-slate-700"
        />

        {/* Botones Paso a Paso */}
        <div className="flex items-center justify-between mt-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToAuditStep(0)}
              disabled={currentStepIdx === 0}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 px-2 py-1 rounded text-slate-300 font-mono text-[11px] border border-slate-700"
            >
              |◀ Min 0'
            </button>
            <button
              onClick={() => goToAuditStep(Math.max(0, currentStepIdx - 1))}
              disabled={currentStepIdx === 0}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 px-2.5 py-1 rounded text-slate-200 font-semibold flex items-center gap-1 border border-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </button>
            <button
              onClick={() => goToAuditStep(Math.min(auditTrail.length - 1, currentStepIdx + 1))}
              disabled={currentStepIdx >= auditTrail.length - 1}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 px-2.5 py-1 rounded text-slate-200 font-semibold flex items-center gap-1 border border-slate-700"
            >
              Siguiente <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Marcador en este instante:{' '}
            <strong className="text-valle-yellow font-mono text-xs">
              {currentStep?.score.home} - {currentStep?.score.away}
            </strong>
          </div>
        </div>
      </div>

      {/* 3. Carrusel de Momentos Clave (Acceso Directo a Goles, Paradas, Críticos) */}
      {keyMoments.length > 0 && (
        <div className="pt-3 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-valle-yellow" />
            <span>Saltar a Momentos Clave del Partido ({keyMoments.length})</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            {keyMoments.map((km) => {
              const isSelected = km.stepIndex === currentStepIdx;

              let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700';
              if (km.keyCategory === 'GOAL') {
                badgeBg = isSelected
                  ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 ring-2 ring-emerald-300'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-600 hover:bg-emerald-900';
              } else if (km.keyCategory === 'SAVE') {
                badgeBg = isSelected
                  ? 'bg-cyan-500 text-slate-950 font-black border-cyan-400 ring-2 ring-cyan-300'
                  : 'bg-cyan-950/80 text-cyan-300 border-cyan-600 hover:bg-cyan-900';
              } else if (km.keyCategory === 'COUNTER') {
                badgeBg = isSelected
                  ? 'bg-amber-500 text-slate-950 font-black border-amber-400 ring-2 ring-amber-300'
                  : 'bg-amber-950/80 text-amber-300 border-amber-600 hover:bg-amber-900';
              } else if (km.keyCategory === 'HALFTIME') {
                badgeBg = isSelected
                  ? 'bg-indigo-500 text-white font-black border-indigo-400 ring-2 ring-indigo-300'
                  : 'bg-indigo-950/80 text-indigo-300 border-indigo-600 hover:bg-indigo-900';
              }

              return (
                <button
                  key={km.stepIndex}
                  onClick={() => goToAuditStep(km.stepIndex)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg border font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-sm ${badgeBg}`}
                >
                  <span>{km.keyLabel || `Min ${km.minute}' ${km.event.type}`}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
