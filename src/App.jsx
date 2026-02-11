import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'

// Valid quaternion component values after any number of 90-degree rotations
const QUAT_SNAPS = [0, 0.5, -0.5, Math.SQRT1_2, -Math.SQRT1_2, 1, -1]
const FACES = ['R', 'L', 'U', 'D', 'F', 'B']

function snapToNearest(value, candidates, maxDist) {
  let best = value
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.abs(value - c)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return bestDist <= maxDist ? best : value
}

function generateShuffle(length = 12) {
  const axisOf = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' }
  const moves = []
  let lastAxis = null
  for (let i = 0; i < length; i++) {
    let face
    do {
      face = FACES[Math.floor(Math.random() * FACES.length)]
    } while (axisOf[face] === lastAxis)
    lastAxis = axisOf[face]
    const prime = Math.random() < 0.5
    moves.push({ face, direction: prime ? -1 : 1, notation: face + (prime ? '\u2032' : '') })
  }
  return moves
}

const RubiksModel = forwardRef(({ disabled }, ref) => {
  const gltf = useGLTF('/rubiks_cube_final.glb')
  const groupRef = useRef(null)
  const meshesRef = useRef([])
  const cubeInfoRef = useRef({ gridValues: [], layerThreshold: 0.5, snapMaxDist: 0.1 })
  const isAnimatingRef = useRef(false)
  const disabledRef = useRef(false)
  disabledRef.current = disabled

  // Flatten hierarchy and normalize meshes
  useEffect(() => {
    if (!groupRef.current || !gltf.scene) return

    groupRef.current.clear()
    meshesRef.current = []

    const sceneClone = gltf.scene.clone(true)
    sceneClone.updateWorldMatrix(true, true)

    // Extract meshes with world transforms and flatten into groupRef
    const flatMeshes = []
    sceneClone.traverse((node) => {
      if (!node.isMesh) return

      // Decompose the full world transform
      const wp = new THREE.Vector3()
      const wq = new THREE.Quaternion()
      const ws = new THREE.Vector3()
      node.matrixWorld.decompose(wp, wq, ws)

      // Clone geometry and bake world rotation + scale into vertices
      const geo = node.geometry.clone()
      geo.applyMatrix4(
        new THREE.Matrix4().compose(new THREE.Vector3(), wq, ws)
      )

      // Center geometry at local origin
      geo.computeBoundingBox()
      const center = new THREE.Vector3()
      geo.boundingBox.getCenter(center)
      geo.translate(-center.x, -center.y, -center.z)

      // Create mesh directly under groupRef (flat — no parent transforms)
      const mesh = new THREE.Mesh(geo, node.material)
      mesh.position.copy(wp).add(center)
      mesh.castShadow = true
      mesh.receiveShadow = true

      flatMeshes.push(mesh)
    })

    // Compute cube grid info for face detection and post-rotation snapping
    const allComponents = []
    flatMeshes.forEach(m => {
      allComponents.push(m.position.x, m.position.y, m.position.z)
    })

    // Collect unique grid values (rounded to avoid float noise)
    const gridValues = [
      ...new Set(allComponents.map(v => Math.round(v * 1000) / 1000))
    ].sort((a, b) => a - b)

    // For a 3-layer cube, the layer threshold is 50% of the max extent
    const maxAbs = Math.max(...allComponents.map(Math.abs))
    const layerThreshold = maxAbs * 0.5

    cubeInfoRef.current = {
      gridValues,
      layerThreshold,
      snapMaxDist: maxAbs * 0.15
    }

    flatMeshes.forEach(mesh => {
      groupRef.current.add(mesh)
      meshesRef.current.push(mesh)
    })

    console.log(`Cube initialized: ${flatMeshes.length} meshes, maxExtent=${maxAbs.toFixed(4)}, layerThreshold=${layerThreshold.toFixed(4)}`)
  }, [gltf.scene])

  // Identify pieces on a given face using local positions (flat hierarchy = world positions)
  const getPiecesForFace = (face) => {
    const t = cubeInfoRef.current.layerThreshold
    return meshesRef.current.filter((mesh) => {
      const p = mesh.position
      switch (face) {
        case 'R': return p.x > t
        case 'L': return p.x < -t
        case 'U': return p.y > t
        case 'D': return p.y < -t
        case 'F': return p.z > t
        case 'B': return p.z < -t
        default: return false
      }
    })
  }

  const getRotationAxis = (face) => ({
    R: new THREE.Vector3(1, 0, 0),
    L: new THREE.Vector3(1, 0, 0),
    U: new THREE.Vector3(0, 1, 0),
    D: new THREE.Vector3(0, 1, 0),
    F: new THREE.Vector3(0, 0, 1),
    B: new THREE.Vector3(0, 0, 1)
  }[face])

  // Animate a 90-degree face rotation, returns a Promise
  const rotateFace = (face, direction = 1) => {
    return new Promise((resolve) => {
      if (isAnimatingRef.current) { resolve(); return }

      const pieces = getPiecesForFace(face)
      if (pieces.length === 0) {
        console.warn(`No pieces found for face ${face}`)
        resolve()
        return
      }

      isAnimatingRef.current = true

      const axis = getRotationAxis(face)
      // R, U, F: negative angle = clockwise when looking at that face
      // L, D, B: positive angle = clockwise when looking at that face
      const faceSign = { R: -1, L: 1, U: -1, D: 1, F: -1, B: 1 }
      const targetAngle = (Math.PI / 2) * direction * faceSign[face]

      const initialStates = pieces.map(mesh => ({
        mesh,
        pos: mesh.position.clone(),
        quat: mesh.quaternion.clone()
      }))

      const duration = 300
      const startTime = Date.now()

      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        const angle = targetAngle * ease

        initialStates.forEach(({ mesh, pos, quat }) => {
          mesh.position.copy(pos)
          mesh.quaternion.copy(quat)
          mesh.position.applyAxisAngle(axis, angle)
          mesh.rotateOnWorldAxis(axis, angle)
        })

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          // Apply exact final rotation and snap to prevent floating-point drift
          const { gridValues, snapMaxDist } = cubeInfoRef.current

          initialStates.forEach(({ mesh, pos, quat }) => {
            mesh.position.copy(pos)
            mesh.quaternion.copy(quat)
            mesh.position.applyAxisAngle(axis, targetAngle)
            mesh.rotateOnWorldAxis(axis, targetAngle)

            // Snap positions to the cube grid
            mesh.position.x = snapToNearest(mesh.position.x, gridValues, snapMaxDist)
            mesh.position.y = snapToNearest(mesh.position.y, gridValues, snapMaxDist)
            mesh.position.z = snapToNearest(mesh.position.z, gridValues, snapMaxDist)

            // Snap quaternion components to valid 90-degree rotation values
            mesh.quaternion.x = snapToNearest(mesh.quaternion.x, QUAT_SNAPS, 0.1)
            mesh.quaternion.y = snapToNearest(mesh.quaternion.y, QUAT_SNAPS, 0.1)
            mesh.quaternion.z = snapToNearest(mesh.quaternion.z, QUAT_SNAPS, 0.1)
            mesh.quaternion.w = snapToNearest(mesh.quaternion.w, QUAT_SNAPS, 0.1)
            mesh.quaternion.normalize()
          })

          isAnimatingRef.current = false
          resolve()
        }
      }

      animate()
    })
  }

  useImperativeHandle(ref, () => ({ rotateFace }))

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (disabledRef.current) return
      const key = event.key.toLowerCase()
      const faceMap = { r: 'R', l: 'L', u: 'U', d: 'D', f: 'F', b: 'B' }

      if (faceMap[key]) {
        event.preventDefault()
        rotateFace(faceMap[key], event.shiftKey ? -1 : 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <group ref={groupRef} />
})

