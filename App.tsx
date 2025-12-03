
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebGPUCanvas } from './components/WebGPUCanvas';
import { Controls } from './components/Controls';
import { SimulationParams, WebGPUStatus } from './types';

// Initial Params
const INITIAL_PARAMS: SimulationParams = {
  particleCount: 100000, // Reduced default for broader compatibility
  speed: 1.0,
  interactionRadius: 0.35,
  forceStrength: 1.5,
  colorScheme: 'neon',
};

const App: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>(INITIAL_PARAMS);
  const [status, setStatus] = useState<WebGPUStatus>(WebGPUStatus.Loading);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [fps, setFps] = useState(0);
  
  // FPS Counter
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const loop = () => {
      const now = performance.now();
      frameCountRef.current++;
      
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      requestAnimationFrame(loop);
    };
    const id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  const handleStatusChange = useCallback((newStatus: WebGPUStatus, msg?: string) => {
    setStatus(newStatus);
    if (msg) setErrorMsg(msg);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans">
      
      {/* Simulation Layer */}
      {status !== WebGPUStatus.Error && status !== WebGPUStatus.Unsupported && (
        <div className="absolute inset-0 z-0">
          <WebGPUCanvas 
            simParams={params} 
            onStatusChange={handleStatusChange} 
          />
        </div>
      )}

      {/* UI Overlay */}
      <Controls params={params} onChange={setParams} fps={fps} />

      {/* Loading / Error States */}
      {(status === WebGPUStatus.Loading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl text-white font-light tracking-widest">INITIALIZING GPU</h2>
          </div>
        </div>
      )}

      {(status === WebGPUStatus.Unsupported || status === WebGPUStatus.Error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50 p-8">
          <div className="max-w-md text-center border border-red-900 bg-red-900/20 p-8 rounded-lg">
            <h2 className="text-2xl text-red-500 font-bold mb-4">WebGPU Error</h2>
            <p className="text-gray-300 mb-6">
              {status === WebGPUStatus.Unsupported 
                ? "Your browser does not support WebGPU. Please use Chrome 113+ or Edge." 
                : errorMsg}
            </p>
            <a 
              href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status" 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Check Compatibility
            </a>
          </div>
        </div>
      )}

      {/* Overlay Title */}
      <div className="absolute top-6 left-6 pointer-events-none z-10">
        <h1 className="text-4xl font-black text-white tracking-tighter mix-blend-difference opacity-80">
          PARTICLE<span className="text-cyan-400">FLOW</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1 tracking-widest uppercase">
          {params.particleCount.toLocaleString()} Entities • Mass Compute
        </p>
      </div>

    </div>
  );
};

export default App;
