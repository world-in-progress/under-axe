import { mat4, vec3, vec4 } from 'gl-matrix'
import { UnwrappedTileID } from './tile_id'

const NEAR_TL = 0
const NEAR_TR = 1
const NEAR_BR = 2
const NEAR_BL = 3
const FAR_TL = 4
const FAR_TR = 5
const FAR_BR = 6
const FAR_BL = 7
type FrustumPoints = [vec3, vec3, vec3, vec3, vec3, vec3, vec3, vec3]
type FrustumPlanes = [vec4, vec4, vec4, vec4, vec4, vec4]
type Projection = {
    axis: vec3
    projection: [number, number]
}

class Frustum {
    points: FrustumPoints
    planes: FrustumPlanes
    bounds: Aabb
    projections: Array<Projection>
    frustumEdges: Array<vec3>

    constructor(
        points_?: FrustumPoints | null,
        planes_?: FrustumPlanes | null,
    ) {
        this.points = points_ || (new Array(8).fill([0, 0, 0]) as FrustumPoints)
        this.planes =
            planes_ || (new Array(6).fill([0, 0, 0, 0]) as FrustumPlanes)
        this.bounds = Aabb.fromPoints(this.points as Array<vec3>)
        this.projections = []

        // Precompute a set of separating axis candidates for precise intersection tests.
        // These axes are computed as follows: (edges of aabb) x (edges of frustum)
        this.frustumEdges = [
            vec3.sub([] as any, this.points[NEAR_BR], this.points[NEAR_BL]),
            vec3.sub([] as any, this.points[NEAR_TL], this.points[NEAR_BL]),
            vec3.sub([] as any, this.points[FAR_TL], this.points[NEAR_TL]),
            vec3.sub([] as any, this.points[FAR_TR], this.points[NEAR_TR]),
            vec3.sub([] as any, this.points[FAR_BR], this.points[NEAR_BR]),
            vec3.sub([] as any, this.points[FAR_BL], this.points[NEAR_BL]),
        ]

        for (const edge of this.frustumEdges) {
            // Cross product [1, 0, 0] x [a, b, c] == [0, -c, b]
            // Cross product [0, 1, 0] x [a, b, c] == [c, 0, -a]
            const axis0: vec3 = [0, -edge[2], edge[1]]
            const axis1: vec3 = [edge[2], 0, -edge[0]]

            this.projections.push({
                axis: axis0,
                projection: projectPoints(
                    this.points as any,
                    this.points[0],
                    axis0,
                ),
            })

            this.projections.push({
                axis: axis1,
                projection: projectPoints(
                    this.points as any,
                    this.points[0],
                    axis1,
                ),
            })
        }
    }

    static fromInvProjectionMatrix(
        invProj: mat4,
        worldSize: number,
        zoom: number,
        zInMeters: boolean,
    ): Frustum {
        const clipSpaceCorners = [
            [-1, 1, -1, 1],
            [1, 1, -1, 1],
            [1, -1, -1, 1],
            [-1, -1, -1, 1],
            [-1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, -1, 1, 1],
            [-1, -1, 1, 1],
        ] as vec4[]

        const scale = Math.pow(2, zoom)

        // Transform frustum corner points from clip space to tile space
        const frustumCoords: vec4[] = clipSpaceCorners.map((v) => {
            const s = vec4.transformMat4([] as unknown as vec4, v, invProj)
            const k = (1.0 / s[3] / worldSize) * scale
            // Z scale in meters
            return vec4.mul(s, s, [k, k, zInMeters ? 1.0 / s[3] : k, k])
        })

        const frustumPlanePointIndices: vec3[] = [
            [NEAR_TL, NEAR_TR, NEAR_BR], // near
            [FAR_BR, FAR_TR, FAR_TL], // far
            [NEAR_TL, NEAR_BL, FAR_BL], // left
            [NEAR_BR, NEAR_TR, FAR_TR], // right
            [NEAR_BL, NEAR_BR, FAR_BR], // bottom
            [NEAR_TL, FAR_TL, FAR_TR], // top
        ]

        const frustumPlanes = frustumPlanePointIndices.map((p: vec3) => {
            const a = vec3.sub(
                [] as unknown as vec3,
                frustumCoords[p[0]] as unknown as vec3,
                frustumCoords[p[1]] as unknown as vec3,
            )
            const b = vec3.sub(
                [] as unknown as vec3,
                frustumCoords[p[2]] as unknown as vec3,
                frustumCoords[p[1]] as unknown as vec3,
            )
            const n = vec3.normalize(
                [] as unknown as vec3,
                vec3.cross([] as unknown as vec3, a, b),
            ) as [number, number, number]
            const d = -vec3.dot(n, frustumCoords[p[1]] as unknown as vec3)
            return n.concat(d) as vec4
        }) as FrustumPlanes

        const frustumPoints = [] as unknown as FrustumPoints
        for (let i = 0; i < frustumCoords.length; i++) {
            frustumPoints.push([
                frustumCoords[i][0],
                frustumCoords[i][1],
                frustumCoords[i][2],
            ])
        }
        return new Frustum(frustumPoints, frustumPlanes)
    }

