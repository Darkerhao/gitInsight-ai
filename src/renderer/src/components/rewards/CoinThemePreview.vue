<script setup lang="ts">
defineProps<{ themeId: string }>();
</script>

<template>
  <div class="theme-preview" :data-palette="themeId" aria-hidden="true">
    <svg class="theme-landscape" viewBox="0 0 400 240" fill="none" preserveAspectRatio="xMidYMid slice">
      <circle class="landscape-sun" cx="310" cy="65" r="34" />
      <g v-if="themeId === 'theme-ocean'">
        <path class="landscape-back" d="M0 130C65 90 115 160 190 125S310 100 400 135V240H0Z" />
        <path class="landscape-middle" d="M0 170C80 115 145 197 230 150S330 145 400 165V240H0Z" />
        <path class="landscape-front" d="M0 206C100 150 170 233 270 188S355 183 400 195V240H0Z" />
        <path d="M247 147C290 126 323 137 350 145M18 182C53 164 83 171 104 178" stroke="white" stroke-opacity=".35" stroke-linecap="round" />
      </g>
      <g v-else-if="themeId === 'theme-lavender'">
        <path class="landscape-back" d="M0 178L96 60L202 181L300 99L400 182V240H0Z" />
        <path class="landscape-middle" d="M0 211L159 106L280 211L365 150L400 185V240H0Z" />
        <path class="landscape-front" d="M0 235L90 183L181 219L285 167L400 225V240H0Z" />
        <path d="M96 60L75 86L96 79L117 85Z" fill="#efe9ff" fill-opacity=".6" />
        <g fill="#f4edff" fill-opacity=".7"><circle cx="48" cy="46" r="1.5" /><circle cx="189" cy="35" r="2" /><circle cx="244" cy="70" r="1.5" /></g>
      </g>
      <g v-else-if="themeId === 'theme-sunset'">
        <path class="landscape-back" d="M0 183C99 181 162 91 246 125S339 173 400 126V240H0Z" />
        <path class="landscape-middle" d="M0 162C123 125 185 232 282 177S369 158 400 167V240H0Z" />
        <path class="landscape-front" d="M0 226C120 168 203 224 283 206S373 207 400 217V240H0Z" />
        <path d="M21 218C76 195 119 198 152 205" stroke="#ffdfb0" stroke-opacity=".45" stroke-linecap="round" />
      </g>
      <g v-else>
        <path class="landscape-back" d="M0 160C65 109 117 96 177 146S290 101 400 133V240H0Z" />
        <path class="landscape-middle" d="M0 207C106 115 173 171 248 189S357 152 400 160V240H0Z" />
        <path class="landscape-front" d="M0 204C91 196 128 240 218 219S325 199 400 225V240H0Z" />
        <path d="M321 162V116M307 139L321 116L335 139M312 128L321 112L330 128" stroke="#345c42" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
    <div class="preview-window">
      <div class="preview-titlebar"><i /><i /><i /><span>我的工作台</span></div>
      <div class="preview-body">
        <div class="preview-sidebar"><b /><i /><i /><i /><i /></div>
        <div class="preview-content">
          <div class="preview-greeting"><span>让今天，再向前一点。</span><i /></div>
          <div class="preview-stats"><i /><i /><i /></div>
          <div class="preview-report"><span><i /><i /><i /></span><b /></div>
          <div class="preview-action" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-preview { --preview-accent: #b9f36b; --sky: #dbe8ca; --sun: #fff7d9; --hill-back: #a6ba84; --hill-middle: #738f60; --hill-front: #3d624d; position: relative; height: 100%; min-height: 160px; overflow: hidden; background: var(--sky); isolation: isolate; }
[data-palette='theme-ocean'] { --preview-accent: #58c8ed; --sky: #cee5ec; --sun: #f3faf5; --hill-back: #86c3cc; --hill-middle: #4a97ae; --hill-front: #316579; }
[data-palette='theme-lavender'] { --preview-accent: #b9a0ff; --sky: #d3c9e5; --sun: #f5e9e2; --hill-back: #aaa0c5; --hill-middle: #807398; --hill-front: #544d70; }
[data-palette='theme-sunset'] { --preview-accent: #f5ad73; --sky: #f2d3bb; --sun: #fff0ca; --hill-back: #d9a07e; --hill-middle: #b87c67; --hill-front: #865c54; }
.theme-landscape { position: absolute; width: 100%; height: 100%; inset: 0; }
.landscape-sun { fill: var(--sun); }
[data-palette='theme-sunset'] .landscape-sun { r: 47px; }
.landscape-back { fill: var(--hill-back); }
.landscape-middle { fill: var(--hill-middle); }
.landscape-front { fill: var(--hill-front); }
.preview-window { position: absolute; width: 73%; left: 13.5%; top: 28%; height: 64%; background: #202a29; border: 1px solid #ffffff65; border-radius: 6px; box-shadow: 0 9px 18px #12272040; transform: rotate(-5deg); transition: transform var(--motion-reset) ease; overflow: hidden; }
@media (hover: hover) and (pointer: fine) { .theme-preview:hover .preview-window { transform: translateY(-2px) rotate(-5deg); } }
.preview-titlebar { display: flex; gap: 3px; align-items: center; height: 16%; min-height: 13px; padding: 0 6%; border-bottom: 1px solid #ffffff10; }
.preview-titlebar i { width: 3px; height: 3px; background: #86928c; border-radius: 50%; }
.preview-titlebar i:first-child { background: var(--preview-accent); }
.preview-titlebar span { font-size: 5px; color: #c3cfca; margin-left: auto; letter-spacing: .5px; }
.preview-body { display: flex; height: 84%; }
.preview-sidebar { width: 20%; border-right: 1px solid #ffffff10; padding: 8% 4%; display: flex; flex-direction: column; gap: 6px; }
.preview-sidebar b { width: 8px; height: 8px; border-radius: 3px; background: var(--preview-accent); margin-bottom: 2px; }
.preview-sidebar i { height: 2px; background: #64726d; border-radius: 2px; }
.preview-sidebar i:nth-child(3) { background: var(--preview-accent); }
.preview-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 9%; padding: 6%; }
.preview-greeting { display: flex; align-items: center; justify-content: space-between; }
.preview-greeting span { color: #edf4ec; font-size: 6px; }
.preview-greeting i { height: 5px; width: 5px; border-radius: 50%; background: var(--preview-accent); }
.preview-stats { display: flex; gap: 5%; height: 23%; }
.preview-stats i { flex: 1; background: #35403b; border: 1px solid #ffffff08; border-radius: 3px; border-bottom: 2px solid color-mix(in srgb, var(--preview-accent) 50%, #35403b); }
.preview-report { display: flex; flex: 1; justify-content: space-between; gap: 10%; }
.preview-report span { width: 65%; display: flex; flex-direction: column; justify-content: space-evenly; }
.preview-report i { height: 2px; background: #65736e; border-radius: 1px; }
.preview-report i:nth-child(2) { width: 80%; }
.preview-report i:nth-child(3) { width: 55%; }
.preview-report b { aspect-ratio: 1; border: 3px solid var(--preview-accent); border-right-color: #45534c; border-radius: 50%; }
.preview-action { height: 12%; width: 35%; background: var(--preview-accent); border-radius: 2px; }
@media (prefers-reduced-motion: reduce) { .preview-window { transition: none; } .theme-preview:hover .preview-window { transform: rotate(-5deg); } }
</style>
