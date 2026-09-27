export function HeroOrbitVisual() {
  return (
    <div className="relative w-full max-w-[620px] aspect-square flex items-center justify-center p-4 select-none">
      <svg
        viewBox="0 0 700 700"
        width="100%"
        height="100%"
        className="w-full h-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Atmosfera discreta / iluminação sutil */}
          <radialGradient id="saturnWarmHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF4103" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#FF4103" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#001621" stopOpacity="0" />
          </radialGradient>

          {/* Gradiente Sólido e Rico do Planeta Saturno */}
          <radialGradient id="saturnBody" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#FFA87A" />
            <stop offset="22%" stopColor="#FE5516" />
            <stop offset="65%" stopColor="#FF4103" />
            <stop offset="90%" stopColor="#C93200" />
            <stop offset="100%" stopColor="#731600" />
          </radialGradient>

          {/* Anéis Traseiros (Back Rings) */}
          <linearGradient id="ringBackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9C2600" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#591300" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#9C2600" stopOpacity="0.75" />
          </linearGradient>

          {/* Anéis Frontais (Front Rings) */}
          <linearGradient id="ringFrontGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFAE7E" />
            <stop offset="35%" stopColor="#FF4103" />
            <stop offset="52%" stopColor="#F5F5DC" />
            <stop offset="70%" stopColor="#FE5516" />
            <stop offset="100%" stopColor="#FF4103" />
          </linearGradient>

          {/* Sombra para as embalagens flutuantes */}
          <filter id="boxShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#00090F" floodOpacity="0.55" />
          </filter>

          {/* Gradientes para EMBALAGEM 1: Caixa de Hambúrguer */}
          <linearGradient id="burgerTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F9F6EE" />
            <stop offset="100%" stopColor="#E8DFCF" />
          </linearGradient>
          <linearGradient id="burgerLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D6C7B2" />
            <stop offset="100%" stopColor="#BAA78E" />
          </linearGradient>
          <linearGradient id="burgerRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E0D2BE" />
            <stop offset="100%" stopColor="#C7B49B" />
          </linearGradient>

          {/* Gradientes para EMBALAGEM 2: Caixa de Pizza */}
          <linearGradient id="pizzaTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F4EFE6" />
          </linearGradient>
          <linearGradient id="pizzaLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#DFD7CB" />
            <stop offset="100%" stopColor="#C2B8A8" />
          </linearGradient>
          <linearGradient id="pizzaRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ECE5D9" />
            <stop offset="100%" stopColor="#D3C8B7" />
          </linearGradient>

          {/* Gradientes para EMBALAGEM 3: Caixa de Salgados */}
          <linearGradient id="snackTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F6EFE5" />
          </linearGradient>
          <linearGradient id="snackLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#DFD2C2" />
            <stop offset="100%" stopColor="#C2B19F" />
          </linearGradient>
          <linearGradient id="snackRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EBE0D3" />
            <stop offset="100%" stopColor="#D0BFAC" />
          </linearGradient>

          <style>{`
            @keyframes sceneFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-8px); }
            }

            @keyframes planetSubtleBreathing {
              0%, 100% { transform: rotate(-22deg) scale(1); }
              50% { transform: rotate(-20.5deg) scale(1.008); }
            }

            @keyframes orbitBurgerSlow {
              0%, 100% {
                transform: translate(0px, 0px) rotate(0deg);
              }
              50% {
                transform: translate(-10px, -14px) rotate(-2deg);
              }
            }

            @keyframes orbitPizzaSlow {
              0%, 100% {
                transform: translate(0px, 0px) rotate(0deg);
              }
              50% {
                transform: translate(12px, -10px) rotate(2deg);
              }
            }

            @keyframes orbitSnackSlow {
              0%, 100% {
                transform: translate(0px, 0px) rotate(0deg);
              }
              50% {
                transform: translate(-8px, 12px) rotate(1.5deg);
              }
            }

            @keyframes orbitParticleA {
              0% { transform: rotate(0deg) translateX(285px) rotate(0deg); opacity: 0.25; }
              50% { opacity: 0.85; transform: rotate(180deg) translateX(285px) rotate(-180deg); }
              100% { transform: rotate(360deg) translateX(285px) rotate(-360deg); opacity: 0.25; }
            }

            @keyframes orbitParticleB {
              0% { transform: rotate(210deg) translateX(245px) rotate(-210deg); opacity: 0.2; }
              50% { opacity: 0.75; transform: rotate(390deg) translateX(245px) rotate(-390deg); }
              100% { transform: rotate(570deg) translateX(245px) rotate(-570deg); opacity: 0.2; }
            }

            .scene-group {
              transform-origin: 350px 350px;
              animation: sceneFloat 8s ease-in-out infinite;
            }

            .planet-system {
              transform-origin: 350px 350px;
              animation: planetSubtleBreathing 14s ease-in-out infinite;
            }

            .burger-box {
              transform-origin: 475px 230px;
              animation: orbitBurgerSlow 9s ease-in-out infinite;
            }

            .pizza-box {
              transform-origin: 215px 440px;
              animation: orbitPizzaSlow 8.5s ease-in-out infinite;
            }

            .snack-box {
              transform-origin: 505px 455px;
              animation: orbitSnackSlow 9.5s ease-in-out infinite;
            }

            .particle-a {
              transform-origin: 350px 350px;
              animation: orbitParticleA 26s linear infinite;
            }

            .particle-b {
              transform-origin: 350px 350px;
              animation: orbitParticleB 32s linear infinite;
            }
          `}</style>
        </defs>

        {/* Fundo com Halo suave */}
        <circle cx="350" cy="350" r="310" fill="url(#saturnWarmHalo)" />

        <g className="scene-group">
          {/* Linhas orbitais */}
          <ellipse
            cx="350"
            cy="350"
            rx="300"
            ry="105"
            fill="none"
            stroke="#FF4103"
            strokeWidth="1.2"
            strokeDasharray="8 12"
            strokeOpacity="0.18"
            transform="rotate(-21 350 350)"
          />
          <ellipse
            cx="350"
            cy="350"
            rx="260"
            ry="90"
            fill="none"
            stroke="#F5F5DC"
            strokeWidth="0.8"
            strokeOpacity="0.1"
            transform="rotate(-21 350 350)"
          />

          {/* 1. ANÉIS TRASEIROS */}
          <g className="planet-system">
            <path
              d="M 55,350 A 295,88 0 0,1 645,350"
              fill="none"
              stroke="url(#ringBackGrad)"
              strokeWidth="17"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M 105,350 A 245,72 0 0,1 595,350"
              fill="none"
              stroke="url(#ringBackGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.7"
            />
            <path
              d="M 160,350 A 190,56 0 0,1 540,350"
              fill="none"
              stroke="#8A1C00"
              strokeWidth="3"
              opacity="0.55"
            />
          </g>

          {/* 2. EMBALAGEM EM ÓRBITA TRASEIRA (HAMBÚRGUER) */}
          <g className="burger-box" filter="url(#boxShadow)">
            <g transform="translate(475, 230) scale(0.78)">
              <polygon
                points="0,-36 46,-12 0,12 -46,-12"
                fill="url(#burgerTop)"
                stroke="#FFF8ED"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <polygon
                points="-46,-12 0,12 0,44 -46,20"
                fill="url(#burgerLeft)"
                stroke="#E5D6C1"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <polygon
                points="0,12 46,-12 46,20 0,44"
                fill="url(#burgerRight)"
                stroke="#D8C5AD"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <line x1="-46" y1="-2" x2="0" y2="22" stroke="#FE5516" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="22" x2="46" y2="-2" stroke="#FE5516" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="0" cy="-12" rx="12" ry="6" fill="#FF4103" opacity="0.95" />
              <circle cx="0" cy="-12" r="2" fill="#F5F5DC" />
              <line x1="-15" y1="-20" x2="-8" y2="-17" stroke="#BAA78E" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="8" y1="-17" x2="15" y2="-20" stroke="#BAA78E" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          </g>

          {/* 3. PLANETA SATURNO */}
          <g id="saturn-planet-core">
            <circle cx="350" cy="350" r="142" fill="url(#saturnBody)" />
            <clipPath id="planetSphereClip">
              <circle cx="350" cy="350" r="142" />
            </clipPath>
            <g clipPath="url(#planetSphereClip)">
              <path d="M 180,310 Q 350,350 520,310 L 520,360 Q 350,400 180,360 Z" fill="#8C1C00" opacity="0.6" />
              <path d="M 180,260 Q 350,300 520,260 L 520,290 Q 350,330 180,290 Z" fill="#FF7235" opacity="0.35" />
              <path d="M 180,220 Q 350,255 520,220 L 520,240 Q 350,275 180,240 Z" fill="#FFA57A" opacity="0.2" />
              <ellipse cx="350" cy="372" rx="165" ry="38" fill="#00111A" opacity="0.6" transform="rotate(-21 350 372)" />
              <ellipse cx="310" cy="270" rx="80" ry="40" fill="#FFFFFF" opacity="0.12" transform="rotate(-15 310 270)" />
            </g>
          </g>

          {/* 4. ANÉIS FRONTAIS */}
          <g className="planet-system">
            <path
              d="M 645,350 A 295,88 0 0,1 55,350"
              fill="none"
              stroke="url(#ringFrontGrad)"
              strokeWidth="19"
              strokeLinecap="round"
            />
            <path
              d="M 625,352 A 275,82 0 0,1 75,352"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            <path
              d="M 595,350 A 245,72 0 0,1 105,350"
              fill="none"
              stroke="url(#ringFrontGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M 540,350 A 190,56 0 0,1 160,350"
              fill="none"
              stroke="#FFAE7E"
              strokeWidth="3"
              opacity="0.75"
            />
          </g>

          {/* 5. EMBALAGEM EM ÓRBITA FRONTAL 1 (PIZZA) */}
          <g className="pizza-box" filter="url(#boxShadow)">
            <g transform="translate(210, 445) scale(0.82)">
              <polygon
                points="0,-38 72,-8 0,22 -72,-8"
                fill="url(#pizzaTop)"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <polygon
                points="-72,-8 0,22 0,38 -72,8"
                fill="url(#pizzaLeft)"
                stroke="#DFD7CB"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <polygon
                points="0,22 72,-8 72,8 0,38"
                fill="url(#pizzaRight)"
                stroke="#D5CCC0"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M -15,-15 L 0,30 L 0,38 L -15,-7 Z" fill="#FF4103" opacity="0.95" />
              <line x1="-30" y1="-18" x2="30" y2="8" stroke="#FF4103" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
              <ellipse cx="10" cy="-5" rx="14" ry="7" fill="#FE5516" opacity="0.15" />
              <circle cx="10" cy="-5" r="4.5" fill="#FE5516" />
              <circle cx="10" cy="-5" r="2" fill="#F5F5DC" />
              <polygon points="-60,-6 -52,-3 -60,0" fill="#B0A696" opacity="0.6" />
            </g>
          </g>

          {/* 6. EMBALAGEM EM ÓRBITA FRONTAL 2 (SALGADOS) */}
          <g className="snack-box" filter="url(#boxShadow)">
            <g transform="translate(515, 465) scale(0.76)">
              <polygon
                points="0,-48 44,-24 0,0 -44,-24"
                fill="url(#snackTop)"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <polygon
                points="-44,-24 0,0 0,44 -44,20"
                fill="url(#snackLeft)"
                stroke="#DFD0C0"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <polygon
                points="0,0 44,-24 44,20 0,44"
                fill="url(#snackRight)"
                stroke="#D4C3B1"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M -18,-42 L -18,-56 C -18,-60 18,-60 18,-56 L 18,-42 Z"
                fill="#FE5516"
                stroke="#FF4103"
                strokeWidth="1.8"
              />
              <rect x="-8" y="-55" width="16" height="4" rx="2" fill="#001621" opacity="0.4" />
              <polygon points="-12,12 12,2 12,22 -12,32" fill="#FF4103" opacity="0.92" />
              <line x1="-8" y1="20" x2="8" y2="13" stroke="#F5F5DC" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </g>

          {/* 7. PONTOS ORBITAIS (Partículas) */}
          <g className="particle-a">
            <circle cx="350" cy="350" r="3.5" fill="#FFFFFF" />
            <circle cx="350" cy="350" r="7" fill="#FF4103" opacity="0.45" />
          </g>

          <g className="particle-b">
            <circle cx="350" cy="350" r="3" fill="#F5F5DC" />
            <circle cx="350" cy="350" r="6" fill="#FE5516" opacity="0.4" />
          </g>
        </g>
      </svg>
    </div>
  );
}