    // Performs precise intersection test between the frustum and the provided convex hull.
    // The hull consits of vertices, faces (defined as planes) and a list of edges.
    // Intersection test is performed using separating axis theoreom.
    intersectsPrecise(
        vertices: Array<vec3>,
        faces: Array<vec4>,
        edges: Array<vec3>,
    ): number {
        // Check if any of the provided faces defines a separating axis
        for (let i = 0; i < faces.length; i++) {
            if (!pointsInsideOfPlane(vertices, faces[i])) {
                return 0
            }
        }
        // Check if any of the frustum planes defines a separating axis
        for (let i = 0; i < this.planes.length; i++) {
            if (!pointsInsideOfPlane(vertices, this.planes[i])) {
                return 0
            }
        }

        for (const edge of edges) {
            for (const frustumEdge of this.frustumEdges) {
                const axis = vec3.cross([] as any, edge, frustumEdge)
                const len = vec3.length(axis)
                if (len === 0) {
                    continue
                }

                vec3.scale(axis, axis, 1 / len)
                const projA = projectPoints(
                    this.points as any,
                    this.points[0],
                    axis,
                )
                const projB = projectPoints(
                    vertices as any,
                    this.points[0],
                    axis,
                )

                if (projA[0] > projB[1] || projB[0] > projA[1]) {
                    return 0
                }
            }
        }
        return 1
    }

    containsPoint(point: vec3): boolean {
        for (const plane of this.planes) {
            const normal: vec3 = [plane[0], plane[1], plane[2]]
            const distance = plane[3]

            // If the point is behind any of the frustum's planes, it's outside the frustum
            if (vec3.dot(normal, point) + distance < 0) {
                return false
            }
        }
        return true
    }
}

class Aabb {
    center: vec3

    constructor(
        public min: vec3,
        public max: vec3,
    ) {
        this.center = vec3.scale(
            [] as any,
            vec3.add([] as any, this.min, this.max),
            0.5,
        )
    }

    static fromPoints(points: Array<vec3>): Aabb {
        const min: vec3 = [Infinity, Infinity, Infinity]
        const max: vec3 = [-Infinity, -Infinity, -Infinity]

        for (const p of points) {
            vec3.min(min, min, p)
            vec3.max(max, max, p)
        }

        return new Aabb(min, max)
    }

    static fromTileIdAndHeight(
        id: UnwrappedTileID,
        minHeight: number,
        maxHeight: number,
    ): Aabb {
        const tiles = 1 << id.canonical.z
        const x = id.canonical.x
        const y = id.canonical.y

        return new Aabb(
            [x / tiles, y / tiles, minHeight],
            [(x + 1) / tiles, (y + 1) / tiles, maxHeight],
        )
    }

    static applyTransform(aabb: Aabb, transform: mat4): Aabb {
        const corners = aabb.getCorners()

        for (let i = 0; i < corners.length; ++i) {
            vec3.transformMat4(corners[i], corners[i], transform)
        }
        return Aabb.fromPoints(corners)
    }

