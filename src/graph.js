class GraphNode {
    constructor(id, x, y) { this.id = id; this.x = x; this.y = y; this.edges = []; }
}

class SpatialGrid {
    constructor(segments) {
        this.cells = new Map();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        segments.forEach(s => {
            minX = Math.min(minX, s.p1.x, s.p2.x); minY = Math.min(minY, s.p1.y, s.p2.y);
            maxX = Math.max(maxX, s.p1.x, s.p2.x); maxY = Math.max(maxY, s.p1.y, s.p2.y);
        });

        this.cellSize = Math.max(50, (maxX - minX) / 50);

        segments.forEach((s, idx) => {
            const sx = Math.floor(Math.min(s.p1.x, s.p2.x) / this.cellSize);
            const ex = Math.floor(Math.max(s.p1.x, s.p2.x) / this.cellSize);
            const sy = Math.floor(Math.min(s.p1.y, s.p2.y) / this.cellSize);
            const ey = Math.floor(Math.max(s.p1.y, s.p2.y) / this.cellSize);

            for (let x = sx; x <= ex; x++) {
                for (let y = sy; y <= ey; y++) {
                    const key = `${x},${y}`;
                    if (!this.cells.has(key)) this.cells.set(key, []);
                    this.cells.get(key).push({ segment: s, id: idx });
                }
            }
        });
    }

    getNearby(segment) {
        const sx = Math.floor(Math.min(segment.p1.x, segment.p2.x) / this.cellSize);
        const ex = Math.floor(Math.max(segment.p1.x, segment.p2.x) / this.cellSize);
        const sy = Math.floor(Math.min(segment.p1.y, segment.p2.y) / this.cellSize);
        const ey = Math.floor(Math.max(segment.p1.y, segment.p2.y) / this.cellSize);

        const found = new Set();
        const result = [];
        for (let x = sx; x <= ex; x++) {
            for (let y = sy; y <= ey; y++) {
                const key = `${x},${y}`;
                if (this.cells.has(key)) {
                    for (const item of this.cells.get(key)) {
                        if (!found.has(item.id)) {
                            found.add(item.id);
                            result.push(item);
                        }
                    }
                }
            }
        }
        return result;
    }
}

class NavigationGraph {
    constructor(mergeTolerance = 5) {
        this.nodes = new Map();
        this.segments = [];
        this.NODE_TOLERANCE = mergeTolerance;
        this.nodeCounter = 0;
    }

    async buildFromSegmentsAsync(rawSegments, progressCallback) {
        this.segments = [...rawSegments];
        await this.detectAndSplitIntersectionsAsync(progressCallback);
        this.constructNodesAndEdges();
    }

    async detectAndSplitIntersectionsAsync(progressCallback) {
        const splitPoints = new Map();
        const total = this.segments.length;
        for (let i = 0; i < total; i++) splitPoints.set(i, []);

        progressCallback(0, "Building Spatial Grid Index...");
        await new Promise(r => setTimeout(r, 10));

        const grid = new SpatialGrid(this.segments);

        let i = 0;
        const chunkSize = Math.max(50, Math.floor(total / 100));

        return new Promise((resolve) => {
            const processChunk = () => {
                let end = Math.min(i + chunkSize, total);
                for (; i < end; i++) {
                    const s1 = this.segments[i];
                    const nearby = grid.getNearby(s1);

                    for (const item of nearby) {
                        const j = item.id;
                        if (i >= j) continue;

                        const s2 = item.segment;

                        const intersection = MathUtils.getIntersection(s1.p1, s1.p2, s2.p1, s2.p2);
                        if (intersection) {
                            if (MathUtils.distance(s1.p1, intersection) > 0.1 && MathUtils.distance(s1.p2, intersection) > 0.1) splitPoints.get(i).push(intersection);
                            if (MathUtils.distance(s2.p1, intersection) > 0.1 && MathUtils.distance(s2.p2, intersection) > 0.1) splitPoints.get(j).push(intersection);
                            continue;
                        }

                        if (this.NODE_TOLERANCE > 0) {
                            const p1_proj = MathUtils.projectPointOnSegment(s1.p1, s2.p1, s2.p2);
                            if (p1_proj.t > 0 && p1_proj.t < 1 && p1_proj.dist <= this.NODE_TOLERANCE) splitPoints.get(j).push(p1_proj.point);

                            const p2_proj = MathUtils.projectPointOnSegment(s1.p2, s2.p1, s2.p2);
                            if (p2_proj.t > 0 && p2_proj.t < 1 && p2_proj.dist <= this.NODE_TOLERANCE) splitPoints.get(j).push(p2_proj.point);

                            const p3_proj = MathUtils.projectPointOnSegment(s2.p1, s1.p1, s1.p2);
                            if (p3_proj.t > 0 && p3_proj.t < 1 && p3_proj.dist <= this.NODE_TOLERANCE) splitPoints.get(i).push(p3_proj.point);

                            const p4_proj = MathUtils.projectPointOnSegment(s2.p2, s1.p1, s1.p2);
                            if (p4_proj.t > 0 && p4_proj.t < 1 && p4_proj.dist <= this.NODE_TOLERANCE) splitPoints.get(i).push(p4_proj.point);
                        }
                    }
                }

                let percent = Math.round((i / total) * 100);
                progressCallback(percent, `Processing Intersections: ${i}/${total}`);

                if (i < total) {
                    setTimeout(processChunk, 0);
                } else {
                    this.applySplits(splitPoints);
                    resolve();
                }
            };
            processChunk();
        });
    }

