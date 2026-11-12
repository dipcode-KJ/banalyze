import { useEffect, useRef } from "react";
import * as THREE from "three";

type LeagueTeam = { name: string; winRate: number; margin: number };

export default function LeagueWebGL({ teams }: { teams: LeagueTeam[] }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !window.WebGLRenderingContext) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 2.6, 9.2);
    camera.lookAt(0, 0.8, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    const grid = new THREE.GridHelper(8, 16, 0x88858b, 0x414046);
    grid.position.y = -0.7;
    group.add(grid);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xff6933, roughness: 0.32 }),
      new THREE.MeshStandardMaterial({ color: 0x909098, roughness: 0.42 }),
    ];
    teams.forEach((team, index) => {
      const height = THREE.MathUtils.clamp(team.winRate * 4.8, 0.7, 4.5);
      const depth = THREE.MathUtils.clamp(Math.abs(team.margin) / 120, 0.16, 0.8);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.58, height, depth), materials[index === 0 ? 0 : 1]);
      bar.position.set((index - (teams.length - 1) / 2) * 0.78, height / 2 - 0.7, 0);
      group.add(bar);
    });
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const key = new THREE.DirectionalLight(0xfff4ee, 2.2);
    key.position.set(-3, 5, 5);
    scene.add(key);

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(260, Math.floor(bounds.height));
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
        group.rotation.y = Math.sin(time * 0.00028) * 0.09;
        group.position.y = Math.sin(time * 0.00065) * 0.035;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      materials.forEach((material) => material.dispose());
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [teams]);

  return <div className="leagueWebGL" ref={hostRef} role="img" aria-label="上位チームの勝率と得失点差を立体的に比較するグラフ" />;
}