    // A fast version of applyTransform. Note that it breaks down for non-uniform
    // scale and complex projection matrices.
    static applyTransformFast(aabb: Aabb, transform: mat4): Aabb {
        const min: vec3 = [transform[12], transform[13], transform[14]]
        const max: vec3 = [...min]

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const value = transform[j * 4 + i]
                const a = value * aabb.min[j]
                const b = value * aabb.max[j]
                min[i] += Math.min(a, b)
                max[i] += Math.max(a, b)
            }
        }

        return new Aabb(min, max)
    }

    static projectAabbCorners(aabb: Aabb, transform: mat4): Array<vec3> {
        const corners = aabb.getCorners()

        for (let i = 0; i < corners.length; ++i) {
            vec3.transformMat4(corners[i], corners[i], transform)
        }
        return corners
    }

    quadrant(index: number): Aabb {
        const split = [index % 2 === 0, index < 2]
        const qMin = vec3.clone(this.min)
        const qMax = vec3.clone(this.max)
        for (let axis = 0; axis < split.length; axis++) {
            qMin[axis] = split[axis] ? this.min[axis] : this.center[axis]
            qMax[axis] = split[axis] ? this.center[axis] : this.max[axis]
        }

        // Temporarily, elevation is constant, hence quadrant.max.z = this.max.z
        qMax[2] = this.max[2]
        return new Aabb(qMin, qMax)
    }

    distanceX(point: Array<number>): number {
        const pointOnAabb = Math.max(
            Math.min(this.max[0], point[0]),
            this.min[0],
        )
        return pointOnAabb - point[0]
    }

    distanceY(point: Array<number>): number {
        const pointOnAabb = Math.max(
            Math.min(this.max[1], point[1]),
            this.min[1],
        )
        return pointOnAabb - point[1]
    }

    distanceZ(point: Array<number>): number {
        const pointOnAabb = Math.max(
            Math.min(this.max[2], point[2]),
            this.min[2],
        )
        return pointOnAabb - point[2]
    }

    getCorners(): Array<vec3> {
        const mn = this.min
        const mx = this.max

        return [
            [mn[0], mn[1], mn[2]],
            [mx[0], mn[1], mn[2]],
            [mx[0], mx[1], mn[2]],
            [mn[0], mx[1], mn[2]],
            [mn[0], mn[1], mx[2]],
            [mx[0], mn[1], mx[2]],
            [mx[0], mx[1], mx[2]],
            [mn[0], mx[1], mx[2]],
        ]
    }

    // Performs conservative intersection test using separating axis theorem.
    // Some accuracy is traded for better performance. False positive rate is < 1%.
    // Flat intersection test checks only x and y dimensions of the aabb.
    // Returns 0 if there's no intersection, 1 if shapes are intersecting and
    // 2 if the aabb if fully inside the frustum.
    intersects(frustum: Frustum): number {
        // Execute separating axis test between two convex objects to find intersections
        // Each frustum plane together with 3 major axes define the separating axes
        // This implementation is conservative as it's not checking all possible axes.
        // False positive rate is ~0.5% of all cases (see intersectsPrecise).
        if (!this.intersectsAabb(frustum.bounds)) {
            return 0
        }

        return intersectsFrustum(frustum, this.getCorners())
    }

    intersectsFlat(frustum: Frustum): number {
        if (!this.intersectsAabb(frustum.bounds)) {
            return 0
        }

        // Perform intersection test against flattened (z === 0) aabb
        const aabbPoints: vec3[] = [
            [this.min[0], this.min[1], 0.0],
            [this.max[0], this.min[1], 0.0],
            [this.max[0], this.max[1], 0.0],
            [this.min[0], this.max[1], 0.0],
        ]

        return intersectsFrustum(frustum, aabbPoints)
    }

    // Performs precise intersection test using separating axis theorem.
    // It is possible run only edge cases that were not covered in intersects().
    // Flat intersection test checks only x and y dimensions of the aabb.
    intersectsPrecise(
        frustum: Frustum,
        edgeCasesOnly?: boolean | null,
    ): number {
        if (!edgeCasesOnly) {
            const intersects = this.intersects(frustum)

            if (!intersects) {
                return 0
            }
        }

        return intersectsFrustumPrecise(frustum, this.getCorners())
    }

    intersectsPreciseFlat(
        frustum: Frustum,
        edgeCasesOnly?: boolean | null,
    ): number {
        if (!edgeCasesOnly) {
            const intersects = this.intersectsFlat(frustum)

            if (!intersects) {
                return 0
            }
        }

        // Perform intersection test against flattened (z === 0) aabb
        const aabbPoints: vec3[] = [
            [this.min[0], this.min[1], 0.0],
            [this.max[0], this.min[1], 0.0],
            [this.max[0], this.max[1], 0.0],
            [this.min[0], this.max[1], 0.0],
        ]

        return intersectsFrustumPrecise(frustum, aabbPoints)
    }

    intersectsAabb(aabb: Aabb): boolean {
        for (let axis = 0; axis < 3; ++axis) {
            if (
                this.min[axis] > aabb.max[axis] ||
                this.max[axis] < aabb.min[axis]
            ) {
                return false
            }
        }
        return true
    }

    intersectAabbXY(aabb: Aabb): boolean {
        if (this.min[0] > aabb.max[0] || aabb.min[0] > this.max[0]) {
            return false
        }
        if (this.min[1] > aabb.max[1] || aabb.min[1] > this.max[1]) {
            return false
        }
        return true
    }

    encapsulate(aabb: Aabb) {
        for (let i = 0; i < 3; i++) {
            this.min[i] = Math.min(this.min[i], aabb.min[i])
            this.max[i] = Math.max(this.max[i], aabb.max[i])
        }
    }

    encapsulatePoint(point: vec3) {
        for (let i = 0; i < 3; i++) {
            this.min[i] = Math.min(this.min[i], point[i])
            this.max[i] = Math.max(this.max[i], point[i])
        }
    }

    closestPoint(point: vec3): vec3 {
        return [
            Math.max(Math.min(this.max[0], point[0]), this.min[0]),
            Math.max(Math.min(this.max[1], point[1]), this.min[1]),
            Math.max(Math.min(this.max[2], point[2]), this.min[2]),
        ]
    }
}