    applySplits(splitPoints) {
        const finalSegments = [];
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const splits = splitPoints.get(i);

            if (splits.length === 0) {
                finalSegments.push(seg);
            } else {
                splits.sort((a, b) => MathUtils.distance(seg.p1, a) - MathUtils.distance(seg.p1, b));
                let currentP = seg.p1;
                for (const pt of splits) {
                    if (MathUtils.distance(currentP, pt) > 0.1) {
                        finalSegments.push({ p1: currentP, p2: pt, ref: seg.ref });
                        currentP = pt;
                    }
                }
                if (MathUtils.distance(currentP, seg.p2) > 0.1) {
                    finalSegments.push({ p1: currentP, p2: seg.p2, ref: seg.ref });
                }
            }
        }
        this.segments = finalSegments;
    }

    getOrCreateNode(x, y) {
        for (let node of this.nodes.values()) {
            if (MathUtils.distance({x, y}, node) <= this.NODE_TOLERANCE) return node;
        }
        const id = `node_${this.nodeCounter++}`;
        const newNode = new GraphNode(id, x, y);
        this.nodes.set(id, newNode);
        return newNode;
    }

    constructNodesAndEdges() {
        this.nodes.clear();
        this.nodeCounter = 0;
        for (const seg of this.segments) {
            const n1 = this.getOrCreateNode(seg.p1.x, seg.p1.y);
            const n2 = this.getOrCreateNode(seg.p2.x, seg.p2.y);
            const dist = MathUtils.distance(n1, n2);
            if (n1 !== n2) {
                n1.edges.push({ to: n2.id, weight: dist });
                n2.edges.push({ to: n1.id, weight: dist });
            }
        }
    }

    insertTemporaryNode(pt) {
        let bestDist = Infinity;
        let bestSnap = null;
        let bestSeg = null;

        for (const seg of this.segments) {
            const proj = MathUtils.projectPointOnSegment(pt, seg.p1, seg.p2);
            if (proj.dist < bestDist) {
                bestDist = proj.dist;
                bestSnap = proj.point;
                bestSeg = seg;
            }
        }
        if (!bestSnap) return null;

        const tempNode = new GraphNode('temp_' + Math.random(), bestSnap.x, bestSnap.y);
        this.nodes.set(tempNode.id, tempNode);
        const n1 = this.getOrCreateNode(bestSeg.p1.x, bestSeg.p1.y);
        const n2 = this.getOrCreateNode(bestSeg.p2.x, bestSeg.p2.y);

        const d1 = MathUtils.distance(tempNode, n1);
        const d2 = MathUtils.distance(tempNode, n2);

        tempNode.edges.push({ to: n1.id, weight: d1 }, { to: n2.id, weight: d2 });
        n1.edges.push({ to: tempNode.id, weight: d1 });
        n2.edges.push({ to: tempNode.id, weight: d2 });

        return tempNode.id;
    }
}
