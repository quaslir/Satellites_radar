import { useEffect, useRef } from "react";
import { createEarth } from "./three";
export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if(!mountRef.current) return;
    const {dispose} = createEarth(mountRef.current);
    return () => dispose();
  },[]);
  return <div ref={mountRef} className="canvasHost" />;
}