// Helpers //////////////////////////////////////////////////

function projectPoints(
    points: Array<vec3>,
    origin: vec3,
    axis: vec3,
): [number, number] {
    let min = Infinity
    let max = -Infinity

    const vec = [] as unknown as vec3
    for (const point of points) {
        vec3.sub(vec, point, origin)
        const projection = vec3.dot(vec, axis)

        min = Math.min(min, projection)
        max = Math.max(max, projection)
    }

    return [min, max]
}

function intersectsFrustum(frustum: Frustum, aabbPoints: Array<vec3>): number {
    let fullyInside = true

    for (let p = 0; p < frustum.planes.length; p++) {
        const plane = frustum.planes[p]
        let pointsInside = 0

        for (let i = 0; i < aabbPoints.length; i++) {
            const normal: vec3 = [plane[0], plane[1], plane[2]]
            pointsInside +=
                vec3.dot(normal, aabbPoints[i]) + plane[3] >= 0 ? 1 : 0
        }

        if (pointsInside === 0) return 0

        if (pointsInside !== aabbPoints.length) fullyInside = false
    }

    return fullyInside ? 2 : 1
}

function intersectsFrustumPrecise(
    frustum: Frustum,
    aabbPoints: Array<vec3>,
): number {
    for (const proj of frustum.projections) {
        const projectedAabb = projectPoints(
            aabbPoints,
            frustum.points[0],
            proj.axis,
        )

        if (
            proj.projection[1] < projectedAabb[0] ||
            proj.projection[0] > projectedAabb[1]
        ) {
            return 0
        }
    }

    return 1
}

function pointsInsideOfPlane(points: Array<vec3>, plane: vec4): number {
    let pointsInside = 0
    const p = [0, 0, 0, 0]
    for (let i = 0; i < points.length; i++) {
        p[0] = points[i][0]
        p[1] = points[i][1]
        p[2] = points[i][2]
        p[3] = 1.0
        if (vec4.dot(p as [number, number, number, number], plane) >= 0) {
            pointsInside++
        }
    }
    return pointsInside
}

export { Aabb, Frustum }
