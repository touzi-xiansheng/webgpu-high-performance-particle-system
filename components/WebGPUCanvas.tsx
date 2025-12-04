
import React, { useRef, useEffect, useCallback } from 'react';
import { COMPUTE_SHADER, RENDER_SHADER } from '../constants';
import { SimulationParams, WebGPUStatus } from '../types';

interface WebGPUCanvasProps {
  simParams: SimulationParams;
  onStatusChange: (status: WebGPUStatus, error?: string) => void;
}

// Polyfill for missing types
const GPUShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4
};

const GPUBufferUsage = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200
};

// Map color scheme string to float for shader
const getColorSchemeValue = (scheme: string): number => {
  switch (scheme) {
    case 'fire': return 1.0;
    case 'ocean': return 2.0;
    default: return 0.0; // neon
  }
};

export const WebGPUCanvas: React.FC<WebGPUCanvasProps> = ({ simParams, onStatusChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Ref to hold params so we don't restart animation loop on slider change
  const paramsRef = useRef(simParams);
  
  useEffect(() => {
    paramsRef.current = simParams;
  }, [simParams]);

  const contextRef = useRef<{
    device: any;
    context: any;
    computePipeline: any;
    renderPipeline: any;
    particleBuffers: any[];
    uniformBuffer: any;
    bindGroups: any[];
    step: number;
    presentationFormat: any;
  } | null>(null);

  const requestRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; isDown: boolean }>({ x: 0, y: 0, isDown: false });

  // Initialize WebGPU - Only depends on particleCount to resize buffers
  const initWebGPU = useCallback(async () => {
    const navigatorAny = navigator as any;
    if (!navigatorAny.gpu) {
      onStatusChange(WebGPUStatus.Unsupported);
      return;
    }

    try {
      onStatusChange(WebGPUStatus.Loading);
      const adapter = await navigatorAny.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        onStatusChange(WebGPUStatus.Error, "No GPU adapter found.");
        return;
      }

      const device = await adapter.requestDevice();
      
      // Error logging
      device.pushErrorScope('validation');

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('webgpu') as any;
      if (!context) {
        onStatusChange(WebGPUStatus.Error, "Could not get WebGPU context.");
        return;
      }

      // Initial canvas sizing to match viewport & DPR
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const presentationFormat = navigatorAny.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'opaque', 
      });

      // --- Create Pipelines ---

      const computeModule = device.createShaderModule({ 
        label: 'Compute Module',
        code: COMPUTE_SHADER 
      });
      
      // Combined Render Module
      const renderModule = device.createShaderModule({ 
        label: 'Render Module',
        code: RENDER_SHADER 
      });

      // Compute Pipeline
      const computeBindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ]
      });

      const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
        compute: { module: computeModule, entryPoint: 'main' },
      });

      // Render Pipeline
      const renderBindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        ]
      });

      const renderPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
        vertex: {
          module: renderModule,
          entryPoint: 'vs_main', // New Entry Point
        },
        fragment: {
          module: renderModule,
          entryPoint: 'fs_main', // New Entry Point
          targets: [{ 
            format: presentationFormat,
            blend: { 
               // Additive blending for glowing effect
               color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
               alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' }
            }
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      // --- Create Buffers ---
      const numParticles = paramsRef.current.particleCount; 
      const particleData = new Float32Array(numParticles * 4); 

      // Initialize random positions
      for (let i = 0; i < numParticles; i++) {
        particleData[i * 4] = (Math.random() * 2 - 1); // x
        particleData[i * 4 + 1] = (Math.random() * 2 - 1); // y
        particleData[i * 4 + 2] = (Math.random() - 0.5) * 0.05; // vx
        particleData[i * 4 + 3] = (Math.random() - 0.5) * 0.05; // vy
      }

      const particleBuffers = [
        device.createBuffer({
          size: particleData.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        }),
        device.createBuffer({
          size: particleData.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        }),
      ];

      device.queue.writeBuffer(particleBuffers[0], 0, particleData);
      device.queue.writeBuffer(particleBuffers[1], 0, particleData);

      // Uniform Buffer
      const uniformBufferSize = 48; 
      const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // --- Create Bind Groups ---

      const bindGroups: any[] = [];
      
      bindGroups[0] = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: particleBuffers[0] } },
          { binding: 2, resource: { buffer: particleBuffers[1] } },
        ],
      });

      bindGroups[1] = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: particleBuffers[1] } },
          { binding: 2, resource: { buffer: particleBuffers[0] } },
        ],
      });
      
      bindGroups[2] = device.createBindGroup({
        layout: renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: particleBuffers[0] } },
        ],
      });

      bindGroups[3] = device.createBindGroup({
        layout: renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: particleBuffers[1] } },
        ],
      });

      contextRef.current = {
        device,
        context,
        computePipeline,
        renderPipeline,
        particleBuffers,
        uniformBuffer,
        bindGroups,
        step: 0,
        presentationFormat
      };
      
      // Check for validation errors
      device.popErrorScope().then((error: any) => {
          if (error) {
              console.error("WebGPU Validation Error during init:", error.message);
              onStatusChange(WebGPUStatus.Error, "Validation Error: " + error.message);
          } else {
             onStatusChange(WebGPUStatus.Supported);
          }
      });

    } catch (error) {
      console.error(error);
      onStatusChange(WebGPUStatus.Error, error instanceof Error ? error.message : "Unknown WebGPU error");
    }
  }, [simParams.particleCount, onStatusChange]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      if (contextRef.current) {
        contextRef.current.context.configure({
          device: contextRef.current.device,
          format: contextRef.current.presentationFormat,
          alphaMode: 'opaque',
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Event Listeners for Mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1); 
      mouseRef.current = { x, y, isDown: (e.buttons & 1) === 1 };
    };

    const handleDown = () => { mouseRef.current.isDown = true; };
    const handleUp = () => { mouseRef.current.isDown = false; };

    window.addEventListener('mousemove', updateMouse);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', updateMouse);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  // Main Loop
  const animate = useCallback((time: number) => {
    if (!contextRef.current) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    const { 
      device, context, computePipeline, renderPipeline, 
      uniformBuffer, bindGroups, step 
    } = contextRef.current;

    const canvas = canvasRef.current;
    
    // Safety check for canvas dimensions
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    const currentParams = paramsRef.current;
    
    // Safety check for particle count
    if (currentParams.particleCount <= 0) {
        requestRef.current = requestAnimationFrame(animate);
        return;
    }

    // 1. Update Uniforms
    const uniformData = new Float32Array([
      mouseRef.current.x, mouseRef.current.y, // 0-8
      canvas.width, canvas.height,            // 8-16
      0.016,                                  // 16-20 (dt)
      currentParams.speed,                    // 20-24
      currentParams.interactionRadius,        // 24-28
      currentParams.forceStrength,            // 28-32
      mouseRef.current.isDown ? 1.0 : 0.0,    // 32-36
      getColorSchemeValue(currentParams.colorScheme), // 36-40
      0.0, 0.0 // Padding
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // 2. Encode Commands
    const commandEncoder = device.createCommandEncoder();

    // Compute Pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, bindGroups[step % 2]); 
    const workgroupSize = 64;
    const workgroupCount = Math.ceil(currentParams.particleCount / workgroupSize);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();

    // Render Pass
    const textureView = context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // Pure black, opaque
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(renderPipeline);
    const renderBindGroupIndex = (step % 2 === 0) ? 3 : 2;
    renderPass.setBindGroup(0, bindGroups[renderBindGroupIndex]);
    
    // Draw Instanced Quads: 6 vertices per quad, N instances (particles)
    renderPass.draw(6, currentParams.particleCount);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    contextRef.current.step++;
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  // Init and Start Loop
  useEffect(() => {
    let cancelled = false;

    initWebGPU().then(() => {
      if (!cancelled) {
        requestRef.current = requestAnimationFrame(animate);
      }
    });

    return () => {
      cancelled = true;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [initWebGPU, animate]);

  return <canvas ref={canvasRef} className="w-full h-full block bg-black" />;
};
