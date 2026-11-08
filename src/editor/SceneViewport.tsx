import { useRef, useState, type ComponentRef, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges, OrbitControls, TransformControls } from "@react-three/drei";
import { Hand, Rotate3D, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { TOUCH, type Group } from "three";
import type { CatalogItem, ObjectInstance, ProjectDocument } from "@/domain/project";
import { useEditorStore } from "./store";

interface ShapeProps {
  item: CatalogItem;
  selected: boolean;
}

function Shape({ item, selected }: ShapeProps) {
  const { width, depth, height, color } = item;
  const panel = Math.min(0.055, width / 5, depth / 5, height / 5);
  const material = <meshStandardMaterial color={color} roughness={0.82} metalness={0.02} />;
  const outline = selected ? <meshBasicMaterial color="#c6633f" wireframe /> : null;

  if (item.kind === "table") {
    const topThickness = Math.min(0.075, height / 4);
    const legWidth = Math.min(0.065, width / 5, depth / 5);
    return (
      <>
        <mesh castShadow receiveShadow position={[0, height - topThickness / 2, 0]}>
          <boxGeometry args={[width, topThickness, depth]} />
          {material}
        </mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} castShadow receiveShadow position={[
            x * (width / 2 - legWidth / 2), (height - topThickness) / 2,
            z * (depth / 2 - legWidth / 2),
          ]}>
            <boxGeometry args={[legWidth, height - topThickness, legWidth]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        )))}
        {selected && <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, depth]} />
          {outline}
        </mesh>}
      </>
    );
  }

  if (item.kind === "shelf") {
    return (
      <>
        {[-1, 1].map((side) => (
          <mesh key={side} castShadow receiveShadow position={[side * (width / 2 - panel / 2), height / 2, 0]}>
            <boxGeometry args={[panel, height, depth]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((index) => (
          <mesh key={index} castShadow receiveShadow position={[0, panel / 2 + index * (height - panel) / 3, 0]}>
            <boxGeometry args={[Math.max(panel, width - panel * 2), panel, depth]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        ))}
        {selected && <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, depth]} />
          {outline}
        </mesh>}
      </>
    );
  }

  return (
    <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, depth]} />
      {material}
      {selected && <Edges color="#c6633f" />}
    </mesh>
  );
}

function RoomShell({ project }: { project: ProjectDocument }) {
  const { width, depth, height } = project.room;
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#e5d9c7" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, height / 2, -depth / 2]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#eee8dd" side={2} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color="#ded5c8" side={2} roughness={1} />
      </mesh>
      <gridHelper args={[Math.max(width, depth), Math.max(2, Math.ceil(Math.max(width, depth) * 2)), "#c5ae93", "#c5ae93"]} position={[0, 0.006, 0]} />
    </group>
  );
}

function SceneObject({ instance, item, selected }: {
  instance: ObjectInstance;
  item: CatalogItem;
  selected: boolean;
}) {
  const objectRef = useRef<Group>(null);
  const tool = useEditorStore((state) => state.tool);
  const room = useEditorStore((state) => state.project?.room);
  const setSelected = useEditorStore((state) => state.setSelected);
  const beginInstanceTransform = useEditorStore((state) => state.beginInstanceTransform);
  const previewInstanceTransform = useEditorStore((state) => state.previewInstanceTransform);
  const commitInstanceTransform = useEditorStore((state) => state.commitInstanceTransform);

  function currentTransform() {
    const object = objectRef.current;
    if (!object) return null;
    return {
      position: [object.position.x, object.position.y, object.position.z] as [number, number, number],
      rotationY: object.rotation.y,
      scale: [object.scale.x, object.scale.y, object.scale.z] as [number, number, number],
    };
  }

  function syncObjectToStoredTransform() {
    const object = objectRef.current;
    const stored = useEditorStore.getState().project?.instances.find((entry) => entry.id === instance.id);
    if (!object || !stored) return;
    object.position.set(...stored.position);
    object.rotation.set(0, stored.rotationY, 0);
    object.scale.set(...stored.scale);
    object.updateMatrixWorld();
  }

  const model = (
    <group
      ref={objectRef}
      position={instance.position}
      rotation={[0, instance.rotationY, 0]}
      scale={instance.scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        setSelected(instance.id);
      }}
    >
      <Shape item={item} selected={selected} />
    </group>
  );

  if (!selected || !room) return model;

  return <>
    {model}
    <TransformControls
      object={objectRef as RefObject<Group>}
      mode={tool}
      size={0.8}
      onMouseDown={beginInstanceTransform}
      onObjectChange={() => {
        const transform = currentTransform();
        if (transform) {
          previewInstanceTransform(instance.id, transform);
          syncObjectToStoredTransform();
        }
      }}
      onMouseUp={() => {
        const transform = currentTransform();
        if (transform) {
          commitInstanceTransform(instance.id, transform);
          syncObjectToStoredTransform();
        }
      }}
    />
  </>;
}

