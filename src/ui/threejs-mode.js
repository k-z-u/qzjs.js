import * as THREE from 'three';

/**
 * Three.js based UI mode for quiz celebrations
 * Adds floating particles, confetti, and 3D effects when answering correctly
 */
export class ThreeJSMode {
  constructor() {
    this.enabled = false;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.confettiGroup = null;
    this.animationId = null;
    this.container = null;
    this.resizeObserver = null;
  }

  /**
   * Initialize the Three.js scene
   */
  init() {
    if (this.scene) return;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'threejs-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.5s ease;
    `;
    document.body.appendChild(this.container);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 50;

    // Renderer with transparency
    this.renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: 'low-power'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Add point light
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(10, 10, 10);
    this.scene.add(pointLight);

    // Create background particles
    this.createBackgroundParticles();

    // Handle resize
    this.resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    this.resizeObserver.observe(document.body);

    // Start animation loop
    this.animate();
  }

  /**
   * Create background particle system
   */
  createBackgroundParticles() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorPalette = [
      new THREE.Color(0x2563eb),
      new THREE.Color(0x3b82f6),
      new THREE.Color(0x60a5fa),
      new THREE.Color(0x93c5fd),
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 25;

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  /**
   * Create celebration confetti
   */
  createConfetti() {
    if (!this.scene) return;

    this.confettiGroup = new THREE.Group();
    
    const confettiCount = 100;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const colors = [
      0xff6b6b, 0x4ecdc4, 0xffd93d, 0x6bcb77, 
      0x4d96ff, 0xf72585, 0x7209b7, 0x4cc9f0
    ];

    for (let i = 0; i < confettiCount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // Random starting position from top
      mesh.position.x = (Math.random() - 0.5) * 80;
      mesh.position.y = 40 + Math.random() * 20;
      mesh.position.z = (Math.random() - 0.5) * 30;
      
      // Random rotation
      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.y = Math.random() * Math.PI;
      
      // Store velocity data
      mesh.userData = {
        velocityY: -0.3 - Math.random() * 0.3,
        velocityX: (Math.random() - 0.5) * 0.2,
        rotationSpeed: {
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1,
        },
      };
      
      this.confettiGroup.add(mesh);
    }

    this.scene.add(this.confettiGroup);
  }

  /**
   * Create floating check mark
   */
  createCheckMark() {
    if (!this.scene) return null;

    const shape = new THREE.Shape();
    const width = 8;
    const height = 6;
    
    shape.moveTo(-width/2, 0);
    shape.lineTo(-width/4, height/3);
    shape.lineTo(width/6, height);
    shape.lineTo(width/2, -height/3);
    shape.lineTo(width/3, -height/2);
    shape.lineTo(width/8, height/4);
    shape.lineTo(-width/6, -height/6);
    shape.closePath();

    const extrudeSettings = {
      depth: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 2,
      bevelSize: 0.5,
      bevelThickness: 0.5,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const material = new THREE.MeshPhongMaterial({
      color: 0x4ade80,
      shininess: 100,
      specular: 0x22c55e,
    });

    const checkMark = new THREE.Mesh(geometry, material);
    checkMark.position.set(0, 0, 10);
    checkMark.rotation.z = -Math.PI / 8;
    
    // Scale down initially for animation
    checkMark.scale.set(0, 0, 0);
    
    this.scene.add(checkMark);
    
    // Animate in
    let scale = 0;
    const animateIn = () => {
      scale += 0.08;
      if (scale <= 1.2) {
        checkMark.scale.set(scale, scale, scale);
        requestAnimationFrame(animateIn);
      } else {
        // Settle to normal size
        checkMark.scale.set(1, 1, 1);
      }
    };
    animateIn();

    return checkMark;
  }

  /**
   * Enable Three.js mode
   */
  enable() {
    if (this.enabled) return;
    
    this.init();
    this.enabled = true;
    
    if (this.container) {
      this.container.style.opacity = '1';
    }
    
    // Save preference
    try {
      localStorage.setItem('qzjs:threejs-mode', 'true');
    } catch {}
  }

  /**
   * Disable Three.js mode
   */
  disable() {
    if (!this.enabled) return;
    
    this.enabled = false;
    
    if (this.container) {
      this.container.style.opacity = '0';
    }
    
    // Stop animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Save preference
    try {
      localStorage.setItem('qzjs:threejs-mode', 'false');
    } catch {}
  }

  /**
   * Toggle Three.js mode
   */
  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.enabled;
  }

  /**
   * Trigger celebration effect
   */
  celebrate() {
    if (!this.enabled || !this.scene) return;

    // Remove old confetti if exists
    if (this.confettiGroup) {
      this.scene.remove(this.confettiGroup);
      this.confettiGroup = null;
    }

    this.createConfetti();
    
    // Create floating check mark
    const checkMark = this.createCheckMark();
    
    // Auto cleanup after animation
    setTimeout(() => {
      if (this.confettiGroup) {
        this.scene.remove(this.confettiGroup);
        this.confettiGroup = null;
      }
      if (checkMark) {
        this.scene.remove(checkMark);
      }
    }, 3000);
  }

  /**
   * Handle window resize
   */
  onResize() {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Animation loop
   */
  animate() {
    if (!this.enabled) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    // Rotate background particles slowly
    if (this.particles) {
      this.particles.rotation.y += 0.0005;
      this.particles.rotation.x += 0.0002;
    }

    // Animate confetti
    if (this.confettiGroup) {
      this.confettiGroup.children.forEach((mesh) => {
        mesh.position.y += mesh.userData.velocityY;
        mesh.position.x += mesh.userData.velocityX;
        mesh.rotation.x += mesh.userData.rotationSpeed.x;
        mesh.rotation.y += mesh.userData.rotationSpeed.y;

        // Reset confetti that falls below screen
        if (mesh.position.y < -50) {
          mesh.position.y = 50;
          mesh.position.x = (Math.random() - 0.5) * 80;
        }
      });
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.disable();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    
    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
    
    this.scene = null;
    this.camera = null;
  }
}

// Singleton instance
let threeJSModeInstance = null;

export function getThreeJSMode() {
  if (!threeJSModeInstance) {
    threeJSModeInstance = new ThreeJSMode();
    
    // Restore saved preference
    try {
      const saved = localStorage.getItem('qzjs:threejs-mode');
      if (saved === 'true') {
        threeJSModeInstance.enable();
      }
    } catch {}
  }
  return threeJSModeInstance;
}
