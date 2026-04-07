import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeBackground: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.appendChild(renderer.domElement);

        // Casino Croupier Shuffle (52 Cards)
        const cardGroup = new THREE.Group();
        const cardsCount = 52;
        const cards: THREE.Mesh[] = [];

        for (let i = 0; i < cardsCount; i++) {
            const geometry = new THREE.PlaneGeometry(0.7, 1);
            const material = new THREE.MeshStandardMaterial({
                color: '#498fb8', // Pure white cards
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9,
                roughness: 0.1,
                metalness: 0.1
            });

            const card = new THREE.Mesh(geometry, material);

            // Add refined red/black border for "suit" feel
            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
                color: i % 2 === 0 ? '#ffffff' : '#111827',
                transparent: true,
                opacity: 0.6
            }));
            card.add(line);

            cardGroup.add(card);
            cards.push(card);
        }
        scene.add(cardGroup);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0xffffff, 100);
        spotLight.position.set(0, 10, 10);
        scene.add(spotLight);

        // Animation State
        const cardPhysics = cards.map((_card, i) => ({
            delay: i * 0.1, // Staggered entry
            horizontalOffset: (i % 2 === 0 ? -1 : 1), // Split into two halves for riffle
            phase: Math.random() * Math.PI,
        }));

        const animate = () => {
            requestAnimationFrame(animate);
            const time = Date.now() * 0.001;

            cards.forEach((card, i) => {
                const physics = cardPhysics[i];

                // Croupier "Riffle" - Two stacks merging (Slower: was time * 1.5)
                const cycle = Math.sin(time * 0.7 + physics.delay);

                const spread = 12 * physics.horizontalOffset;
                card.position.x = spread * Math.pow(Math.abs(cycle), 0.5) * (cycle > 0 ? 1 : -1);
                card.position.y = 5.5 + Math.sin(time * 2 + i) * 0.2; // Slower vertical drift (was time * 4)
                card.position.z = -12 + (i * 0.05);

                // Realistic "flip" during the riffle (Slower: was time * 8)
                const flip = Math.sin(time * 4 + i * 0.1) * Math.abs(cycle);
                card.rotation.x = flip;
                card.rotation.y = Math.PI / 2;
                card.rotation.z = 0;
            });

            renderer.render(scene, camera);
        };

        animate();

        // Handle resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        };
    }, []);

    return (
        <div
            ref={mountRef}
            aria-hidden="true"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1,
                pointerEvents: 'none',
                background: '#030821',
                display: 'block'
            }}
        />
    );
};

export default ThreeBackground;