const CubeScene = forwardRef(({ disabled }, ref) => (
  <Canvas style={{ width: '100%', height: '100vh' }} dpr={[1, 2]}>
    <PerspectiveCamera makeDefault position={[0.1, 0.1, 0.1]} fov={50} />
    <color attach="background" args={['#0a0a0a']} />
    <Environment preset="studio" />
    <OrbitControls />
    <RubiksModel ref={ref} disabled={disabled} />
  </Canvas>
))

function App() {
  const cubeRef = useRef(null)
  const [shuffle, setShuffle] = useState(() => generateShuffle())
  const [isShuffling, setIsShuffling] = useState(false)

  const handleShuffle = async () => {
    if (!cubeRef.current || isShuffling) return
    setIsShuffling(true)
    for (const move of shuffle) {
      await cubeRef.current.rotateFace(move.face, move.direction)
    }
    setIsShuffling(false)
  }

  const handleNew = () => {
    if (isShuffling) return
    setShuffle(generateShuffle())
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div className="shuffle-bar">
        <div className="shuffle-algorithm">
          {shuffle.map((m, i) => (
            <span key={i} className="shuffle-move">{m.notation}</span>
          ))}
        </div>
        <button className="shuffle-btn" onClick={handleShuffle} disabled={isShuffling}>
          {isShuffling ? 'Shuffling...' : 'Shuffle'}
        </button>
        <button className="shuffle-btn" onClick={handleNew} disabled={isShuffling}>
          New
        </button>
      </div>
      <CubeScene ref={cubeRef} disabled={isShuffling} />
    </div>
  )
}

export default App
