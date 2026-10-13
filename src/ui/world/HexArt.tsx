/**
 * The overland map's glyphs and icons as SVG symbols, drawn in ink on parchment
 * (docs/presentation-plan.md, V2). Each sits in a 2 by 2 box centred on the origin; src/render/
 * hex-art.ts says where each terrain glyph goes, and HexMap.tsx places the icons.
 */
export function HexArtDefs() {
  return (
    <defs>
      <filter id="hm-fog" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <radialGradient id="hm-paper" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.55" stop-color="#e9dbb4" />
        <stop offset="1" stop-color="#c9b483" />
      </radialGradient>

      <symbol id="hg-plains" viewBox="-1 -1 2 2" class="glyph">
        <path d="M-0.7,0.4l0.12,-0.45M-0.48,0.4v-0.6M-0.26,0.4l-0.12,-0.45M0.2,0.4l0.1,-0.4M0.42,0.4v-0.55M0.64,0.4l-0.1,-0.4" />
      </symbol>
      <symbol id="hg-forest" viewBox="-1 -1 2 2" class="glyph">
        <path class="trunk" d="M0,0.2V0.9" />
        <circle class="leaf" cx="0" cy="-0.2" r="0.55" />
      </symbol>
      <symbol id="hg-deep-forest" viewBox="-1 -1 2 2" class="glyph">
        <path class="trunk" d="M0,0.5V0.9" />
        <path class="pine" d="M0,-0.95L0.6,0.55H-0.6Z" />
      </symbol>
      <symbol id="hg-hills" viewBox="-1 -1 2 2" class="glyph">
        <path class="hill" d="M-0.95,0.45Q0,-0.75 0.95,0.45Z" />
        <path d="M0.15,-0.05q0.2,0.15 0.3,0.4M0.35,-0.0q0.15,0.12 0.2,0.3" />
      </symbol>
      <symbol id="hg-mountains" viewBox="-1 -1 2 2" class="glyph">
        <path class="rock" d="M-0.95,0.8L-0.1,-0.9L0.28,-0.2L0.5,-0.5L0.95,0.8Z" />
        <path class="shade" d="M-0.1,-0.9L0.05,0.8H0.95L0.5,-0.5L0.28,-0.2Z" />
        <path class="snow" d="M-0.33,-0.44L-0.1,-0.9L0.12,-0.46L0,-0.36L-0.12,-0.5Z" />
      </symbol>
      <symbol id="hg-swamp" viewBox="-1 -1 2 2" class="glyph">
        <path class="water" d="M-0.8,0.55h0.5M-0.1,0.55h0.8M-0.5,0.8h0.9" />
        <path d="M-0.35,0.45v-0.7M0,0.45v-0.95M0.32,0.45v-0.6" />
        <path class="reed" d="M0,-0.5v-0.25M-0.35,-0.25v-0.18" />
      </symbol>
      <symbol id="hg-badlands" viewBox="-1 -1 2 2" class="glyph">
        <path class="mesa" d="M-0.95,0.55L-0.62,-0.2H0.5L0.88,0.55Z" />
        <path d="M-0.5,0.05h0.9M-0.2,-0.2l0.08,0.75M0.25,-0.2l-0.06,0.4" />
      </symbol>
      <symbol id="hg-lake" viewBox="-1 -1 2 2" class="glyph">
        <path
          class="water"
          d="M-0.6,-0.25q0.15,-0.14 0.3,0t0.3,0t0.3,0t0.3,0M-0.45,0.2q0.15,-0.14 0.3,0t0.3,0t0.3,0"
        />
      </symbol>
      <symbol id="hg-river" viewBox="-1 -1 2 2" class="glyph">
        <path class="water" d="M-0.6,0q0.15,-0.16 0.3,0t0.3,0t0.3,0t0.3,0" />
      </symbol>
      <symbol id="hg-ford" viewBox="-1 -1 2 2" class="glyph">
        <circle class="stone" cx="-0.55" cy="0.3" r="0.13" />
        <circle class="stone" cx="-0.18" cy="0.1" r="0.13" />
        <circle class="stone" cx="0.18" cy="-0.1" r="0.13" />
        <circle class="stone" cx="0.55" cy="-0.3" r="0.13" />
      </symbol>

      <symbol id="hi-town" viewBox="-1 -1 2 2">
        <path d="M-0.85,0.75V-0.05L-0.45,-0.45L-0.05,-0.05V0.75ZM-0.05,0.75V-0.35L0.4,-0.85L0.85,-0.35V0.75Z" />
        <path
          class="door"
          d="M-0.55,0.75V0.35H-0.35V0.75ZM0.3,0.75V0.25H0.5V0.75ZM0.3,-0.25h0.2v0.2h-0.2Z"
        />
      </symbol>
      <symbol id="hi-dungeon" viewBox="-1 -1 2 2">
        <path class="stone" d="M-0.9,0.8V-0.1Q-0.9,-0.85 0,-0.85Q0.9,-0.85 0.9,-0.1V0.8Z" />
        <path class="mouth" d="M-0.45,0.8V0.05Q-0.45,-0.4 0,-0.4Q0.45,-0.4 0.45,0.05V0.8Z" />
      </symbol>
      <symbol id="hi-grove" viewBox="-1 -1 2 2">
        <circle class="ring" cx="0" cy="0" r="0.9" />
        <path class="tree" d="M-0.42,0.4L-0.42,-0.05M0.42,0.4L0.42,-0.05M0,0.55V0.1" />
        <circle class="crown" cx="-0.42" cy="-0.2" r="0.26" />
        <circle class="crown" cx="0.42" cy="-0.2" r="0.26" />
        <circle class="crown" cx="0" cy="-0.05" r="0.3" />
      </symbol>
      <symbol id="hi-exit" viewBox="-1 -1 2 2">
        <path class="post" d="M-0.55,0.95V-0.6" />
        <path class="sign" d="M-0.75,-0.65H0.5L0.9,-0.3L0.5,0.05H-0.75Z" />
      </symbol>
      <symbol id="hi-party" viewBox="-1 -1 2 2">
        <path class="pole" d="M-0.45,0.95V-0.95" />
        <path class="flag" d="M-0.45,-0.95H0.85L0.45,-0.55L0.85,-0.15H-0.45Z" />
        <ellipse class="foot" cx="-0.45" cy="0.92" rx="0.4" ry="0.12" />
      </symbol>
      <symbol id="hi-bridge" viewBox="-1 -1 2 2">
        <path class="deck" d="M-0.95,-0.24H0.95V0.24H-0.95Z" />
        <path class="planks" d="M-0.6,-0.24V0.24M-0.25,-0.24V0.24M0.1,-0.24V0.24M0.45,-0.24V0.24" />
        <path class="rail" d="M-1,-0.32H1M-1,0.32H1" />
      </symbol>
      <symbol id="hi-compass" viewBox="-1 -1 2 2">
        <circle class="ring" cx="0" cy="0.2" r="0.55" />
        <path class="point dark" d="M0,-0.5L0.13,0.2H-0.13Z" />
        <path class="point light" d="M0,0.9L-0.13,0.2H0.13Z" />
        <path class="point light" d="M-0.7,0.2L0,0.07V0.33Z" />
        <path class="point dark" d="M0.7,0.2L0,0.33V0.07Z" />
        <text class="north" x="0" y="-0.56" text-anchor="middle">
          N
        </text>
      </symbol>
    </defs>
  );
}