export function SceneViewport({ project }: { project: ProjectDocument }) {
  const selectedId = useEditorStore((state) => state.selectedId);
  const setSelected = useEditorStore((state) => state.setSelected);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [navigationMode, setNavigationMode] = useState<"rotate" | "pan">("rotate");
  const itemById = new Map(project.catalog.map((item) => [item.id, item]));
  const distance = Math.max(project.room.width, project.room.depth, project.room.height) * 1.7;

  function zoom(direction: "in" | "out") {
    const controls = controlsRef.current;
    if (!controls) return;
    if (direction === "in") controls.dollyIn(0.82);
    else controls.dollyOut(0.82);
    controls.update();
  }

  function resetView() {
    controlsRef.current?.reset();
  }

  return (
    <div
      className="editor-canvas"
      role="region"
      aria-label={`Visor tridimensional del proyecto ${project.title}`}
      aria-describedby="canvas-instructions"
    >
      <Canvas
        key={`${project.room.width}-${project.room.depth}-${project.room.height}`}
        shadows
        dpr={[1, 2]}
        camera={{ position: [distance, distance * 0.85, distance], fov: 45, near: 0.01, far: 1000 }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#f4efe7"]} />
        <ambientLight intensity={1.3} />
        <directionalLight castShadow position={[6, 10, 5]} intensity={2.2} shadow-mapSize={[1024, 1024]} />
        <RoomShell project={project} />
        {project.instances.map((instance) => {
          const item = itemById.get(instance.catalogItemId);
          return item && <SceneObject key={instance.id} instance={instance} item={item} selected={instance.id === selectedId} />;
        })}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[0, project.room.height / 2, 0]}
          minDistance={0.5}
          maxDistance={distance * 5}
          maxPolarAngle={Math.PI / 2 - 0.02}
          enableDamping
          dampingFactor={0.08}
          touches={{
            ONE: navigationMode === "rotate" ? TOUCH.ROTATE : TOUCH.PAN,
            TWO: TOUCH.DOLLY_PAN,
          }}
        />
      </Canvas>
      <div className="viewport-controls" aria-label="Controles de la vista 3D">
        <div className="viewport-mode" role="group" aria-label="Gesto de un dedo">
          <button
            type="button"
            className={navigationMode === "rotate" ? "active" : ""}
            onClick={() => setNavigationMode("rotate")}
            aria-pressed={navigationMode === "rotate"}
            title="Rotar la vista con un dedo"
          >
            <Rotate3D size={19} aria-hidden="true" />
            <span>Rotar</span>
          </button>
          <button
            type="button"
            className={navigationMode === "pan" ? "active" : ""}
            onClick={() => setNavigationMode("pan")}
            aria-pressed={navigationMode === "pan"}
            title="Mover la vista con un dedo"
          >
            <Hand size={19} aria-hidden="true" />
            <span>Mover</span>
          </button>
        </div>
        <div className="viewport-actions" role="group" aria-label="Zoom y encuadre">
          <button type="button" onClick={() => zoom("in")} aria-label="Acercar vista" title="Acercar">
            <ZoomIn size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoom("out")} aria-label="Alejar vista" title="Alejar">
            <ZoomOut size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={resetView} aria-label="Restablecer encuadre" title="Restablecer encuadre">
            <Scan size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="canvas-hint" id="canvas-instructions">
        <span className="canvas-hint-touch">Un dedo para {navigationMode === "rotate" ? "rotar" : "mover"} · pellizca para zoom</span>
        <span className="canvas-hint-pointer">Arrastra para orbitar · rueda para acercar</span>
        <span> · selecciona un objeto para editarlo</span>
      </div>
    </div>
  );
}
