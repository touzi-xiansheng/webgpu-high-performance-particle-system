
import React from 'react';
import { SimulationParams } from '../types';

interface ControlsProps {
  params: SimulationParams;
  onChange: (params: SimulationParams) => void;
  fps: number;
}

export const Controls: React.FC<ControlsProps> = ({ params, onChange, fps }) => {
  const handleChange = (key: keyof SimulationParams, value: number | string) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="absolute top-4 right-4 w-72 bg-black/80 backdrop-blur-md border border-gray-800 text-white p-6 rounded-xl shadow-2xl z-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Control Panel
        </h2>
        <span className="text-xs font-mono text-green-400">{Math.round(fps)} FPS</span>
      </div>

      <div className="space-y-5">
        
        {/* Particle Count Info */}
        <div className="flex justify-between text-xs text-gray-400">
          <span>Particles</span>
          <span>{params.particleCount.toLocaleString()}</span>
        </div>

        {/* Color Scheme */}
        <div className="space-y-2">
          <label className="text-sm">Color Theme</label>
          <div className="flex gap-2">
            {['neon', 'fire', 'ocean'].map((scheme) => (
              <button
                key={scheme}
                onClick={() => handleChange('colorScheme', scheme)}
                className={`flex-1 py-1 px-2 text-xs rounded border transition-all ${
                  params.colorScheme === scheme
                    ? 'bg-gray-700 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                } uppercase tracking-wider`}
              >
                {scheme}
              </button>
            ))}
          </div>
        </div>

        {/* Speed */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label>Fluidity</label>
            <span className="text-gray-400">{params.speed.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={params.speed}
            onChange={(e) => handleChange('speed', parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        {/* Interaction Radius */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label>Vortex Radius</label>
            <span className="text-gray-400">{params.interactionRadius.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.8"
            step="0.01"
            value={params.interactionRadius}
            onChange={(e) => handleChange('interactionRadius', parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Force Strength */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label>Force Strength</label>
            <span className="text-gray-400">{params.forceStrength.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.1"
            value={params.forceStrength}
            onChange={(e) => handleChange('forceStrength', parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
          />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-500">
        <p>• Hover to create vortex</p>
        <p>• Click to repel/explode</p>
      </div>
    </div>
  );
};
