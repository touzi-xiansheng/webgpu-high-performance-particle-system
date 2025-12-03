

// Physics Compute Shader
export const COMPUTE_SHADER = `
struct Particle {
  pos : vec2f,
  vel : vec2f,
};

struct SimParams {
  mousePos : vec2f,
  resolution : vec2f,
  deltaTime : f32,
  speed : f32,
  radius : f32,
  force : f32,
  isClicking : f32,
  colorScheme : f32,
};

@group(0) @binding(0) var<uniform> params : SimParams;
@group(0) @binding(1) var<storage, read> inputParticles : array<Particle>;
@group(0) @binding(2) var<storage, read_write> outputParticles : array<Particle>;

// Hash function for randomness
fn hash(value: u32) -> f32 {
  var state = value;
  state = state ^ 2747636419u;
  state = state * 2654435769u;
  state = state ^ (state >> 16u);
  state = state * 2654435769u;
  state = state ^ (state >> 16u);
  state = state * 2654435769u;
  return f32(state) / 4294967295.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3u) {
  let index = GlobalInvocationID.x;
  if (index >= arrayLength(&outputParticles)) {
    return;
  }

  var particle = inputParticles[index];
  
  // Safe resolution access
  let resX = max(params.resolution.x, 1.0);
  let resY = max(params.resolution.y, 1.0);
  let aspect = resX / resY;
  
  let mouse = params.mousePos; 
  
  // Vector from particle to mouse
  let distVec = mouse - particle.pos;
  let distVecCorrected = vec2f(distVec.x * aspect, distVec.y);
  let dist = length(distVecCorrected);

  // --- Physics: Flow Field & Noise ---
  let scale = 3.0;
  
  // Static flow field
  let flow = vec2f(
    sin(particle.pos.y * scale * 3.14 + particle.pos.x),
    cos(particle.pos.x * scale * 3.14 + particle.pos.y * 0.5)
  );

  // --- Physics: Interaction ---
  var force = vec2f(0.0, 0.0);
  
  if (dist < params.radius) {
    let t = 1.0 - dist / params.radius;
    let strength = t * params.force;
    
    let dir = normalize(distVec);
    let tangent = vec2f(-dir.y, dir.x);

    if (params.isClicking > 0.5) {
       // Click: Repel
       force = -dir * strength * 10.0; 
    } else {
       // Hover: Swirl
       force = (dir * 0.5 + tangent * 8.0) * strength;
    }
  }

  // Update Velocity
  particle.vel = particle.vel * 0.96 + (flow * 0.1 * params.speed * 0.01) + (force * params.deltaTime * 5.0);
  
  // Update Position
  particle.pos = particle.pos + particle.vel * params.speed * params.deltaTime * 60.0;

  // Boundary wrap-around
  if (particle.pos.x < -1.0) { particle.pos.x += 2.0; }
  if (particle.pos.x > 1.0) { particle.pos.x -= 2.0; }
  if (particle.pos.y < -1.0) { particle.pos.y += 2.0; }
  if (particle.pos.y > 1.0) { particle.pos.y -= 2.0; }

  outputParticles[index] = particle;
}
`;

// Combined Render Shader (Vertex + Fragment)
export const RENDER_SHADER = `
struct Particle {
  pos : vec2f,
  vel : vec2f,
};

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
  @location(1) uv : vec2f,
};

struct SimParams {
  mousePos : vec2f,
  resolution : vec2f,
  deltaTime : f32,
  speed : f32,
  radius : f32,
  force : f32,
  isClicking : f32,
  colorScheme : f32,
};

@group(0) @binding(0) var<uniform> params : SimParams;
@group(0) @binding(1) var<storage, read> particles : array<Particle>;

// Color Functions
fn getNeonColor(t: f32) -> vec3f {
  let c1 = vec3f(0.05, 0.6, 1.0); // Cyan
  let c2 = vec3f(0.6, 0.0, 1.0);  // Purple
  let c3 = vec3f(1.0, 0.9, 0.5);  // White/Gold
  if (t < 0.5) { return mix(c1, c2, t * 2.0); }
  return mix(c2, c3, (t - 0.5) * 2.0);
}

fn getFireColor(t: f32) -> vec3f {
  let c1 = vec3f(0.5, 0.0, 0.0);
  let c2 = vec3f(1.0, 0.3, 0.0);
  let c3 = vec3f(1.0, 0.9, 0.1);
  if (t < 0.5) { return mix(c1, c2, t * 2.0); }
  return mix(c2, c3, (t - 0.5) * 2.0);
}

fn getOceanColor(t: f32) -> vec3f {
  let c1 = vec3f(0.0, 0.1, 0.3);
  let c2 = vec3f(0.0, 0.5, 0.7);
  let c3 = vec3f(0.6, 1.0, 0.9);
  if (t < 0.5) { return mix(c1, c2, t * 2.0); }
  return mix(c2, c3, (t - 0.5) * 2.0);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vIndex : u32,
  @builtin(instance_index) iIndex : u32
) -> VertexOutput {
  var particle = particles[iIndex];
  var output : VertexOutput;
  
  // Billboarding logic: Generate a quad from 6 vertices
  var pos = vec2f(0.0, 0.0);
  var uv = vec2f(0.0, 0.0);
  
  let corner = vIndex % 6u;
  if (corner == 0u) { pos = vec2f(-1.0, -1.0); uv = vec2f(0.0, 0.0); }
  else if (corner == 1u) { pos = vec2f( 1.0, -1.0); uv = vec2f(1.0, 0.0); }
  else if (corner == 2u) { pos = vec2f(-1.0,  1.0); uv = vec2f(0.0, 1.0); }
  else if (corner == 3u) { pos = vec2f(-1.0,  1.0); uv = vec2f(0.0, 1.0); }
  else if (corner == 4u) { pos = vec2f( 1.0, -1.0); uv = vec2f(1.0, 0.0); }
  else if (corner == 5u) { pos = vec2f( 1.0,  1.0); uv = vec2f(1.0, 1.0); }

  // Particle Size (in pixels approx, converted to NDC)
  let size = 4.0; 
  let resX = max(params.resolution.x, 1.0);
  let resY = max(params.resolution.y, 1.0);
  
  // Convert pixel size to clip space
  let sizeX = size / resX * 2.0; 
  let sizeY = size / resY * 2.0;

  // Apply position
  let finalPos = particle.pos + vec2f(pos.x * sizeX, pos.y * sizeY);
  output.position = vec4f(finalPos, 0.0, 1.0);
  output.uv = uv;
  
  // Color calculation based on speed
  let speed = length(particle.vel) * 80.0; // Adjusted scale
  let t = clamp(speed, 0.0, 1.0);
  var colorRGB : vec3f;
  
  if (params.colorScheme < 0.5) { colorRGB = getNeonColor(t); }
  else if (params.colorScheme < 1.5) { colorRGB = getFireColor(t); }
  else { colorRGB = getOceanColor(t); }
  
  output.color = vec4f(colorRGB, 1.0);
  return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4f {
  // Circular Glow
  let dist = distance(input.uv, vec2f(0.5, 0.5));
  if (dist > 0.5) { discard; }

  // Soft glow from center
  let strength = 1.0 - (dist * 2.0);
  let alpha = pow(strength, 2.0);

  // Boost alpha for visibility
  return vec4f(input.color.rgb, alpha * 1.5);
}
`;