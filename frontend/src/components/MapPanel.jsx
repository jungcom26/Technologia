import React from "react";

export default function MapPanel() {
  return (
    <section className="map" aria-label="World map">
      <svg viewBox="0 0 800 600" className="map-svg" role="img" aria-label="Fantasy map">
        <defs>
          <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b9c8ff" />
            <stop offset="100%" stopColor="#d9e2ff" />
          </linearGradient>
          <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2d9a0" />
            <stop offset="100%" stopColor="#9cc47e" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#water)" />
        <path d="M130,260 C100,200 190,190 240,210 C290,230 320,270 280,310 C240,350 170,340 130,300 Z"
              fill="url(#land)" stroke="#6aa36f" strokeOpacity=".6" />
        <path d="M420,170 C380,130 520,120 560,170 C600,220 590,260 540,280 C490,300 460,230 420,170 Z"
              fill="url(#land)" stroke="#6aa36f" strokeOpacity=".6" />
        <path d="M520,360 C480,330 610,330 650,380 C690,430 640,470 590,470 C540,470 560,400 520,360 Z"
              fill="url(#land)" stroke="#6aa36f" strokeOpacity=".6" />
        <g><circle cx="250" cy="260" r="6" fill="#6f7ff7" /><text x="260" y="255" fill="#342b4a" fontSize="12">Greywatch</text></g>
        <g><circle cx="560" cy="200" r="6" fill="#6f7ff7" /><text x="570" y="195" fill="#342b4a" fontSize="12">Whisper Reefs</text></g>
        <g><circle cx="600" cy="420" r="6" fill="#6f7ff7" /><text x="610" y="415" fill="#342b4a" fontSize="12">Old Lighthouse</text></g>
      </svg>
    </section>
  );
}
