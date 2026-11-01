import React, { useState } from 'react';
import { PlayerDecision, TacticalOption } from '../../domain/match-engine';
import { Brain, ChevronDown, ChevronUp, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface DecisionDebuggerProps {
  decision?: PlayerDecision;
  minute: number;
}

export const DecisionDebugger: React.FC<DecisionDebuggerProps> = ({ decision, minute }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!decision) return null;

  const { decisionMaker, chosenOption, evaluatedOptions, tacticalContext } = decision;

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/80 rounded-xl shadow-2xl overflow-hidden transition-all text-white my-4">
      {/* Cabecera del Panel de Debug */}
      <div className="bg-indigo-950/90 px-4 py-2.5 flex items-center justify-between border-b border-indigo-700/50">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-indigo-500/20 text-indigo-300 rounded">
            <Brain className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-indigo-200 flex items-center gap-2">
              <span>IA Decision Engine Debugger</span>
              <span className="text-[10px] bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded font-mono">
                Minuto {minute}'
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Evaluación de alternativas en tiempo real para{' '}
              <span className="font-bold text-valle-yellow">
                #{decisionMaker.number} {decisionMaker.name} ({decisionMaker.position})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 px-2.5 py-1 rounded flex items-center gap-1 font-semibold border border-indigo-700"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {isExpanded ? 'Plegar' : 'Expandir'}
          </button>
          <button
            onClick={() => setIsVisible(!isVisible)}
            title={isVisible ? 'Ocultar panel' : 'Mostrar panel'}
            className="text-indigo-300 hover:text-white p-1 rounded hover:bg-indigo-900/50"
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isVisible && isExpanded && (
        <div className="p-4 space-y-4 text-xs">
          {/* Ficha rápida del Decisor */}
          <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Contexto Táctico:</div>
              <div className="text-sm font-bold text-slate-100">{tacticalContext}</div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="bg-slate-700 px-2 py-1 rounded text-slate-200">
                INT: <strong className="text-white">{decisionMaker.attributes.intelligence}</strong>
              </span>
              <span className="bg-slate-700 px-2 py-1 rounded text-slate-200">
                DES: <strong className="text-white">{decisionMaker.attributes.dexterity}</strong>
              </span>
              <span className="bg-slate-700 px-2 py-1 rounded text-slate-200">
                FUE: <strong className="text-white">{decisionMaker.attributes.strength}</strong>
              </span>
            </div>
          </div>

          {/* Opciones Evaluadas y Ranking de Utilidad */}
          <div>
            <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Alternativas Analizadas por el Jugador ({evaluatedOptions.length})</span>
              <span className="text-[10px] text-slate-400">Ordenadas por Índice de Utilidad</span>
            </div>

            <div className="space-y-2.5">
              {evaluatedOptions.map((opt: TacticalOption, idx: number) => {
                const isChosen = opt.actionType === chosenOption.actionType && opt.label === chosenOption.label;

                return (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 border transition-all ${
                      isChosen
                        ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                        : 'bg-slate-800/50 border-slate-700 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {isChosen ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-600 text-[10px] flex items-center justify-center text-slate-400">
                            {idx + 1}
                          </span>
                        )}
                        <span className="font-bold text-sm text-slate-100">{opt.label}</span>
                        {isChosen && (
                          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-500/40 uppercase">
                            Opción Elegida
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                            opt.riskLevel === 'LOW'
                              ? 'bg-blue-900/40 text-blue-300 border border-blue-700'
                              : opt.riskLevel === 'MEDIUM'
                              ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                              : 'bg-rose-900/40 text-rose-300 border border-rose-700'
                          }`}
                        >
                          <ShieldAlert className="w-3 h-3" />
                          Riesgo {opt.riskLevel}
                        </span>
                        <span className="text-xs font-black text-valle-yellow bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-mono">
                          d20 {opt.d20Bonus >= 0 ? `+${opt.d20Bonus}` : opt.d20Bonus}
                        </span>
                      </div>
                    </div>

                    {/* Barra de Puntuación de Utilidad */}
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden my-2 border border-slate-700">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isChosen
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-slate-500 to-indigo-400'
                        }`}
                        style={{ width: `${Math.min(100, opt.utilityScore)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
                      <span className="italic text-slate-400">{opt.reason}</span>
                      <span className="font-mono font-bold text-slate-200 flex-shrink-0 ml-2">
                        Utilidad: {opt.utilityScore}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-indigo-900/20 border border-indigo-700/40 rounded p-2.5 text-[11px] text-indigo-300 flex items-center justify-between">
            <span>
              ℹ️ <strong>Criterio de IA:</strong> El jugador selecciona la alternativa con mayor valor de utilidad según su visión de juego (`INT`), velocidad (`DES`) y el desmarque de sus compañeros.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

