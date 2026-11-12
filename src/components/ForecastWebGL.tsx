import { useEffect, useRef } from "react";
import * as THREE from "three";

type ForecastWebGLProps = { homeElo: number; awayElo: number; probability: number; homeTeam: string; awayTeam: string };

export default function ForecastWebGL({ homeElo, awayElo, probability, homeTeam, awayTeam }: ForecastWebGLProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !window.WebGLRenderingContext) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 1.9, 8.3);
    camera.lookAt(0, 0.6, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    group.rotation.x = -0.08;

    const grid = new THREE.GridHelper(6.8, 14, 0x77737a, 0x4a474d);
    grid.position.y = -0.65;
    grid.rotation.y = -0.18;
    group.add(grid);

    const homeHeight = THREE.MathUtils.clamp((homeElo - 1300) / 90, 1.2, 4.3);
    const awayHeight = THREE.MathUtils.clamp((awayElo - 1300) / 90, 1.2, 4.3);
    const materials = [new THREE.MeshStandardMaterial({ color: 0xff6933, roughness: 0.36, metalness: 0.08 }), new THREE.MeshStandardMaterial({ color: 0xe8eaf2, roughness: 0.36, metalness: 0.08 })];
    [homeHeight, awayHeight].forEach((height, index) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, height, 1.1), materials[index]);
      bar.position.set(index === 0 ? -1.05 : 1.05, height / 2 - 0.65, 0);
      group.add(bar);
    });

    const probabilityLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.8, -0.58, 0.08),
      new THREE.Vector3(-2.8 + THREE.MathUtils.clamp(probability, 0.05, 0.95) * 5.6, -0.58, 0.08),
    ]), new THREE.LineBasicMaterial({ color: 0xecc18b }));
    group.add(probabilityLine);

    const ambient = new THREE.AmbientLight(0xffffff, 1.7);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 5, 4);
    scene.add(key);

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(220, Math.floor(bounds.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = (time: number) => {
      if (!reducedMotion) {
        group.rotation.y = Math.sin(time * 0.00035) * 0.08 - 0.18;
        group.position.y = Math.sin(time * 0.0007) * 0.035;
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      materials.forEach((material) => material.dispose());
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [awayElo, homeElo, probability]);

  return <div className="forecastWebGL" ref={hostRef} aria-label={`${homeTeam}と${awayTeam}のElo比較とホーム勝率の可視化`} role="img" />;
}
