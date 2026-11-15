import type { LockView } from '../../render/lock-view.ts';

/** A chest, a vault door, or a locked door, drawn for the lock popup. */
export function LockArt(props: { kind: LockView['kind'] }) {
  return (
    <svg class="lock-art" viewBox="0 0 120 90" role="img" aria-label={`A locked ${props.kind}`}>
      {props.kind === 'chest' && (
        <g>
          <path class="lock-art-wood" d="M18 40h84v38H18Z" />
          <path class="lock-art-wood" d="M18 40q42-30 84 0Z" />
          <path class="lock-art-band" d="M18 40h84M30 30v48M90 30v48M18 60h84" />
          <path class="lock-art-plate" d="M52 34h16v18H52Z" />
          <circle class="lock-art-hole" cx="60" cy="41" r="2.5" />
          <path class="lock-art-hole" d="M59 42h2v6h-2Z" />
        </g>
      )}
      {props.kind === 'vault' && (
        <g>
          <path class="lock-art-stone" d="M10 86V40a50 36 0 0 1 100 0v46Z" />
          <path class="lock-art-iron" d="M22 86V42a38 28 0 0 1 76 0v44Z" />
          <path class="lock-art-band" d="M22 50h76M22 66h76M60 16v70" />
          <circle class="lock-art-plate" cx="60" cy="58" r="11" />
          <path class="lock-art-band" d="M60 47v22M49 58h22" />
          <circle class="lock-art-hole" cx="60" cy="58" r="3" />
        </g>
      )}
      {props.kind === 'door' && (
        <g>
          <path class="lock-art-stone" d="M20 88V8h80v80Z" />
          <path class="lock-art-wood" d="M30 88V16h60v72Z" />
          <path class="lock-art-band" d="M45 16v72M60 16v72M75 16v72M30 30h60M30 72h60" />
          <path class="lock-art-plate" d="M74 46h12v18H74Z" />
          <circle class="lock-art-hole" cx="80" cy="52" r="2" />
          <path class="lock-art-hole" d="M79 53h2v6h-2Z" />
        </g>
      )}
    </svg>
  );
}
