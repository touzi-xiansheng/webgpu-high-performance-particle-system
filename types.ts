export interface SimulationParams {
  particleCount: number;
  speed: number;
  interactionRadius: number;
  forceStrength: number;
  colorScheme: 'neon' | 'fire' | 'ocean';
}

export enum WebGPUStatus {
  Loading = 'loading',
  Supported = 'supported',
  Unsupported = 'unsupported',
  Error = 'error'
}
