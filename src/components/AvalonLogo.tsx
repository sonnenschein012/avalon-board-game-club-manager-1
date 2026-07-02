import React from 'react';

export default function AvalonLogo({ className = "", width = "100%", height = "100%" }) {
  const gold = "#f5a700";
  const navy = "#092e47"; 

  // original aspect ratio viewbox: -10 -20 120 170
  // which is 120 width x 190 height. (100 is grid width + 20 padding = 120).
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="-10 -20 120 170" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Crown */}
      <polygon 
        points="14,35 0,-10 35,20 50,-15 65,20 100,-10 86,35" 
        fill={gold} 
      />

      {/* Grid */}
      <g transform="translate(0, 42)">
        {/* Row 1 */}
        <rect x="0" y="0" width="30" height="30" fill={gold} />
        <circle cx="15" cy="15" r="11" fill={navy} />
        
        <rect x="35" y="0" width="30" height="30" fill={gold} />
        <circle cx="50" cy="15" r="11" fill={navy} />
        
        <rect x="70" y="0" width="30" height="30" fill={gold} />
        <circle cx="85" cy="15" r="11" fill={navy} />

        {/* Row 2 */}
        <rect x="0" y="35" width="30" height="30" fill={gold} />
        <circle cx="15" cy="50" r="11" fill={navy} />
        
        <rect x="35" y="35" width="30" height="30" fill={navy} />
        <circle cx="50" cy="50" r="11" fill={gold} />
        
        <rect x="70" y="35" width="30" height="30" fill={gold} />
        <circle cx="85" cy="50" r="11" fill={navy} />

        {/* Row 3 */}
        <rect x="0" y="70" width="30" height="30" fill={gold} />
        <circle cx="15" cy="85" r="11" fill={navy} />
        
        <rect x="35" y="70" width="30" height="30" fill={gold} />
        <circle cx="50" cy="85" r="11" fill={navy} />
        
        <rect x="70" y="70" width="30" height="30" fill={gold} />
        <circle cx="85" cy="85" r="11" fill={navy} />
      </g>
    </svg>
  );
}
